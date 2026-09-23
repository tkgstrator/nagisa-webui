import type { Prisma as PrismaSql } from '../../generated/prisma/client.ts'
import type { NagisaLibraryItem } from '../../schemas/nagisa.dto'
import type { createPrismaClient } from '../db'
import { IN_CHUNK } from './limits'

type Prisma = ReturnType<typeof createPrismaClient>

/** `IN (...)` を D1 の bound parameter 上限に収めるために分ける。 */
export function chunk<T>(xs: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < xs.length; i += size) out.push(xs.slice(i, i + size))
  return out
}

/**
 * Prisma (D1 adapter) が DateTime 列に書く表現。raw SQL 側もこれに揃える。
 *
 * 実測すると D1 上の型は **TEXT** で、値は `2026-09-23T06:04:55.174+00:00` の形。
 * epoch ms の INTEGER ではないので、raw で日時を比較するときに
 * `Date.now()` をそのまま渡すと常に偽になる。オフセットは `+00:00` 固定・
 * 桁数も固定なので、この形どうしなら辞書順がそのまま時刻順になる
 * (`toISOString()` の `Z` のままだと `+` と綴りが変わって境界がずれる)。
 */
export const sqlDate = (d: Date): string => d.toISOString().replace('Z', '+00:00')

/**
 * 掃き出しの基準時刻より **確実に後** の時刻を作る。
 *
 * 在籍判定は `record_synced_at <= sweepFrom` なら掃く、で書いてある。等号を
 * 含めるのは、基準時刻ちょうどに書かれた行 (前回の run が同じミリ秒で落ちた等)
 * を取りこぼさないため。そのぶん、**今回のページが書く時刻は基準時刻と
 * 同じであってはならない**。基準を置いた直後にページが返ってくると同じ
 * ミリ秒になりうるので、ここで 1ms だけ進めておく。
 */
export const stamp = (after: Date): Date => new Date(Math.max(Date.now(), after.getTime() + 1))

/** nagisa の mtime は ISO 8601 文字列。壊れていたら null にして同期は止めない。 */
export function parseMtime(mtime: string | null): Date | null {
  if (!mtime) return null
  const d = new Date(mtime)
  return Number.isNaN(d.getTime()) ? null : d
}

/** バイトだと 2GB で Int が溢れるので MB に落とす (schema のコメント参照)。 */
export const toMb = (size: number): number => Math.round(size / 1024 / 1024)

/** 台帳の 1 行を D1 のエピソードに対応づけるためのキー。 */
export type MatchKey = string
export const matchKey = (provider: string, contentId: string, episodeId: string): MatchKey =>
  `${provider}\u0000${contentId}\u0000${episodeId}`

export interface LedgerRow {
  recordingId: string
  item: NagisaLibraryItem
}

/** `$transaction([...])` に並べる 1 文。raw も updateMany も同じ形で扱える。 */
export type Write = PrismaSql.PrismaPromise<unknown>

/**
 * 同じエピソードを指す台帳行が 2 つあったとき、`candidate` が `held` に勝つか。
 *
 * 新しい実体を正とする (= `mtime` の新しい方)。`mtime` が読めない行は負ける:
 * 消えかけのファイルや壊れたメタデータを、読めた行より優先する理由が無い。
 * 両方読めないときと同着は `recording_id` の大きい方 — 意味は無いが、
 * **ページの並びが変わっても同じ勝者になる**ことだけが要る。
 */
export function beatsCurrent(candidate: LedgerRow, held: LedgerRow): boolean {
  const a = parseMtime(candidate.item.mtime)?.getTime()
  const b = parseMtime(held.item.mtime)?.getTime()
  if (a !== b) {
    if (a === undefined) return false
    if (b === undefined) return true
    return a > b
  }
  return candidate.recordingId > held.recordingId
}

/**
 * 台帳の行に対応する D1 のエピソード id を引く。
 *
 * `episode_id` は indexed なので IN 1 本で引き、provider / content_id の一致は
 * JS 側で確かめる。relation filter を `updateMany` の where に書くと
 * Prisma が暗黙の SELECT を挟み、`$transaction([...])` の原子性が崩れる。
 */
export async function resolveEpisodes(prisma: Prisma, rows: LedgerRow[]): Promise<Map<MatchKey, string[]>> {
  const episodeIds = [...new Set(rows.map((r) => r.item.episode_id).filter((v): v is string => !!v))]
  if (episodeIds.length === 0) return new Map()

  const pages = await Promise.all(
    chunk(episodeIds, IN_CHUNK).map((part) =>
      prisma.episode.findMany({
        where: { episodeId: { in: part } },
        select: {
          id: true,
          episodeId: true,
          season: { select: { anime: { select: { provider: true, contentId: true } } } }
        }
      })
    )
  )
  const found = pages.flat()

  const byKey = new Map<MatchKey, string[]>()
  for (const e of found) {
    const anime = e.season?.anime
    if (!anime) continue
    const key = matchKey(anime.provider, anime.contentId, e.episodeId)
    const list = byKey.get(key)
    if (list) list.push(e.id)
    else byKey.set(key, [e.id])
  }
  return byKey
}
