import { NagisaLibrarySnapshotSchema } from '../../schemas/nagisa.dto'
import type { createPrismaClient } from '../db'
import { getAppLogger } from '../logger'
import { fetchNagisaRaw, type NagisaEnv } from '../nagisa-client'
import { type LedgerRow, resolveEpisodes, stamp } from './ledger'
import { MAX_SNAPSHOT_PAGES_PER_RUN, MAX_WRITES_PER_PAGE, MAX_WRITES_PER_RUN, SNAPSHOT_LIMIT, SYNC_KEY } from './limits'
import { applyBatched, fenced, holdsLease, type LibrarySyncResult, leaseWhere, readErrorCode, writesSoFar } from './run'
import { buildSweep, buildUpsertWrites } from './writes'

const logger = getAppLogger('library-sync')

type Prisma = ReturnType<typeof createPrismaClient>

/**
 * 台帳を頭から引き直す。走るのは初回・`410`・`409` の 3 ケースだけで、
 * 定常運転では走らない。**走った回数そのものが異常の指標**なので必ず記録する。
 *
 * 全ページを適用し切るまで `libraryCursor` を書かない。途中で差分に切り替えると
 * 未適用のぶんが取りこぼされる。ページ上限で打ち切ったときは
 * `snapshotCursor` に途中経過を残し、次 run が続きから再開する。
 */
