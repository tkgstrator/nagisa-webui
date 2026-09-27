import { Prisma as PrismaSql } from '../../generated/prisma/client.ts'
import type { NagisaLibraryItem } from '../../schemas/nagisa.dto'
import type { createPrismaClient } from '../db'
import { IN_CHUNK } from './limits'

type Prisma = ReturnType<typeof createPrismaClient>

/** `Write` を D1 の `batch()` で 1 往復にまとめて流す。文が無ければ何もしない。 */
export async function applyStatements(db: D1Database, writes: Write[]): Promise<D1Result[]> {
  if (writes.length === 0) return []
  return db.batch(writes.map((w) => db.prepare(w.sql).bind(...w.values)))
}

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

/**
 * episode_id を持たない台帳行のためのキー。`matchKey` とは先頭の印で区別する
 * (provider 名に NUL は入らないので衝突しない)。
 */
export const tmdbKey = (provider: string, tmdbId: number, season: number, episode: number): MatchKey =>
  `\u0000tmdb\u0000${provider}\u0000${tmdbId}\u0000${season}\u0000${episode}`

/** nagisa が provider を決められなかった行の値。TMDb 経由でも引き当てない。 */
const UNKNOWN_PROVIDER = 'unknown'

/**
 * 台帳の 1 行を引き当てるキー。引き当てようが無ければ null。
 *
 * id が揃っていればそれが正。揃っていない行 (TMDb 名のフォルダに入った
 * Hulu / ABEMA / Crunchyroll の旧録画など — content_id はディスクに残らない) は、
 * フォルダ名に残った tmdb_id とファイル名の SxxEyy で引く。
 */
export function rowKey(item: NagisaLibraryItem): MatchKey | null {
  const { provider, content_id, episode_id, tmdb_id, season_number, episode_number } = item
  if (content_id && episode_id) return matchKey(provider, content_id, episode_id)
  if (provider === UNKNOWN_PROVIDER || tmdb_id == null || season_number == null || episode_number == null) return null
  return tmdbKey(provider, tmdb_id, season_number, episode_number)
}

/** TMDb 経由の候補 1 件。`indexTmdbEpisodes` の入力。 */
export interface TmdbCandidate {
  id: string
  provider: string
  tmdbId: number
  seasonNumber: number
  episodeNumber: number
}

/**
 * TMDb 経由の候補をキーで束ねる。**1 つのキーに 2 件以上当たったら捨てる**。
 *
 * 1 つの tmdbId には複数の作品が載りうる (Amazon のシーズン別 ASIN、同じ作品の
 * 重複登録)。シーズン番号と話数まで揃えても割れるなら、どれが録画なのかは
 * 台帳の側にも分からない。当て推量で `completed` を書くより unmatched に残す。
 */
export function indexTmdbEpisodes(found: TmdbCandidate[]): Map<MatchKey, string[]> {
  const byKey = new Map<MatchKey, string[]>()
  for (const e of found) {
    const key = tmdbKey(e.provider, e.tmdbId, e.seasonNumber, e.episodeNumber)
    const list = byKey.get(key)
    if (list) list.push(e.id)
    else byKey.set(key, [e.id])
  }
  for (const [key, ids] of byKey) if (ids.length > 1) byKey.delete(key)
  return byKey
}

export interface LedgerRow {
  recordingId: string
  item: NagisaLibraryItem
}

/**
 * D1 の `batch()` に並べる 1 文。`Prisma.sql` で組み立て、`applyBatched` が
 * `?` プレースホルダの文に直して流す。
 *
 * `$transaction([...])` は使わない。D1 adapter のトランザクションは名ばかりで
 * (文を 1 本ずつ別に投げ、commit / rollback は何もしない)、しかも Prisma 側の
 * 既定 5 秒の期限だけは掛かる。300 文を積むと往復だけで期限を越え、
 * 途中まで書いたところで毎回落ちていた。`batch()` なら 1 往復で済み、
 * 本当に原子的になる。
 */
export type Write = PrismaSql.Sql

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
 * Prisma が暗黙の SELECT を挟み、同じ `batch()` に並べられなくなる。
 * (ここは読むだけなので relation filter を使ってよい。)
 */
