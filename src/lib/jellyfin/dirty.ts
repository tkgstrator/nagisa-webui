/**
 * 「Jellyfin に知らせるべき新規 completed があった」印を立てる raw SQL。
 *
 * 台帳同期の適用バッチ (`applyBatched`) に **カーソル更新と同じバッチ** で載せるため、
 * Prisma の `update` ではなく `Prisma.sql` で組む。カーソルが進んだのに印が立たない、
 * という取りこぼしを作らないための配置 (docs/plans/06-jellyfin-refresh.md §3.2)。
 */

import { Prisma as PrismaSql } from '../../generated/prisma/client.ts'
import type { Write } from '../library-sync/ledger'
import { sqlDate } from '../library-sync/ledger'
import { leaseGuard } from '../library-sync/run'

/** `jellyfin_refresh_state` の唯一の行の key */
export const JELLYFIN_STATE_KEY = 'jellyfin'

/**
 * dirty を立てる 1 文。台帳同期の lease を失った run では 0 行になる (`leaseGuard`)。
 * 行が無いと何もしないので、`syncLibrary` の冒頭で `ensureRefreshState` を呼ぶこと。
 *
 * `dirty_since` は既に立っていれば据え置き (最大待ちの起点)、`last_change_at` は毎回進める
 * (静穏期間の起点)。`dirty_generation` を +1 して、送信中に立った印を成功で消さないようにする。
 */
export const buildDirtyWrite = (owner: string, now: Date): Write =>
  PrismaSql.sql`
    UPDATE jellyfin_refresh_state SET
      dirty_generation = dirty_generation + 1,
      dirty_since = COALESCE(dirty_since, ${sqlDate(now)}),
      last_change_at = ${sqlDate(now)},
      updated_at = ${sqlDate(now)}
    WHERE key = ${JELLYFIN_STATE_KEY} ${leaseGuard(owner, now)}`
