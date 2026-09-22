/**
 * webp-matrix.ndjson の実測から、保存方針ごとの R2 容量と月額を出す。
 *
 * 標本はホストあたり数十枚しかないので、ホスト別の平均を母数 (image-urls.tsv の
 * 全 URL 件数) に掛けて総量にする。ホストごとに原寸の大きさも圧縮率も違うため、
 * 全体平均を一度に掛けてはいけない。
 *
 * 使い方: bun run scripts/analysis/webp-matrix-report.ts
 */
import { readFileSync } from 'node:fs'
import { hostOf } from './lib/fetch-via'
import { type MatrixRow, QUALITIES, SERVED, slotKey } from './lib/webp-axes'

const MATRIX = '.cache/webp-matrix.ndjson'
const URLS = '.cache/image-urls.tsv'
const SIZES = '.cache/image-sizes.ndjson'

/** R2 の従量課金 (2026-09 時点)。egress は無料なので storage と操作だけ見る */
const FREE_GB = 10
const USD_PER_GB_MONTH = 0.015
/** Class A = 書き込み。画像1枚につき保存する幅の数だけ発生する (初回のみ) */
const USD_PER_MILLION_CLASS_A = 4.5

/** 保存方針。served 以外に、原寸側をどこまで持つか */
const POLICIES = [
  { id: 'P1', label: '配信5幅のみ', extra: [] as (number | 'full' | 'origin')[] },
  { id: 'P2', label: '配信5幅 + w960', extra: [960] },
  { id: 'P3', label: '配信5幅 + w1280', extra: [1280] },
  { id: 'P4', label: '配信5幅 + 原寸WebP', extra: ['full' as const] },
  { id: 'P5', label: '配信5幅 + 原寸WebP + 元バイナリ', extra: ['full' as const, 'origin' as const] }
]

const rows = [
  ...readFileSync(MATRIX, 'utf8')
    .split('\n')
    .filter((l) => l.trim() !== '')
    .reduce((m, l) => {
      try {
        const r = JSON.parse(l) as MatrixRow
        m.set(r.url, r)
      } catch {
        // 打ち切りで壊れた最終行は捨てる
      }
      return m
    }, new Map<string, MatrixRow>())
    .values()
]

/** 母数: D1 に載っている URL の実数 */
const corpus = new Map<string, number>()
for (const line of readFileSync(URLS, 'utf8').split('\n')) {
  const url = line.split('\t')[0]
  if (!url) continue
  const h = hostOf(url)
  corpus.set(h, (corpus.get(h) ?? 0) + 1)
}

const sampled = new Map<string, MatrixRow[]>()
for (const r of rows) sampled.set(r.host, [...(sampled.get(r.host) ?? []), r])

const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length

/**
 * 元バイナリの平均は image-size-audit.ts の全標本 (数千件/ホスト) から採る。
 * 変換標本は 40 枚しかなく、元バイナリは総量の 8 割を占めるので、
 * ここだけは母数の大きい方を使わないと P5 の総量が標本誤差に振り回される。
 */
const originAvg = new Map<string, number>()
{
  const byHost = new Map<string, number[]>()
  const seen = new Map<string, { host: string; bytes: number | null; type: string }>()
  for (const l of readFileSync(SIZES, 'utf8').split('\n')) {
    if (l.trim() === '') continue
    try {
      const r = JSON.parse(l) as { url: string; host: string; bytes: number | null; type: string }
      seen.set(r.url, r)
    } catch {
      // 打ち切りで壊れた最終行は捨てる
    }
  }
  for (const r of seen.values()) {
    if (r.bytes === null || !r.type.startsWith('image/')) continue
    byHost.set(r.host, [...(byHost.get(r.host) ?? []), r.bytes])
  }
  for (const [h, xs] of byHost) originAvg.set(h, mean(xs))
}

/** 1枚あたりの平均バイト数。変換できなかった標本は分母から外す */
const avgOf = (list: MatrixRow[], k: string): number => {
  const xs = list.map((r) => r.webp[k]).filter((v): v is number => typeof v === 'number')
  return xs.length === 0 ? 0 : mean(xs)
}

const slot = (q: number, w: number | 'full' | 'origin') =>
  w === 'origin' ? 'origin' : slotKey(q, w === 'full' ? undefined : w)

/** 保存する 1 スロット = 「この幅を、この品質で」。幅ごとに品質を変える構成も表せる */
type Slot = { q: number; w: number | 'full' | 'origin' }

