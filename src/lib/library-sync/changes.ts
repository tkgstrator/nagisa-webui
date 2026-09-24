import { Prisma as PrismaSql } from '../../generated/prisma/client.ts'
import type { NagisaLibraryChange } from '../../schemas/nagisa.dto'
import type { createPrismaClient } from '../db'
import { getAppLogger } from '../logger'
import { chunk, type LedgerRow, learnTmdbIds, resolveEpisodes, sqlDate } from './ledger'
import { IN_CHUNK, MASS_DELETE_MIN, MASS_DELETE_RATIO, MAX_WRITES_PER_PAGE } from './limits'
import { applyBatched, fenced, holdsLease, type LibrarySyncResult, stateWrite } from './run'
import { buildDeleteWrite, buildUpsertWrites } from './writes'

const logger = getAppLogger('library-sync')

type Prisma = ReturnType<typeof createPrismaClient>

/** 変更ログを 1 ページ適用する。返り値は「この run を続けてよいか」。 */
export async function applyChangesPage(
  prisma: Prisma,
  db: D1Database,
  body: { changes: NagisaLibraryChange[]; next_cursor: string },
  owner: string,
  result: LibrarySyncResult
): Promise<boolean> {
  const now = new Date()

  // 同じ録画に複数のイベントが乗ることがある (消して録り直した等)。
  // op ごとにまとめて適用すると seq の順序が壊れ、`delete(10) → upsert(11)` が
  // 同じページに来たときに最終状態が missing に化ける。しかもカーソルは進むので
  // 二度と直らない。録画ごとに seq 最大のイベントだけを残して畳む。
  const latest = new Map<string, NagisaLibraryChange>()
  for (const c of body.changes) {
    const prev = latest.get(c.recording_id)
    if (!prev || c.seq >= prev.seq) latest.set(c.recording_id, c)
  }

  const upsertRows: LedgerRow[] = []
  const deleteIds: string[] = []
  for (const c of latest.values()) {
    if (c.op === 'upsert' && c.item) upsertRows.push({ recordingId: c.recording_id, item: c.item })
    else if (c.op === 'delete') deleteIds.push(c.recording_id)
  }

  // 保険 (§7-2): nagisa 側でマウントが外れたまま走査されると全録画が tombstone 化する。
  // 適用せずに中断し、カーソルも進めない (次 run で再挑戦する)。
  //
  // 数えるのは tombstone の件数ではなく「実際に missing になるローカル行」。
  // Workers が追跡していない録画 (nagisa にしか無い作品) の削除で閾値を超えると、
  // 適用しても何も変わらないページの手前で永久に止まってしまう。
  if (deleteIds.length > 0) {
    const counted = await Promise.all(
      chunk(deleteIds, IN_CHUNK).map((part) =>
        prisma.episode.count({ where: { recordingId: { in: part }, recordStatus: 'completed' } })
      )
    )
    const affected = counted.reduce((a, b) => a + b, 0)
    const completed = await prisma.episode.count({ where: { recordStatus: 'completed' } })
    if (affected > MASS_DELETE_MIN && affected > completed * MASS_DELETE_RATIO) {
      logger.error({ action: 'library-mass-delete-abort', deletes: deleteIds.length, affected, completed })
      result.aborted = 'mass_delete'
      return false
    }
  }

  // 作品の tmdbId を先に覚えておくと、同じページの id を持たない行がそれで当たる。
  result.tmdbLearned += await learnTmdbIds(prisma, db, upsertRows)
  const resolved = await resolveEpisodes(prisma, upsertRows)
  const { writes, unmatched } = buildUpsertWrites(upsertRows, resolved, now, owner, false)
  const deleteWrites = deleteIds.map((id) => buildDeleteWrite(id, now, owner))

  // 1 ページの文数の上限 (bootstrap と同じ理由)。変更ログ 100 件でも、1 件が
  // 数千エピソードに解決されればこのページだけで D1 の上限を超える。
  if (writes.length + deleteWrites.length > MAX_WRITES_PER_PAGE) {
    logger.error({
      action: 'library-page-too-large',
      phase: 'changes',
      writes: writes.length,
      deletes: deleteWrites.length
    })
    result.aborted = 'page_too_large'
    return false
  }

  // 書き込む直前の早期脱出 (bootstrap と同じ理由。holdsLease のコメント参照)。
  if (!(await holdsLease(prisma, owner))) {
    logger.warn({ action: 'library-lease-lost', phase: 'changes', page: result.pages })
    result.aborted = 'lease_lost'
    return false
  }

  // upsert を先に、tombstone を後に流す。同じページに `delete B` と `upsert A` が
  // 同居したときは A が残るのが正しい (B を消して A を録り直した)。バッチに割れても
  // この並びは崩れない。
  const applied = await applyBatched(
    db,
    [...writes, ...deleteWrites],
    [
      // fencing: lease を失った run はここで 0 件更新になり、カーソルを進められない。
      // 同じ条件を上の各文にも `leaseGuard` として載せてあるので、エピソード側も
      // 同時に 0 行になる。「書かないなら進めない」が 1 バッチの中で揃う。
      stateWrite(owner, now, PrismaSql.sql`library_cursor = ${body.next_cursor}, last_succeeded_at = ${sqlDate(now)}`)
    ]
  )
  if (fenced(applied, result, 'changes')) return false

  result.upserts += writes.length
  result.deletes += deleteWrites.length
  result.unmatched += unmatched
  result.pages++
  return true
}