export async function resolveEpisodes(prisma: Prisma, rows: LedgerRow[]): Promise<Map<MatchKey, string[]>> {
  const [byId, byTmdb] = await Promise.all([resolveById(prisma, rows), resolveByTmdb(prisma, rows)])
  for (const [key, ids] of byTmdb) byId.set(key, ids)
  return byId
}

async function resolveById(prisma: Prisma, rows: LedgerRow[]): Promise<Map<MatchKey, string[]>> {
  const episodeIds = [
    ...new Set(
      rows
        .filter((r) => r.item.content_id)
        .map((r) => r.item.episode_id)
        .filter((v): v is string => !!v)
    )
  ]
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

/**
 * `rowKey` が TMDb 経由のキーを返した行を引く。作品の `tmdbId` は
 * `learnTmdbIds` が台帳から覚えたものなので、学ぶ前の作品には当たらない。
 */
async function resolveByTmdb(prisma: Prisma, rows: LedgerRow[]): Promise<Map<MatchKey, string[]>> {
  const tmdbIds = new Set<number>()
  for (const { item } of rows) {
    if (item.tmdb_id != null && rowKey(item)?.startsWith('\u0000tmdb')) tmdbIds.add(item.tmdb_id)
  }
  if (tmdbIds.size === 0) return new Map()

  const pages = await Promise.all(
    chunk([...tmdbIds], IN_CHUNK).map((part) =>
      prisma.episode.findMany({
        where: { season: { anime: { tmdbId: { in: part } } } },
        select: {
          id: true,
          episodeNumber: true,
          season: { select: { seasonNumber: true, anime: { select: { provider: true, tmdbId: true } } } }
        }
      })
    )
  )
  const found: TmdbCandidate[] = []
  for (const e of pages.flat()) {
    const anime = e.season?.anime
    if (anime?.tmdbId == null) continue
    found.push({
      id: e.id,
      provider: anime.provider,
      tmdbId: anime.tmdbId,
      seasonNumber: e.season.seasonNumber,
      episodeNumber: e.episodeNumber
    })
  }
  return indexTmdbEpisodes(found)
}

/**
 * 台帳が `(provider, content_id)` と `tmdb_id` を **両方** 持っている行から、
 * 作品の `tmdbId` を覚える。
 *
 * どちらも pipeline が選んだ値 (content_id は登録時、tmdb_id は出力先フォルダ) なので
 * タイトル検索の推測より確か。食い違っていれば台帳で上書きする。同じフォルダの
 * id を持たない旧録画は、ここで覚えた tmdbId を足場に `resolveByTmdb` で当たる。
 *
 * 書くのは作品のメタデータだけで録画状態には触れないので、lease の外で先に
 * 流してよい (二重に走っても同じ値を書くだけ)。ページを跨いだ足場は
 * 次の bootstrap で拾われる。
 */
export async function learnTmdbIds(prisma: Prisma, db: D1Database, rows: LedgerRow[]): Promise<number> {
  const wanted = new Map<string, { provider: string; contentId: string; tmdbId: number }>()
  for (const { item } of rows) {
    if (item.provider === UNKNOWN_PROVIDER || !item.content_id || item.tmdb_id == null) continue
    wanted.set(`${item.provider}\u0000${item.content_id}`, {
      provider: item.provider,
      contentId: item.content_id,
      tmdbId: item.tmdb_id
    })
  }
  if (wanted.size === 0) return 0

  const contentIds = [...new Set([...wanted.values()].map((w) => w.contentId))]
  const pages = await Promise.all(
    chunk(contentIds, IN_CHUNK).map((part) =>
      prisma.anime.findMany({
        where: { contentId: { in: part } },
        select: { id: true, provider: true, contentId: true, tmdbId: true }
      })
    )
  )
  const stale = pages.flat().flatMap((a) => {
    const w = wanted.get(`${a.provider}\u0000${a.contentId}`)
    return w && w.tmdbId !== a.tmdbId ? [{ id: a.id, tmdbId: w.tmdbId }] : []
  })
  if (stale.length === 0) return 0

  // updated_at は Prisma の @updatedAt が書く列なので、raw では自前で入れる。
  const now = sqlDate(new Date())
  await applyStatements(
    db,
    stale.map((a) => PrismaSql.sql`UPDATE anime SET tmdb_id = ${a.tmdbId}, updated_at = ${now} WHERE id = ${a.id}`)
  )
  return stale.length
}