/** ホスト別平均 × 母数 を全ホストで足した総バイト数 */
function totalBytesOf(slots: Slot[]): number {
  let total = 0
  for (const [host, count] of corpus) {
    const list = sampled.get(host)
    if (list === undefined || list.length === 0) continue
    let per = 0
    for (const s of slots) {
      per +=
        s.w === 'origin' ? (originAvg.get(host) ?? mean(list.map((r) => r.original))) : avgOf(list, slot(s.q, s.w))
    }
    total += per * count
  }
  return total
}

const totalBytes = (quality: number, widths: (number | 'full' | 'origin')[]): number =>
  totalBytesOf(widths.map((w) => ({ q: quality, w })))

const GiB = 1024 ** 3
const GB = 1000 ** 3
const gib = (b: number) => (b / GiB).toFixed(2)
/** R2 の課金は 10 進の GB。無料枠を引いてから単価を掛ける */
const usd = (b: number) => Math.max(0, b / GB - FREE_GB) * USD_PER_GB_MONTH

const objects = [...corpus.values()].reduce((s, n) => s + n, 0)

// ── 1. 幅ごとの平均サイズ (品質の効き方を見る) ────────────────────────────
console.log('## 1枚あたり平均 WebP サイズ (KiB) / ホスト別\n')
for (const [host, list] of sampled) {
  console.log(`### ${host}  (標本 ${list.length} 枚 / 母数 ${corpus.get(host)?.toLocaleString()} 件)`)
  const orig = originAvg.get(host) ?? mean(list.map((r) => r.original))
  const px = mean(list.map((r) => r.originalWidth))
  console.log(
    `元バイナリ ${(orig / 1024).toFixed(0)} KiB (全標本平均) / ` +
      `変換標本の原寸 ${(mean(list.map((r) => r.original)) / 1024).toFixed(0)} KiB / 原寸幅 平均 ${px.toFixed(0)}px\n`
  )
  console.log(`| q | full | ${[1280, 960, ...SERVED].map((w) => `w${w}`).join(' | ')} |`)
  console.log(`|---|---|${[1280, 960, ...SERVED].map(() => '---').join('|')}|`)
  for (const q of QUALITIES) {
    const cells = ['full' as const, 1280, 960, ...SERVED].map((w) =>
      (avgOf(list, slot(q, w)) / 1024).toFixed(1)
    )
    console.log(`| ${q} | ${cells.join(' | ')} |`)
  }
  console.log()
}

// ── 2. 方針 × 品質 の総容量と月額 ──────────────────────────────────────
console.log(`## 保存方針 × 品質 の総容量と月額 (母数 ${objects.toLocaleString()} 件)\n`)
console.log(`| 方針 | ${QUALITIES.map((q) => `q${q}`).join(' | ')} |`)
console.log(`|---|${QUALITIES.map(() => '---').join('|')}|`)
for (const p of POLICIES) {
  const cells = QUALITIES.map((q) => {
    const b = totalBytes(q, [...SERVED, ...p.extra])
    return `${gib(b)} GiB / $${usd(b).toFixed(2)}`
  })
  console.log(`| ${p.id} ${p.label} | ${cells.join(' | ')} |`)
}

// ── 3. 原寸を R2 に置かない構成 ──────────────────────────────────────
// 原寸 WebP が再生成元になるので、配信幅より高い品質で持つ選択肢が出てくる。
// 配信幅は毎回そこから再変換されるため、原寸側の劣化がそのまま下流に乗る。
console.log('\n## 原寸バイナリを R2 に置かない場合 (再生成元 = 原寸 WebP)\n')
console.log('| 配信5幅 | 原寸 WebP | 総容量 | 月額 |')
console.log('|---|---|---|---|')
for (const [served, full] of [
  [80, 80],
  [80, 90],
  [70, 90],
  [70, 80],
  [60, 90]
] as const) {
  const b = totalBytesOf([...SERVED.map((w) => ({ q: served, w })), { q: full, w: 'full' as const }])
  console.log(`| q${served} | q${full} | ${gib(b)} GiB | $${usd(b).toFixed(2)} |`)
}
{
  const b = totalBytes(80, [...SERVED])
  console.log(`| q80 | 持たない | ${gib(b)} GiB | $${usd(b).toFixed(2)} |`)
}

// ── 4. 書き込み操作の初期費用 ────────────────────────────────────────
console.log('\n## Class A (書き込み) の初期費用\n')
for (const p of POLICIES) {
  const n = objects * (SERVED.length + p.extra.length)
  console.log(
    `- ${p.id} ${p.label}: ${n.toLocaleString()} オブジェクト → $${((n / 1e6) * USD_PER_MILLION_CLASS_A).toFixed(2)} (全件を一度埋めた場合)`
  )
}
