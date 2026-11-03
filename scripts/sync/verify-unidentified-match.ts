#!/usr/bin/env bun
/**
 * 正規化の改善で unidentified_anime のうち anilist_media に当たる件数がどれだけ増えるかを数える (readonly)。
 *
 * - legacy: 旧 normalizeTitle (全角ASCII のみ半角化 + 記号許可リスト除去) と、保存済み *_norm 列での照合
 * - new   : 新 normalizeTitle (NFKC) を title_* から再計算した照合 (*_norm 再計算後の状態を再現)
 * どちらも生タイトルと cleanTitle 後の両方で試す (local-anilist.ts と同じ)。
 *
 * Usage: bun scripts/sync/verify-unidentified-match.ts
 */
import { Database } from 'bun:sqlite'
import { readdirSync } from 'node:fs'
import { cleanTitle } from '../../src/lib/metadata/anilist'
import { normalizeTitle } from '../../src/lib/metadata/normalize'

const D1_DIR = '.wrangler/state/v3/d1/miniflare-D1DatabaseObject'
const file = readdirSync(D1_DIR).find((f) => f.endsWith('.sqlite') && f !== 'metadata.sqlite')
if (!file) throw new Error('local D1 sqlite not found')
const db = new Database(`${D1_DIR}/${file}`, { readonly: true })

function legacyNormalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[\s　]+/g, '')
    .replace(/[!?.,'"():;\-—–~～「」『』【】［］[\]()<>＜＞{}・･♡♥★☆♪♫※/\\|]/g, '')
    .replace(/[。、，．]/g, '')
}

interface Media {
  title_native: string | null
  title_romaji: string | null
  title_english: string | null
  native_norm: string | null
  romaji_norm: string | null
  english_norm: string | null
  season_year: number | null
  start_year: number | null
  title_native_present: number
}
const media = db
  .query<Media, []>(
    'SELECT title_native, title_romaji, title_english, native_norm, romaji_norm, english_norm, season_year, start_year, (title_native IS NOT NULL) AS title_native_present FROM anilist_media'
  )
  .all()
const unidentified = db
  .query<{ provider: string; title: string }, []>('SELECT provider, title FROM unidentified_anime')
  .all()

const legacyKeys = new Set(media.flatMap((m) => [m.native_norm, m.romaji_norm, m.english_norm]).filter(Boolean))
const newKeys = new Set(
  media.flatMap((m) => [m.title_native, m.title_romaji, m.title_english].map((t) => normalizeTitle(t))).filter(Boolean)
)

const hit = (keys: Set<string | null>, norm: (s: string) => string, title: string): boolean => {
  const raw = norm(title)
  if (raw && keys.has(raw)) return true
  const cleaned = norm(cleanTitle(title))
  return Boolean(cleaned && cleaned !== raw && keys.has(cleaned))
}

const legacyHit = unidentified.filter((u) => hit(legacyKeys, legacyNormalize, u.title))
const newHit = unidentified.filter((u) => hit(newKeys, normalizeTitle, u.title))
const legacySet = new Set(legacyHit.map((u) => `${u.provider}\t${u.title}`))
const gained = newHit.filter((u) => !legacySet.has(`${u.provider}\t${u.title}`))
const newSet = new Set(newHit.map((u) => `${u.provider}\t${u.title}`))
const lost = legacyHit.filter((u) => !newSet.has(`${u.provider}\t${u.title}`))

console.log(`anilist_media=${media.length} unidentified_anime=${unidentified.length}`)
console.log(`legacy match: ${legacyHit.length}`)
console.log(`new match   : ${newHit.length} (gained ${gained.length}, lost ${lost.length})`)
console.log('gained samples:', gained.slice(0, 8).map((u) => u.title))
if (lost.length > 0) console.log('lost samples:', lost.slice(0, 8).map((u) => u.title))
db.close()
