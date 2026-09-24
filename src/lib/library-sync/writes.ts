import { Prisma as PrismaSql } from '../../generated/prisma/client.ts'
import type { createPrismaClient } from '../db'
import { getAppLogger } from '../logger'
import {
  beatsCurrent,
  chunk,
  type LedgerRow,
  type MatchKey,
  parseMtime,
  rowKey,
  sqlDate,
  toMb,
  type Write
} from './ledger'
import { IN_CHUNK, MASS_DELETE_MIN, MASS_DELETE_RATIO } from './limits'
import { type LibrarySyncResult, leaseGuard } from './run'

const logger = getAppLogger('library-sync')

type Prisma = ReturnType<typeof createPrismaClient>

/**
 * upsert イベント群を D1 の書き込みに変換する。
 *
 * 該当 0 件でも失敗にしない。nagisa にしか無い録画 (Workers が追跡していない作品、
 * id も tmdb_id も復元できなかった行) が同期を止めてはいけない (§7-5)。
 */
export function buildUpsertWrites(
  prisma: Prisma,
  rows: LedgerRow[],
  resolved: Map<MatchKey, string[]>,
  now: Date,
  owner: string,
  /**
   * 既に入っている録画より古い行では上書きしない (snapshot 経路だけ true)。
   *
   * 下の `beatsCurrent` が決めるのは **1 ページの中の**勝者でしかない。
   * snapshot はページ間に順序が無いので、ページ 1 で書いた新しい録画 A を
   * ページ 2 の古い録画 B が上書きしうる。あとから B の tombstone が届くと、
   * A が実在するのにエピソードが `missing` に落ちる。SQL 側でも mtime を
   * 比べて、同じ規則 (新しい方が勝つ) を全ページに広げる。
   *
   * 変更ログ経路では **付けない**。あちらは seq の順序が正しさの根拠で、
   * 「B を消して A を置いた」が `delete B` → `upsert A` の順で届く。mtime で
   * 弾くと upsert だけ落ちて delete が通り、missing に化ける。
   */
  skipOlder: boolean
): { writes: Write[]; unmatched: number } {
  const writes: Write[] = []
  const guard = leaseGuard(owner, now)
  let unmatched = 0

  // **同じエピソードを指す台帳行が 1 ページに 2 つ以上来ることがある** (録り直して
  // パスが変わった、別シーズン表記で二重に登録されている等)。素直に順へ書くと
  // 最後に処理した行が勝ち、`recording_id` がページの並び任せになる —
  // tombstone はこの id で引くので、負けた方の消失が届いても 1 行も当たらない。
  // 勝者をここで決めておく (→ `beatsCurrent`)。
  const winners = new Map<string, LedgerRow>()

  for (const row of rows) {
    const key = rowKey(row.item)
    if (key === null) {
      unmatched++
      continue
    }
    const ids = resolved.get(key)
    if (!ids || ids.length === 0) {
      unmatched++
      continue
    }
    // 1 つの台帳行に複数のエピソードがぶら下がることもある (同じ作品が別 season に
    // 重複登録されている等)。こちらは全件に書く。
    for (const id of ids) {
      const held = winners.get(id)
      if (held === undefined || beatsCurrent(row, held)) winners.set(id, row)
    }
  }

  // 勝った行ごとにまとめ直してから書く。1 エピソード 1 文にはしない: ふつうは
  // 1 行が 1 エピソードなので分割は起きず、重複登録の作品だけ束ねられる。
  //
  // バインド数は **値 5 + 新旧比較 2 + id 90 + lease 2 = 99**。定数 (status / source /
  // recorded) は SQL リテラルで書いて枠を空けてある。IN_CHUNK を上げると 100 を
  // 超えて落ちる。
  const byRow = new Map<LedgerRow, string[]>()
  for (const [episodeId, row] of winners) {
    const list = byRow.get(row)
    if (list) list.push(episodeId)
    else byRow.set(row, [episodeId])
  }

  for (const [row, ids] of byRow) {
    const recordedAt = parseMtime(row.item.mtime)
    // 既に入っている録画との比較。mtime を読めなかった行 (`null`) は比較が
    // NULL になるのでどの完了行にも勝てない — ページ内の `beatsCurrent` と
    // 同じ「読めない mtime は負ける」規則になる。
    //
    // 勝ちは **厳密に新しいとき** だけ。等号で通すと、同じ mtime の別録画が
    // ページ 1 の勝者を上書きできてしまい (ページ内なら `recordingId` で裁ける
    // タイが、ページ間では裁けない)、負けた方の tombstone で実体のある
    // エピソードが missing に落ちる。代わりに **同じ録画 (`recording_id` 一致) は
    // 常に通す**ので、パスや容量だけが変わった再走査は mtime 据え置きでも入る。
    const older =
      skipOlder && recordedAt
        ? PrismaSql.sql`AND (record_status <> 'completed' OR recorded_at IS NULL OR recorded_at < ${sqlDate(recordedAt)} OR recording_id = ${row.recordingId})`
        : skipOlder
          ? PrismaSql.sql`AND (record_status <> 'completed' OR recorded_at IS NULL OR recording_id = ${row.recordingId})`
          : PrismaSql.empty
    for (const part of chunk(ids, IN_CHUNK)) {
      writes.push(
        prisma.$executeRaw`
          UPDATE episodes SET
            record_status = 'completed',
            record_source = 'reconcile',
            recorded = 1,
            record_error = NULL,
            recording_id = ${row.recordingId},
            record_path = ${row.item.path},
            record_size_mb = ${toMb(row.item.size)},
            recorded_at = ${recordedAt ? sqlDate(recordedAt) : null},
            record_synced_at = ${sqlDate(now)}
          WHERE id IN (${PrismaSql.join(part)}) ${older} ${guard}`
      )
    }
  }

  // **在籍の印だけは負けた行にも押す**。上の `older` で弾かれた行は 1 列も
  // 書き換わらないので `record_synced_at` が bootstrap 開始より古いままになり、
  // 掃き出し (`buildSweep`) が「今回の台帳に居なかった」とみなして `missing` に
  // 落としてしまう — 台帳に(古い録画として)確かに居るのに、である。
  // ここで触れた事実だけを別文で刻んでおけば、掃き出しの対象から外れる。
  //
  // ページ全体の id をまとめて 90 件ずつ (バインドは時刻 1 + id 90 + lease 2 = 93)。
  // 勝った行にも重ねて当たるが、同じ `now` を書くだけなので結果は変わらない。
  // 対象は掃き出しと同じ completed だけ。走行中 (pending / downloading) の行まで
  // 触ると、job-sync の猶予とページ送りの起点 (`recordSyncedAt`) を横から動かす。
  // 変更ログ経路には掃き出しが無い (かつ全行が必ず書かれる) ので付けない。
  if (skipOlder) {
    for (const part of chunk([...winners.keys()], IN_CHUNK)) {
      writes.push(
        prisma.$executeRaw`
          UPDATE episodes SET record_synced_at = ${sqlDate(now)}
          WHERE id IN (${PrismaSql.join(part)}) AND record_status = 'completed' ${guard}`
      )
    }
  }
  return { writes, unmatched }
}

