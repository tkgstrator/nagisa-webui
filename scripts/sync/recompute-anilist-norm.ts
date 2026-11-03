#!/usr/bin/env bun
/**
 * anilist_media の *_norm を現在の normalizeTitle で再計算する。
 * 正規化関数 (src/lib/metadata/normalize.ts) を変えたあとに実行する。
 *
 * 既定は dry-run (件数を数えるだけ)。本番 D1 へは直接書かない。
 *
 * Usage:
 *   bun scripts/sync/recompute-anilist-norm.ts                    # ローカル D1 を dry-run
 *   bun scripts/sync/recompute-anilist-norm.ts --apply            # ローカル D1 を更新
 *   bun scripts/sync/recompute-anilist-norm.ts --sql-out=/tmp/norm.sql
 *       # 変更行だけの UPDATE 文を書き出す (リモート D1 には wrangler d1 execute --file で別途適用)
 */
import { Database } from 'bun:sqlite'
import { existsSync, readdirSync, writeFileSync } from 'node:fs'
import { normalizeTitle } from '../../src/lib/metadata/normalize'

const D1_DIR = '.wrangler/state/v3/d1/miniflare-D1DatabaseObject'

function findLocalDb(): string {
  const file = readdirSync(D1_DIR).find((f) => f.endsWith('.sqlite') && f !== 'metadata.sqlite')
  if (!file) throw new Error(`local D1 sqlite not found in ${D1_DIR}`)
  return `${D1_DIR}/${file}`
}

interface Row {
  id: number
  title_native: string | null
  title_romaji: string | null
  title_english: string | null
  native_norm: string | null
  romaji_norm: string | null
  english_norm: string | null
}

const args = process.argv.slice(2)
const apply = args.includes('--apply')
const sqlOut = args.find((a) => a.startsWith('--sql-out='))?.slice('--sql-out='.length)
const dbPath = findLocalDb()
if (!existsSync(dbPath)) throw new Error(`not found: ${dbPath}`)

const db = new Database(dbPath, apply ? undefined : { readonly: true })
const rows = db
  .query<Row, []>(
    'SELECT id, title_native, title_romaji, title_english, native_norm, romaji_norm, english_norm FROM anilist_media'
  )
  .all()

const next = (s: string | null) => normalizeTitle(s) || null
const changed = rows.flatMap((r) => {
  const n = { native: next(r.title_native), romaji: next(r.title_romaji), english: next(r.title_english) }
  const same = n.native === r.native_norm && n.romaji === r.romaji_norm && n.english === r.english_norm
  return same ? [] : [{ id: r.id, ...n }]
})

console.log(`db=${dbPath}`)
console.log(`anilist_media rows=${rows.length} changed=${changed.length}`)

const sqlStr = (v: string | null) => (v === null ? 'NULL' : `'${v.replaceAll("'", "''")}'`)
const toSql = (c: (typeof changed)[number]) =>
  `UPDATE anilist_media SET native_norm=${sqlStr(c.native)}, romaji_norm=${sqlStr(c.romaji)}, english_norm=${sqlStr(c.english)} WHERE id=${c.id};`

if (sqlOut) {
  writeFileSync(sqlOut, `${changed.map(toSql).join('\n')}\n`)
  console.log(`wrote ${changed.length} statements to ${sqlOut}`)
}

if (apply) {
  const stmt = db.prepare('UPDATE anilist_media SET native_norm=?, romaji_norm=?, english_norm=? WHERE id=?')
  db.transaction(() => {
    for (const c of changed) stmt.run(c.native, c.romaji, c.english, c.id)
  })()
  console.log('applied to local D1')
} else {
  console.log('dry-run (use --apply to update the local D1)')
}
db.close()