export async function bootstrapLibrary(
  prisma: Prisma,
  env: NagisaEnv,
  owner: string,
  reason: string,
  result: LibrarySyncResult
): Promise<void> {
  result.bootstrap = reason
  const startedFrom = await prisma.syncState.findUnique({ where: { key: SYNC_KEY } })
  let cursor: string | null = startedFrom?.snapshotCursor ?? null
  // 掃き出しの基準時刻。ページを跨いで持ち回るので列に置く。これより後に触れた
  // 行だけが「今回のスナップショットに居た」を意味する。
  //
  // 引き継ぐのは **続きから読むとき (cursor あり) だけ**。cursor が無い回は
  // nagisa が頭から作り直したスナップショットを返すので、前回の在籍記録と
  // 混ぜてはいけない。1 ページで終わる台帳を mass_sweep で拒否して再挑戦する
  // 場面がまさにそれで、S1 に居て S2 に居なくなった録画が「基準時刻より後に
  // 触れた」の条件を満たしたまま残り、掃き出しから漏れる (そのまま完了扱いで
  // `libraryCursor` が確定し、削除は二度と来ない)。
  //
  // 一方 `snapshotStartedAt` が非 null であること自体は「bootstrap 継続中」の
  // 印として使い続ける (syncLibrary の分岐)。印の継続と在籍判定時刻の継続は別物。
  let sweepFrom = cursor ? (startedFrom?.snapshotStartedAt ?? null) : null
  if (!sweepFrom) {
    sweepFrom = new Date()
    await prisma.syncState.updateMany({
      where: leaseWhere(owner, sweepFrom),
      data: { snapshotStartedAt: sweepFrom }
    })
  }

  for (let page = 0; page < MAX_SNAPSHOT_PAGES_PER_RUN; page++) {
    const qs = new URLSearchParams({ limit: String(SNAPSHOT_LIMIT) })
    if (cursor) qs.set('cursor', cursor)
    const res = await fetchNagisaRaw(env, `/api/library/snapshot?${qs.toString()}`)

    if (res.status === 410) {
      // 途中でスナップショットが作り直された。部分適用を捨てて最初からやり直す。
      const code = await readErrorCode(res)
      logger.warn({ action: 'library-bootstrap-restart', code })
      await prisma.syncState.updateMany({
        where: leaseWhere(owner, new Date()),
        data: { snapshotCursor: null, snapshotStartedAt: null }
      })
      result.aborted = code
      return
    }
    if (!res.ok) {
      result.error = `snapshot ${res.status}: ${await readErrorCode(res)}`
      return
    }

    const body = NagisaLibrarySnapshotSchema.parse(await res.json())
    // このページの書き込み時刻は掃き出しの基準より **必ず後**。同じミリ秒に
    // 収まると、いま台帳で確認したばかりの行が直後の buildSweep に
    // 「触れていない」と数えられてしまう (境界が等号込みのため)。
    const now = stamp(sweepFrom)
    const rows: LedgerRow[] = body.items.map((i) => ({ recordingId: i.recording_id, item: i }))
    const resolved = await resolveEpisodes(prisma, rows)
    const { writes, unmatched } = buildUpsertWrites(prisma, rows, resolved, now, owner, true)
    cursor = body.next_cursor
    const done = !cursor

    // 1 ページが膨らみすぎていないか。台帳 1 行が数千エピソードに解決されると
    // (episode_id の取り違え等) このページだけで D1 の queries per invocation を
    // 超え、run ごと落ちる。異常データなので 1 行も書かずに降りて記録を残す。
    if (writes.length > MAX_WRITES_PER_PAGE) {
      logger.error({ action: 'library-page-too-large', phase: 'snapshot', writes: writes.length })
      result.aborted = 'page_too_large'
      return
    }

    // 書き込む直前の早期脱出。正しさは各文の `leaseGuard` が担うので、ここを
    // すり抜けても 1 行も書けない。往復を 1 つ減らすためだけの確認。
    if (!(await holdsLease(prisma, owner))) {
      logger.warn({ action: 'library-lease-lost', phase: 'snapshot', page: result.pages })
      result.aborted = 'lease_lost'
      return
    }

    // 途中のページ。適用とカーソルを同じバッチに入れる (間で落ちると取りこぼす)。
    if (!done) {
      const applied = await applyBatched(prisma, writes, [
        prisma.syncState.updateMany({ where: leaseWhere(owner, now), data: { snapshotCursor: cursor } })
      ])
      if (fenced(applied, result, 'snapshot')) return
      // 集計は適用できた回だけ進める (中断した run の数字を混ぜない)。
      result.unmatched += unmatched
      result.upserts += writes.length
      result.pages++
      // 予算は **この run が出した全ての文** で見る。bootstrap の前に差分ページを
      // 適用している回があり (`409` で落ちてから引き直すとき)、そこで出した
      // delete を数えないと合計が上限の倍近くまで伸びる。
      if (writesSoFar(result) >= MAX_WRITES_PER_RUN) {
        logger.info({ action: 'library-bootstrap-budget', writes: writesSoFar(result), pages: result.pages })
        return
      }
      continue
    }

    // 最終ページだけは 2 バッチに割る。掃き出しの対象を数えるにはこのページの
    // upsert が反映済みでなければならない (最後のページに載っていた行まで
    // 「台帳に居なかった」に見え、比率ガードが誤爆する) が、D1 には同一バッチの
    // 途中結果を読む手段が無い。カーソルを確定するのは後のバッチなので、
    // ここで落ちても次 run が同じページを読み直すだけで済む (適用は冪等)。
    if (writes.length > 0) await applyBatched(prisma, writes, [])
    result.unmatched += unmatched
    result.upserts += writes.length
    result.pages++

    // 掃き出しの数え上げは、直前の適用が反映済みであることが前提。lease を
    // 失っていると 1 行も書けていない (leaseGuard) ので、数える前に降りる。
    // 掃き出し自体も次のバッチで fencing されるから書き換わることは無いが、
    // 比率ガードを誤爆させた記録だけが残るのは紛らわしい。
    if (!(await holdsLease(prisma, owner))) {
      logger.warn({ action: 'library-lease-lost', phase: 'sweep', page: result.pages })
      result.aborted = 'lease_lost'
      return
    }

    const sweepWrites = await buildSweep(prisma, sweepFrom, now, owner, result)
    if (result.aborted) {
      // 掃き出しを拒否した回はカーソルを **1 つも** 確定しない。ここで
      // libraryCursor を置くと、取りこぼした削除は二度と拾えなくなる
      // (以降は差分しか来ない)。snapshotCursor はこのページを取りに行ったときの
      // 値のまま残してあるので、次 run が同じページからやり直す。
      return
    }

    const applied = await applyBatched(prisma, sweepWrites, [
      // 完走した回だけ libraryCursor を置く。それまでは snapshotCursor だけ動かす。
      prisma.syncState.updateMany({
        where: leaseWhere(owner, now),
        data: {
          snapshotCursor: null,
          snapshotStartedAt: null,
          libraryCursor: body.changes_cursor,
          lastSucceededAt: now
        }
      })
    ])
    if (fenced(applied, result, 'sweep')) return
    logger.info({ action: 'library-bootstrap-done', reason, items: result.upserts, pages: result.pages })
    return
  }
  logger.info({ action: 'library-bootstrap-partial', reason, pages: result.pages })
}
