import { Prisma as PrismaSql } from '../../generated/prisma/client.ts'
import type { createPrismaClient } from '../db'
import { getAppLogger } from '../logger'
import { applyStatements, chunk, sqlDate, type Write } from './ledger'
import { MAX_WRITES_PER_BATCH, SYNC_KEY } from './limits'

const logger = getAppLogger('library-sync')

type Prisma = ReturnType<typeof createPrismaClient>

export interface LibrarySyncResult {
  /** lease を取れずに何もしなかった */
  skipped: boolean
  /** bootstrap が走った理由。走らなければ null */
  bootstrap: string | null
  pages: number
  upserts: number
  deletes: number
  /** 該当するエピソードが D1 に無かったイベント数 (§7-5) */
  unmatched: number
  /** 台帳から覚え直した作品の tmdbId の数 (`learnTmdbIds`) */
  tmdbLearned: number
  aborted: string | null
  error: string | null
}

export const emptyResult = (): LibrarySyncResult => ({
  skipped: false,
  bootstrap: null,
  pages: 0,
  upserts: 0,
  deletes: 0,
  unmatched: 0,
  tmdbLearned: 0,
  aborted: null,
  error: null
})

/** この run で発行済みの UPDATE 文の数。bootstrap と差分適用で共有する。 */
export const writesSoFar = (r: LibrarySyncResult): number => r.upserts + r.deletes

/**
 * エピソード更新に付ける fencing 条件。**バインドは 2 個** (owner と期限)。
 *
 * カーソル更新側の `leaseWhere` と同じことを SQL で書いたもの。同じバッチに
 * 入れた全文がこの条件を共有するので、lease を失った run は
 * 「エピソードも書かない・カーソルも進めない」のどちらも成立する。
 * Prisma の `updateMany` では relation でない列の EXISTS を書けないため、
 * ここだけ raw SQL を使う。
 */
export const leaseGuard = (owner: string, now: Date) =>
  PrismaSql.sql`AND EXISTS (SELECT 1 FROM sync_state WHERE key = 'library' AND lease_owner = ${owner} AND lease_until > ${sqlDate(now)})`

/**
 * lease をまだ握っているかを確かめる。
 *
 * **正しさを担保しているのはこれではない** (書き込み側の `leaseGuard` が担う)。
 * ここで見るのは「無駄な往復を早めに切り上げる」ためと、掃き出しの比率ガードを
 * 誤爆させないため。横取りされた run は仮にここを通っても 1 行も書けない。
 */
export async function holdsLease(prisma: Prisma, owner: string): Promise<boolean> {
  const s = await prisma.syncState.findUnique({
    where: { key: SYNC_KEY },
    select: { leaseOwner: true, leaseUntil: true }
  })
  return s?.leaseOwner === owner && s.leaseUntil !== null && s.leaseUntil.getTime() > Date.now()
}

/**
 * `sync_state` を書くときの fencing 条件。所有者だけでなく **期限も** 見る。
 * owner 条件だけだと、誰も横取りしないまま期限切れになった run (Worker が長く
 * 詰まった等) が自分の名義のまま書けてしまい、holdsLease の判定とカーソル更新の
 * 判定がずれる。`leaseUntil` が null の行もこの条件で弾ける。
 */
export const leaseWhere = (owner: string, now: Date) => ({ key: SYNC_KEY, leaseOwner: owner, leaseUntil: { gt: now } })

/**
 * 1 ページぶんの書き込みを流す。文が多い回だけ複数の `batch()` に割り、
 * **カーソル更新 (`tail`) は必ず最後のバッチに置く**。返すのは最後のバッチの
 * 結果で、`fenced` はそれを見る。
 *
 * 分割するとページ単位の原子性は失われるが、取りこぼしは作らない: カーソルは
 * 最後のバッチでしか動かないので、途中で落ちた回は次 run が同じページを読み
 * 直す。upsert / tombstone はどちらも同じ値を書き直すだけの冪等な文なので、
 * 前半を二度適用しても結果は変わらない。
 *
 * **分割した回の `fenced` の意味は少し弱い**。1 バッチだったころは「tail が 0 件
 * = このページは 1 行も書いていない」と言えたが、分割後に言えるのは
 * 「**カーソルを進めていない**」まで。lease を途中で横取りされた run は、
 * 横取りより前のバッチだけ残して降りる。その前半は *まだ lease を持っていた
 * 時点の* 書き込みなので不正ではなく、しかも冪等なので新しい所有者が同じ
 * ページを読み直せば上書きされる。
 */
export async function applyBatched(db: D1Database, writes: Write[], tail: Write[]): Promise<D1Result[]> {
  // tail のぶんを引いて割る。引かないと最後のバッチだけ上限 + tail 件になる。
  const batches = chunk(writes, Math.max(1, MAX_WRITES_PER_BATCH - tail.length))
  if (batches.length === 0) batches.push([])
  let applied: D1Result[] = []
  for (let i = 0; i < batches.length; i++) {
    const batch = i === batches.length - 1 ? [...batches[i], ...tail] : batches[i]
    if (batch.length === 0) continue
    applied = await applyStatements(db, batch)
  }
  return applied
}

/**
 * `sync_state` を lease 付きで書き換える 1 文 (`leaseWhere` の raw 版)。
 * エピソード更新と同じ `batch()` に並べるため Prisma の `updateMany` は使えない。
 * `updated_at` は `@updatedAt` 列なので自前で入れる。
 */
export const stateWrite = (owner: string, now: Date, set: PrismaSql.Sql): Write =>
  PrismaSql.sql`UPDATE sync_state SET ${set}, updated_at = ${sqlDate(new Date())}
    WHERE key = 'library' AND lease_owner = ${owner} AND lease_until > ${sqlDate(now)}`

/**
 * 適用バッチの結果から「lease を失ったまま実行されたか」を見る。
 *
 * バッチの最後に置いた `stateWrite` が 0 件なら、同じバッチの
 * エピソード更新も (同じ `leaseGuard` を共有しているので) 1 行も書いていない。
 * つまり **何も起きなかった** ことが確定する。復旧処理は要らず、降りるだけでよい。
 */
export function fenced(applied: D1Result[], result: LibrarySyncResult, phase: string): boolean {
  const last = applied.at(-1)
  const count = last ? last.meta.changes : 1
  if (count > 0) return false
  logger.warn({ action: 'library-lease-lost', phase })
  result.aborted = 'lease_lost'
  return true
}

/** 410 / 409 の本文から nagisa のエラーコードを拾う (ログ用。判定はステータスで行う)。 */
export async function readErrorCode(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: unknown }
    return typeof body.error === 'string' ? body.error : `http_${res.status}`
  } catch {
    return `http_${res.status}`
  }
}
