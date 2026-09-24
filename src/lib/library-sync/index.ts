/**
 * nagisa の録画台帳 (GET /api/library/*) を D1 に取り込む。
 *
 * 設計は docs/features/recording-sync.md §7。要点だけ再掲する:
 *
 * - **`completed` を書けるのはこの経路だけ。** キューからジョブが消えたことは
 *   成功を意味しない (スキップ・途中失敗・ワーカー再起動と区別できない)。
 *   ファイルの実在を言えるのは台帳の upsert イベントだけ。
 * - **消失は tombstone でしか書かない。** 「応答に含まれていない」は
 *   ページ切れ・引き損ねと区別できず、1 回の取得失敗で無関係の作品が
 *   丸ごと `missing` になる事故を作る。
 * - **カーソルは不透明トークン**。失効判定は nagisa が 410 / 409 で返す契約で、
 *   Workers 側が中身を解釈すると必ずずれる。
 * - **適用とカーソル保存は同じバッチ**に入れる。先にエピソードを書いてから
 *   カーソルを別 UPDATE すると、間で落ちたぶんが永久に失われる。
 * - **エピソードの書き込みにも lease 条件を付ける** (raw SQL の `EXISTS`)。
 *   カーソル更新だけを fencing しても、横取りされた run の書き込みは
 *   コミットされてしまう (D1 の batch は「0 件更新だからロールバック」ができない)。
 *   同じ条件を同じバッチの全文に載せて初めて「書かないなら進めない」が揃う。
 */

import { NagisaLibraryChangesSchema } from '../../schemas/nagisa.dto'
import type { createPrismaClient } from '../db'
import { getAppLogger } from '../logger'
import { fetchNagisaRaw, NagisaConfigError, type NagisaEnv } from '../nagisa-client'
import { applyChangesPage } from './changes'
import { CHANGES_LIMIT, HEARTBEAT_MS, LEASE_MS, MAX_PAGES_PER_RUN, MAX_WRITES_PER_RUN, SYNC_KEY } from './limits'
import { emptyResult, type LibrarySyncResult, leaseWhere, readErrorCode, writesSoFar } from './run'
import { bootstrapLibrary } from './snapshot'

export type { LibrarySyncResult } from './run'

const logger = getAppLogger('library-sync')

type Prisma = ReturnType<typeof createPrismaClient>

/**
 * 台帳の差分を取り込む。cron (`*​/15`) と手動実行の両方から呼ばれる。
 *
 * throw しない: 失敗は `LibrarySyncResult.error` に載せて呼び出し側が
 * `SyncRun` に記録する。同期が止まったことは `sync_state.last_succeeded_at` と
 * この記録の両方から分かる。
 */
export async function syncLibrary(
  prisma: Prisma,
  env: Partial<NagisaEnv> & { DB: D1Database }
): Promise<LibrarySyncResult> {
  const result = emptyResult()
  const owner = crypto.randomUUID()
  const now = Date.now()

  // 行が無ければ作る。lease の取得は「条件付き updateMany の count」で見る
  // (D1 は単文が原子的なので、これだけで重複起動を弾ける)。
  await prisma.syncState.upsert({ where: { key: SYNC_KEY }, create: { key: SYNC_KEY }, update: {} })
  const got = await prisma.syncState.updateMany({
    where: { key: SYNC_KEY, OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date(now) } }] },
    data: { leaseUntil: new Date(now + LEASE_MS), leaseOwner: owner }
  })
  if (got.count === 0) {
    logger.info({ action: 'library-sync-skipped', reason: 'lease-held' })
    result.skipped = true
    return result
  }

  try {
    const state = await prisma.syncState.findUnique({ where: { key: SYNC_KEY } })
    // bootstrap が終わっていない印は 2 つある。途中のページで止まったなら
    // `snapshotCursor`、最終ページの掃き出しを拒否して止まったなら
    // `snapshotStartedAt` だけが残る (1 ページで終わる台帳では前者が null)。
    // 片方しか見ないと、後者が差分同期に切り替わって削除を取りこぼす。
    if (state?.snapshotCursor || state?.snapshotStartedAt) {
      await bootstrapLibrary(prisma, env.DB, env as NagisaEnv, owner, 'resume', result)
      return result
    }
    if (!state?.libraryCursor) {
      await bootstrapLibrary(prisma, env.DB, env as NagisaEnv, owner, 'initial', result)
      return result
    }

    let cursor = state.libraryCursor
    for (let page = 0; page < MAX_PAGES_PER_RUN; page++) {
      const qs = new URLSearchParams({ cursor, limit: String(CHANGES_LIMIT) })
      const res = await fetchNagisaRaw(env as NagisaEnv, `/api/library/changes?${qs.toString()}`)

      // カーソルが通用しなくなった。差分では埋められないので頭から引き直す。
      if (res.status === 410 || res.status === 409) {
        const code = await readErrorCode(res)
        logger.warn({ action: 'library-cursor-invalid', status: res.status, code })
        await bootstrapLibrary(prisma, env.DB, env as NagisaEnv, owner, code, result)
        return result
      }
      if (!res.ok) {
        result.error = `changes ${res.status}: ${await readErrorCode(res)}`
        return result
      }

      const body = NagisaLibraryChangesSchema.parse(await res.json())

      if (body.changes.length === 0) {
        // 変更なしの tick は 1 行も書かない (§7-4)。停止検出のための
        // lastSucceededAt だけ 1 時間に 1 回だけ更新する。
        const stale = !state.lastSucceededAt || Date.now() - state.lastSucceededAt.getTime() > HEARTBEAT_MS
        if (stale) {
          const beat = new Date()
          await prisma.syncState.updateMany({
            where: leaseWhere(owner, beat),
            data: { libraryCursor: body.next_cursor, lastSucceededAt: beat }
          })
        }
        break
      }

      if (!(await applyChangesPage(prisma, env.DB, body, owner, result))) break
      cursor = body.next_cursor
      if (!body.has_more) break
      // 文数の実測で打ち切る (ページ数だけでは抑えきれない。定数のコメント参照)。
      if (writesSoFar(result) >= MAX_WRITES_PER_RUN) {
        logger.info({ action: 'library-changes-budget', upserts: result.upserts, deletes: result.deletes })
        break
      }
    }
    return result
  } catch (e) {
    if (e instanceof NagisaConfigError) {
      logger.error({ action: 'library-sync-config-missing', missing: e.missing })
      result.error = e.message
      return result
    }
    logger.error({ action: 'library-sync-error', error: e instanceof Error ? e.message : String(e) })
    result.error = e instanceof Error ? e.message : String(e)
    return result
  } finally {
    // lease は必ず返す。返せなくても LEASE_MS 後には他の run が横取りできる。
    await prisma.syncState
      .updateMany({ where: { key: SYNC_KEY, leaseOwner: owner }, data: { leaseUntil: null, leaseOwner: null } })
      .catch(() => undefined)
  }
}
