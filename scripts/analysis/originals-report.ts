/**
 * ダウンロード済みの元バイナリ (.cache/originals.ndjson) から、実測の総容量と
 * WebP 変換後の見積りを出す。
 *
 * webp-matrix-report.ts との違いは母数の扱い。あちらは原寸サイズも標本平均 ×
 * 件数の外挿だったが、完走したホストについてはここで全件の実バイト数が使える。
 * 外挿と実測を並べることで、標本抽出そのものの精度も検証できる。
 *
 * WebP 側は依然として標本 (各ホスト 40 枚) の平均。WebP の出力サイズは元の
 * ファイルサイズではなく画像の内容と出力幅で決まるので、元バイナリを全件
 * 取得しても WebP の推定精度は上がらない。
 *
 * 使い方: bun run scripts/analysis/originals-report.ts
 */
import { readFileSync } from 'node:fs'
import { type MatrixRow, QUALITIES, SERVED, slotKey } from './lib/webp-axes'

const ORIGINALS = '.cache/originals.ndjson'
const MATRIX = '.cache/webp-matrix.ndjson'
const URLS = '.cache/image-urls.tsv'

const FREE_GB = 10
const USD_PER_GB_MONTH = 0.015

type Row = { url: string; host: string; bytes: number | null; status: number; type: string }

/** 再実行で行が増えるので URL ごとに最後の結果を採る */
const lastByUrl = <T extends { url: string }>(path: string): T[] => [
  ...readFileSync(path, 'utf8')
    .split('\n')
    .filter((l) => l.trim() !== '')
    .reduce((m, l) => {
      try {
        const r = JSON.parse(l) as T
        m.set(r.url, r)
      } catch {
        // 打ち切りで壊れた最終行は捨てる
      }
      return m
    }, new Map<string, T>())
    .values()
]

/** 母数: D1 に載っている URL の実数 */
const corpus = new Map<string, number>()
for (const line of readFileSync(URLS, 'utf8').split('\n')) {
  const url = line.split('\t')[0]
  if (!url) continue
  const h = new URL(url).hostname
  corpus.set(h, (corpus.get(h) ?? 0) + 1)
}

/** ホスト別の実バイト数 */
const sizes = new Map<string, number[]>()
for (const r of lastByUrl<Row>(ORIGINALS)) {
  if (r.bytes === null) continue
  sizes.set(r.host, [...(sizes.get(r.host) ?? []), r.bytes])
}
for (const xs of sizes.values()) xs.sort((a, b) => a - b)

const matrix = new Map<string, MatrixRow[]>()
for (const r of lastByUrl<MatrixRow>(MATRIX)) matrix.set(r.host, [...(matrix.get(r.host) ?? []), r])

const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0)
const mean = (xs: number[]) => sum(xs) / xs.length
/** xs はソート済み前提 */
const pct = (xs: number[], p: number) => xs[Math.min(xs.length - 1, Math.floor((xs.length * p) / 100))]

/** 1枚あたりの平均 WebP バイト数。変換できなかった標本は分母から外す */
const avgWebp = (list: MatrixRow[], q: number, w: number | undefined): number => {
  const k = slotKey(q, w)
  const xs = list.map((r) => r.webp[k]).filter((v): v is number => typeof v === 'number')
  return xs.length === 0 ? 0 : mean(xs)
}

const GiB = 1024 ** 3
const GB = 1000 ** 3
const gib = (b: number) => (b / GiB).toFixed(2)
const usd = (b: number) => Math.max(0, b / GB - FREE_GB) * USD_PER_GB_MONTH

/** 完走したホストだけを「実測」として扱う */
const complete = [...corpus].filter(([h, n]) => (sizes.get(h)?.length ?? 0) >= n)
const partial = [...corpus].filter(([h, n]) => (sizes.get(h)?.length ?? 0) < n)

