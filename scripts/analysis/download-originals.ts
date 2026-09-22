/**
 * D1 に登録済みの全画像について、元バイナリを .cache/originals/ に落とす。
 *
 * 保存名は src/lib/image-key.ts の imageBaseKey (URL の UUIDv5) なので、
 * ローカルのファイルと R2 のキーが 1:1 で対応する。幅リストを変えたときは
 * ここから再変換して R2 に流し込める。
 *
 * ディレクトリは UUID 先頭 2 桁で 256 分割する。22 万ファイルを 1 つの
 * ディレクトリに置くと ls も readdir も現実的でなくなるため。
 *
 * 結果は NDJSON に逐次追記するので、途中で打ち切っても再実行で続きから走る。
 * 失敗した URL は成功するまで毎回再試行される (404 は既定で諦める)。
 *
 * 使い方: bun run scripts/analysis/download-originals.ts [--retry-404]
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { imageBaseKey } from '../../src/lib/image-key'
import { download, hostOf, viaProxy } from './lib/fetch-via'

const IN = '.cache/image-urls.tsv'
const DIR = '.cache/originals'
const OUT = '.cache/originals.ndjson'

/**
 * プロキシ側は当初 WireGuard トンネルが頭打ちになると踏んで低めにしていたが、
 * 4 本同時でも 1 本あたりの速度が落ちなかった (各 1.46 MB/s)。帯域ではなく
 * 往復遅延で律速していたので、上げた分だけ素直に速くなる (6→16 で 3.2 倍)。
 */
const CONCURRENCY = Number(process.env.DL_CONCURRENCY ?? 12)
const PROXY_CONCURRENCY = Number(process.env.DL_PROXY_CONCURRENCY ?? 16)

/** 全 body を落とすので、サイズ計測 (15s) より余裕を持たせる */
const TIMEOUT_MS = Number(process.env.DL_TIMEOUT_MS ?? 30_000)
const PROXY_TIMEOUT_MS = Number(process.env.DL_PROXY_TIMEOUT_MS ?? 90_000)

const RETRY_404 = process.argv.includes('--retry-404')

type Row = { url: string; host: string; uuid: string; bytes: number | null; status: number; type: string }

const readLines = (path: string): string[] => readFileSync(path, 'utf8').split('\n')

const urls = new Set<string>()
for (const line of readLines(IN)) {
  const url = line.split('\t')[0]
  // ページ位置だけを残した行 (url が空) は読み飛ばす
  if (url) urls.add(url)
}

/**
 * 再開用。成功した URL は飛ばす。
 * 失敗行を飛ばすと、タイムアウトや geo ブロックが解消しても永久に再試行されない。
 */
const done = new Map<string, Row>()
if (existsSync(OUT)) {
  for (const line of readLines(OUT)) {
    if (!line.trim()) continue
    try {
      const r = JSON.parse(line) as Row
      done.set(r.url, r)
    } catch {
      // 打ち切りで壊れた最終行は捨てる
    }
  }
}

const settled = (r: Row | undefined): boolean =>
  r !== undefined && (r.bytes !== null || (r.status === 404 && !RETRY_404))

/** 保存先。UUID 先頭 2 桁で 256 分割する */
const pathOf = (uuid: string) => `${DIR}/${uuid.slice(0, 2)}/${uuid}`

for (let i = 0; i < 256; i++) mkdirSync(`${DIR}/${i.toString(16).padStart(2, '0')}`, { recursive: true })

/** ホストごとにキューを分ける。1 つのオリジンに並列を集中させない */
const queues = new Map<string, string[]>()
let skipped = 0
for (const url of urls) {
  const prev = done.get(url)
  // マニフェストに成功が記録されていても、実体が消えていれば取り直す
  if (settled(prev) && (prev?.bytes === null || existsSync(pathOf(imageBaseKey(url))))) {
    skipped++
    continue
  }
  const h = hostOf(url)
  queues.set(h, [...(queues.get(h) ?? []), url])
}

const pending = [...queues.values()].reduce((s, q) => s + q.length, 0)
process.stderr.write(
  `total ${urls.size.toLocaleString()} / skip ${skipped.toLocaleString()} / todo ${pending.toLocaleString()}\n` +
    [...queues].map(([h, q]) => `  ${h}: ${q.length.toLocaleString()}`).join('\n') +
    '\n\n'
)

let ok = 0
let ng = 0
let bytesTotal = 0
const started = Date.now()

const report = () => {
  const sec = (Date.now() - started) / 1000
  const rate = (ok + ng) / sec
  const eta = Math.round((pending - ok - ng) / Math.max(rate, 0.001))
  const gib = bytesTotal / 1024 ** 3
  process.stderr.write(
    `${(ok + ng).toLocaleString()}/${pending.toLocaleString()}  ` +
      `ok ${ok.toLocaleString()} ng ${ng.toLocaleString()}  ` +
      `${gib.toFixed(2)} GiB  ${(bytesTotal / 1024 ** 2 / sec).toFixed(1)} MiB/s  ` +
      `残り ~${Math.floor(eta / 60)}m${eta % 60}s\n`
  )
}

async function worker(queue: string[], cursor: { i: number }, timeoutMs: number): Promise<void> {
  for (;;) {
    const i = cursor.i++
    if (i >= queue.length) return
    const url = queue[i]
    const uuid = imageBaseKey(url)
    const dest = pathOf(uuid)

    let row: Row
    try {
      const res = await download(url, timeoutMs)
      if (res.body === null) {
        row = { url, host: hostOf(url), uuid, bytes: null, status: res.status, type: `not an image: ${res.contentType}` }
      } else {
        // 打ち切りで切れたファイルを残さないよう、書き切ってから名前を付ける
        const part = `${dest}.part`
        writeFileSync(part, res.body)
        renameSync(part, dest)
        row = { url, host: hostOf(url), uuid, bytes: res.body.byteLength, status: res.status, type: res.contentType }
      }
    } catch (e) {
      row = { url, host: hostOf(url), uuid, bytes: null, status: 0, type: e instanceof Error ? e.message : String(e) }
    }

    appendFileSync(OUT, `${JSON.stringify(row)}\n`)
    if (row.bytes === null) ng++
    else {
      ok++
      bytesTotal += row.bytes
    }
    if ((ok + ng) % 250 === 0) report()
  }
}

await Promise.all(
  [...queues].flatMap(([host, queue]) => {
    const proxied = viaProxy(`https://${host}/`)
    const n = proxied ? PROXY_CONCURRENCY : CONCURRENCY
    const cursor = { i: 0 }
    return Array.from({ length: n }, () => worker(queue, cursor, proxied ? PROXY_TIMEOUT_MS : TIMEOUT_MS))
  })
)

report()
const disk = [...done.values()].filter((r) => r.bytes !== null).reduce((s, r) => s + (r.bytes ?? 0), 0) + bytesTotal
process.stderr.write(`\ndone. 保存済み合計 ${(disk / 1024 ** 3).toFixed(2)} GiB -> ${DIR}/\n`)
if (ng > 0) process.stderr.write(`失敗 ${ng.toLocaleString()} 件は再実行で追いかけられる (404 を含めるなら --retry-404)\n`)
