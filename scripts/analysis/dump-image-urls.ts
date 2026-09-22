/**
 * D1 から画像 URL の一覧を引いて TSV (url\tsource\trowid) に落とす。
 *
 * 既定は local。import-d1-dump.ts で staging のダンプを流し込んだ後なら、
 * ローカルの miniflare D1 が staging の完全な複製になっているので、
 * リモートに毎回問い合わせる必要はない (229,144 件で一致するのを確認済み)。
 * 取り込み前のローカル DB は開発用のごく一部しか持たないため、母数に使わないこと。
 *
 * wrangler の 1 レスポンスに収まる件数が読めないため、リモートでは rowid でページングする。
 * 途中で落ちても TSV は追記済みなので、消さずに再実行すれば続きから引く。
 *
 * 使い方: bun run scripts/analysis/dump-image-urls.ts [local|staging|production]
 */
import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import { Database } from 'bun:sqlite'

const ENV = process.argv[2] ?? 'local'
const LOCAL_D1 =
  '.wrangler/state/v3/d1/miniflare-D1DatabaseObject/c289ae8601b8c4b5b07e7123fe2ec79ba670a1ad0ce6f48c80d8b0b231d2555f.sqlite'
const OUT = '.cache/image-urls.tsv'
const PAGE = 10_000
const TABLES = ['anime', 'episodes', 'unidentified_anime'] as const

/** 再開用。url は重複しうる (テーブル間) ので、行単位ではなく url で覚える */
const seen = new Set<string>()
/** 最後まで引き終えたテーブル。中断したテーブルは rowid の続きから再開する */
const lastRowid = new Map<string, number>()
if (existsSync(OUT)) {
  for (const line of readFileSync(OUT, 'utf8').split('\n')) {
    if (!line) continue
    const [url, source, rowid] = line.split('\t')
    if (url) seen.add(url)
    if (source && rowid) lastRowid.set(source, Math.max(lastRowid.get(source) ?? 0, Number(rowid)))
  }
  process.stderr.write(`resume: ${seen.size} urls already dumped\n`)
}

const db = ENV === 'local' ? new Database(LOCAL_D1, { readonly: true }) : null

async function query(sql: string): Promise<Array<Record<string, unknown>>> {
  if (db !== null) return db.query<Record<string, unknown>, []>(sql).all()
  const proc = Bun.spawn(
    ['bunx', 'wrangler', 'd1', 'execute', `anime-tracker-${ENV}`, '--remote', '--json', '--command', sql],
    { stdout: 'pipe', stderr: 'ignore' }
  )
  const out = await new Response(proc.stdout).text()
  if ((await proc.exited) !== 0) throw new Error(`wrangler failed: ${sql.slice(0, 80)}`)
  return (JSON.parse(out) as Array<{ results: Array<Record<string, unknown>> }>)[0].results
}

for (const table of TABLES) {
  let after = lastRowid.get(table) ?? 0
  for (;;) {
    const rows = await query(
      `select rowid r, image_url u from ${table}
       where rowid > ${after} and image_url is not null and image_url != ''
       order by rowid limit ${PAGE}`
    )
    if (rows.length === 0) break

    let added = 0
    let chunk = ''
    for (const row of rows) {
      const url = row.u as string
      after = row.r as number
      if (seen.has(url)) continue
      seen.add(url)
      chunk += `${url}\t${table}\t${after}\n`
      added++
    }
    // 中断しても rowid を見失わないよう、追加が無いページでも位置だけは残す
    if (chunk === '') chunk = `\t${table}\t${after}\n`
    appendFileSync(OUT, chunk)
    process.stderr.write(`${table}: rowid<=${after} (+${added}, total ${seen.size})\n`)
    if (rows.length < PAGE) break
  }
}

process.stderr.write(`done: ${seen.size} distinct urls -> ${OUT}\n`)