// ── 1. 元バイナリの実測 ────────────────────────────────────────────────
console.log('## 元バイナリの実測 (完走ホストのみ / 全件)\n')
console.log('| host | 件数 | 合計 | 平均 | p50 | p90 | p99 | 最大 |')
console.log('|---|---:|---:|---:|---:|---:|---:|---:|')
let completeBytes = 0
let completeCount = 0
for (const [h, n] of complete) {
  const xs = sizes.get(h) ?? []
  const t = sum(xs)
  completeBytes += t
  completeCount += n
  const k = (b: number) => `${(b / 1024).toFixed(0)} KiB`
  console.log(
    `| ${h} | ${n.toLocaleString()} | ${gib(t)} GiB | ${k(mean(xs))} | ${k(pct(xs, 50))} | ` +
      `${k(pct(xs, 90))} | ${k(pct(xs, 99))} | ${(xs[xs.length - 1] / 1024 ** 2).toFixed(1)} MiB |`
  )
}
console.log(`\n**合計 ${completeCount.toLocaleString()} 件 / ${gib(completeBytes)} GiB** (実測)\n`)

for (const [h, n] of partial) {
  const xs = sizes.get(h) ?? []
  const got = xs.length
  const projected = got === 0 ? 0 : mean(xs) * n
  console.log(
    `> ${h} は取得中 (${got.toLocaleString()}/${n.toLocaleString()} = ${((got / n) * 100).toFixed(1)}%)。` +
      `ここまでの平均 ${(mean(xs) / 1024).toFixed(0)} KiB から全件は ${gib(projected)} GiB 見込み。\n`
  )
}

// ── 2. WebP に変換したらどうなるか ──────────────────────────────────────
console.log('## WebP 変換後 (完走ホスト / 配信5幅 = 176,200,400,480,800)\n')
console.log('| q | 配信5幅 合計 | 元バイナリ比 | 原寸WebP 単体 | 5幅+原寸 | 月額 (5幅のみ) |')
console.log('|---|---:|---:|---:|---:|---:|')
for (const q of QUALITIES) {
  let served = 0
  let full = 0
  for (const [h, n] of complete) {
    const list = matrix.get(h)
    if (list === undefined) continue
    served += sum(SERVED.map((w) => avgWebp(list, q, w))) * n
    full += avgWebp(list, q, undefined) * n
  }
  console.log(
    `| ${q} | ${gib(served)} GiB | ${((served / completeBytes) * 100).toFixed(1)}% | ` +
      `${gib(full)} GiB | ${gib(served + full)} GiB | $${usd(served).toFixed(2)} |`
  )
}

// ── 3. 品質を 1 段上げるのに何 GiB 払うか ──────────────────────────────
console.log('\n## 品質の限界費用 (配信5幅、完走ホスト)\n')
const servedAt = (q: number) =>
  complete.reduce((s, [h, n]) => {
    const list = matrix.get(h)
    return list === undefined ? s : s + sum(SERVED.map((w) => avgWebp(list, q, w))) * n
  }, 0)
console.log('| 区間 | 増分 | 増分率 |')
console.log('|---|---:|---:|')
for (let i = 1; i < QUALITIES.length; i++) {
  const lo = servedAt(QUALITIES[i - 1])
  const hi = servedAt(QUALITIES[i])
  console.log(
    `| q${QUALITIES[i - 1]} → q${QUALITIES[i]} | +${gib(hi - lo)} GiB | +${(((hi - lo) / lo) * 100).toFixed(1)}% |`
  )
}

// ── 4. ホスト別の圧縮の効き方 ──────────────────────────────────────────
console.log('\n## ホスト別 1枚あたり平均 (q80)\n')
console.log('| host | 元バイナリ (実測) | 原寸WebP | w800 | w400 | w176 | 配信5幅 計 |')
console.log('|---|---:|---:|---:|---:|---:|---:|')
for (const [h] of complete) {
  const list = matrix.get(h)
  if (list === undefined) continue
  const xs = sizes.get(h) ?? []
  const k = (b: number) => `${(b / 1024).toFixed(0)} KiB`
  console.log(
    `| ${h} | ${k(mean(xs))} | ${k(avgWebp(list, 80, undefined))} | ${k(avgWebp(list, 80, 800))} | ` +
      `${k(avgWebp(list, 80, 400))} | ${k(avgWebp(list, 80, 176))} | ${k(sum(SERVED.map((w) => avgWebp(list, 80, w))))} |`
  )
}
