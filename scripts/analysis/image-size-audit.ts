/**
 * D1 に登録済みの全画像について、元バイナリの総容量を実測する。
 * HEAD (不可なら Range GET) で content-length だけを取り、本体はダウンロードしない。
 *
 * ただし geo ブロックされたホスト (Crunchyroll) は VPN 出口の SOCKS5 プロキシ経由で
 * 取る必要があり、かつ imgsrv が HEAD にも Range にも応じないため、そのホストだけは
 * 本体を落としてバイト数を数える (lib/fetch-via.ts)。
 *
 * 入力は dump-image-urls.ts が吐く TSV。ローカルの miniflare D1 は実データの
 * 数 % しか持っていないので、母数には使わない。
 *
 * 結果は NDJSON で逐次追記するので、途中で打ち切っても計測済みの分は残り、
 * 再実行すれば未計測の URL だけを追いかける。
 *
 * 使い方: bun run scripts/analysis/dump-image-urls.ts && bun run scripts/analysis/image-size-audit.ts
 */
import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import { hostOf, probeSize } from './lib/fetch-via'

const IN = '.cache/image-urls.tsv'
const OUT = '.cache/image-sizes.ndjson'
const CONCURRENCY = 32
/** 応答しないホストで worker が張り付くのを防ぐ */
const TIMEOUT_MS = 15_000

type Result = { url: string; source: string; host: string; bytes: number | null; status: number; type: string }

const urls = new Map<string, string>() // url -> 最初に見つかったテーブル
for (const line of readFileSync(IN, 'utf8').split('\n')) {
  if (!line) continue
  const [url, source] = line.split('\t')
  // ページ位置だけを残した行 (url が空) は読み飛ばす
  if (url && !urls.has(url)) urls.set(url, source ?? '')
}

// サイズが取れた URL だけを飛ばす (再開用)。
// 失敗行を飛ばすと、タイムアウトや geo ブロックが解消しても永久に再試行されない。
const seen = new Set<string>()
if (existsSync(OUT)) {
  for (const line of readFileSync(OUT, 'utf8').split('\n')) {
    if (!line) continue
    try {
      const r = JSON.parse(line) as Result
      if (r.bytes !== null) seen.add(r.url)
    } catch {
      // 打ち切りで壊れた最終行は捨てる
    }
  }
}

const host = hostOf

async function probe(url: string, source: string): Promise<Result> {
  const base = { url, source, host: url && host(url) }
  try {
    // geo ブロックは 301 ではなく 200 + エラーページ HTML で返ってくることがある。
    // content-length だけ見ていると、その HTML のサイズを画像として数えてしまうので、
    // probeSize は content-type が image/ でなければ bytes を null にする。
    const { bytes, status, contentType } = await probeSize(url, TIMEOUT_MS)
    return { ...base, bytes, status, type: bytes === null ? `not an image: ${contentType}` : contentType }
  } catch (e) {
    return { ...base, bytes: null, status: 0, type: e instanceof Error ? e.message : String(e) }
  }
}

/**
 * 第1引数でホストあたりの計測上限を指定できる。全 22 万件を舐めると 1 時間以上かかるうえ、
 * 配信元にも負荷をかけるので、平均値を取るだけならホスト別の無作為標本で足りる。
 * 抽出はコーパス全体からの等間隔サンプリング (rowid 順に並んでいるので時期の偏りも避けられる)。
 */
const PER_HOST = Number(process.argv[2]) || Number.POSITIVE_INFINITY
/** 第2引数でホストを絞れる。計測済みのホストを巻き込まず、穴の空いたホストだけ追える */
const ONLY_HOST = process.argv[3]

const byHost = new Map<string, [string, string][]>()
for (const e of urls) {
  const h = host(e[0])
  if (ONLY_HOST !== undefined && h !== ONLY_HOST) continue
  byHost.set(h, [...(byHost.get(h) ?? []), e])
}

const todo: [string, string][] = []
for (const [, all] of byHost) {
  const pending = all.filter(([url]) => !seen.has(url))
  if (pending.length <= PER_HOST) {
    todo.push(...pending)
    continue
  }
  const step = pending.length / PER_HOST
  for (let i = 0; i < PER_HOST; i++) todo.push(pending[Math.floor(i * step)])
}

process.stderr.write(`total ${urls.size} / measured ${seen.size} / todo ${todo.length}\n`)

let cursor = 0
let done = 0
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    for (;;) {
      const i = cursor++
      if (i >= todo.length) return
      const [url, source] = todo[i]
      appendFileSync(OUT, `${JSON.stringify(await probe(url, source))}\n`)
      if (++done % 250 === 0) process.stderr.write(`${done}/${todo.length}\n`)
    }
  })
)
process.stderr.write(`done ${done}/${todo.length}\n`)
