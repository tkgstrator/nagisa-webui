/**
 * wrangler d1 export が吐いた .sql を、ローカル (miniflare) の D1 に流し込む。
 *
 * リモートに毎回問い合わせると遅いので、実データを一度ローカルに落としてから
 * 解析スクリプトを回すためのもの。sqlite3 CLI が無い環境向けに bun:sqlite で処理する。
 *
 * 既存のローカル DB は上書きされる。実行前に .cache/ へバックアップを取る。
 *
 * 使い方: bun run scripts/analysis/import-d1-dump.ts [.sql のパス]
 */
import { copyFileSync, createReadStream, statSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { Database } from 'bun:sqlite'

const SQL = process.argv[2] ?? '.cache/staging.sql'
const D1 =
  '.wrangler/state/v3/d1/miniflare-D1DatabaseObject/c289ae8601b8c4b5b07e7123fe2ec79ba670a1ad0ce6f48c80d8b0b231d2555f.sqlite'
const BACKUP = '.cache/miniflare-d1.backup.sqlite'

/** miniflare 自身が使うテーブル。ダンプには含まれないので消さない */
const KEEP = new Set(['_cf_METADATA', 'sqlite_sequence'])

copyFileSync(D1, BACKUP)
process.stderr.write(`backup: ${BACKUP} (${(statSync(BACKUP).size / 1024 / 1024).toFixed(0)} MiB)\n`)

const db = new Database(D1)
db.run('PRAGMA foreign_keys=OFF')
db.run('PRAGMA journal_mode=OFF')
db.run('PRAGMA synchronous=OFF')

// ダンプは CREATE TABLE IF NOT EXISTS なので、既存テーブルが残っていると
// 古い行とダンプの行が混ざる。先に落とす。
const tables = db
  .query<{ name: string }, []>("select name from sqlite_master where type='table'")
  .all()
  .map((r) => r.name)
  .filter((n) => !KEEP.has(n) && !n.startsWith('sqlite_'))
for (const t of tables) db.run(`DROP TABLE IF EXISTS "${t}"`)
process.stderr.write(`dropped: ${tables.join(', ')}\n`)

/**
 * ダンプは 1 文 1 行だが、TEXT 値に改行が入っていると行がまたがる。
 * 「行末が ; で、かつ蓄積分のシングルクォート数が偶数」を文の終端とみなす。
 * SQLite のダンプは値内のクォートを '' に倍化するので、この判定で足りる。
 */
const quotes = (s: string): number => {
  let n = 0
  for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) === 39) n++
  return n
}

const rl = createInterface({ input: createReadStream(SQL, 'utf8'), crlfDelay: Number.POSITIVE_INFINITY })

let buf = ''
let q = 0
let count = 0
db.run('BEGIN')
for await (const line of rl) {
  buf = buf === '' ? line : `${buf}\n${line}`
  q += quotes(line)
  if (!line.endsWith(';') || q % 2 !== 0) continue

  db.run(buf)
  buf = ''
  q = 0
  if (++count % 200_000 === 0) {
    db.run('COMMIT')
    db.run('BEGIN')
    process.stderr.write(`${count.toLocaleString()} statements\n`)
  }
}
if (buf.trim() !== '') db.run(buf)
db.run('COMMIT')

process.stderr.write(`applied ${count.toLocaleString()} statements\n`)
for (const t of ['anime', 'episodes', 'seasons', 'unidentified_anime']) {
  const n = db.query<{ n: number }, []>(`select count(*) n from ${t}`).get()?.n ?? 0
  process.stderr.write(`  ${t.padEnd(20)} ${n.toLocaleString()}\n`)
}
db.close()