/**
 * tombstone を適用する。`recording_id` は upsert を適用したときに控えてあるので、
 * パスの表記揺れに依存せずに引ける。completed 以外は触らない
 * (再指示で pending に戻っている話を missing に引き戻さないため)。
 */
export const buildDeleteWrite = (prisma: Prisma, recordingId: string, now: Date, owner: string): Write =>
  prisma.$executeRaw`
    UPDATE episodes SET
      record_status = 'missing',
      record_source = 'reconcile',
      recorded = 0,
      record_synced_at = ${sqlDate(now)}
    WHERE recording_id = ${recordingId} AND record_status = 'completed' ${leaseGuard(owner, now)}`

/**
 * bootstrap を完走したときの掃き出し (mark and sweep)。
 *
 * 差分が取りこぼされたまま (tombstone を引く前にカーソルが失効した等) だと、
 * 実体の消えた録画が `completed` のまま永久に残る。全件スナップショットを
 * 見終えた回だけは「台帳に居なかった」と断言できるので、ここで落とす。
 *
 * 判定材料は `recordSyncedAt`: bootstrap 開始時刻より古い completed は、
 * 今回のスナップショットのどのページにも出てこなかった行を意味する。
 * mass_delete と同じ比率ガードを掛け、疑わしい規模なら掃かずに記録だけ残す
 * (カーソルは進める。次の差分が正しければ自然に収束する)。
 */
export async function buildSweep(
  prisma: Prisma,
  since: Date,
  now: Date,
  owner: string,
  result: LibrarySyncResult
): Promise<Write[]> {
  // 境界は等号込み。ページの書き込み時刻は `stamp(sweepFrom)` で必ず基準より後に
  // ずらしてあるので、基準ちょうどの `recordSyncedAt` は「今回のスナップショットで
  // 触れていない行」だけを指す。`<` のままだと、基準と同じミリ秒に書かれた
  // (= bootstrap 開始と同時刻に他所が触った) 行が永久に掃かれずに残る。
  const where = {
    recordStatus: 'completed',
    OR: [{ recordSyncedAt: null }, { recordSyncedAt: { lte: since } }]
  }
  const orphans = await prisma.episode.count({ where })
  if (orphans === 0) return []

  const completed = await prisma.episode.count({ where: { recordStatus: 'completed' } })
  if (orphans > MASS_DELETE_MIN && orphans > completed * MASS_DELETE_RATIO) {
    logger.error({ action: 'library-sweep-abort', orphans, completed })
    result.aborted = 'mass_sweep'
    return []
  }

  logger.info({ action: 'library-sweep', orphans, completed })
  result.deletes += orphans
  // 日時の比較は Prisma が書く表記 (TEXT / `+00:00` 固定) どうしで行う。sqlDate を参照。
  return [
    prisma.$executeRaw`
      UPDATE episodes SET
        record_status = 'missing',
        record_source = 'reconcile',
        recorded = 0,
        record_synced_at = ${sqlDate(now)}
      WHERE record_status = 'completed'
        AND (record_synced_at IS NULL OR record_synced_at <= ${sqlDate(since)})
        ${leaseGuard(owner, now)}`
  ]
}
