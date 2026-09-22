/**
 * image-sizes.ndjson を集計して、ホスト別・テーブル別の元バイナリ総容量を出す。
 *
 * 使い方: bun run scripts/analysis/image-size-report.ts
 */
import { existsSync, readFileSync } from 'node:fs'

type Result = { url: string; source: string; host: string; bytes: number | null; status: number; type: string }

const OUT = '.cache/image-sizes.ndjson'
if (!existsSync(OUT)) throw new Error(`${OUT} がまだ無い`)

// 失敗した URL は再実行のたびに再計測されて行が増えるので、URL ごとに最後の結果を採る
const latest = new Map<string, Result>()
for (const line of readFileSync(OUT, 'utf8').split('\n')) {
  if (!line) continue
  try {
    const r: Result = JSON.parse(line)
    latest.set(r.url, r)
  } catch {
    // 打ち切りで壊れた最終行は捨てる
  }
}
const rows = [...latest.values()]

const mib = (b: number): string => `${(b / 1024 / 1024).toFixed(1)} MiB`
const gib = (b: number): string => `${(b / 1024 / 1024 / 1024).toFixed(2)} GiB`

// content-type を見ていなかった頃の計測結果には、geo ブロックのエラーページ HTML が
// 成功として混ざっている。画像以外は失敗として扱う。
const isImage = (r: Result): boolean => r.bytes !== null && r.bytes > 0 && r.type.startsWith('image/')
const ok = rows.filter((r): r is Result & { bytes: number } => isImage(r))
const failed = rows.filter((r) => !isImage(r))

type Agg = { count: number; bytes: number; max: number }
const group = (key: (r: Result & { bytes: number }) => string): [string, Agg][] => {
  const m = new Map<string, Agg>()
  for (const r of ok) {
    const a = m.get(key(r)) ?? { count: 0, bytes: 0, max: 0 }
    a.count++
    a.bytes += r.bytes
    a.max = Math.max(a.max, r.bytes)
    m.set(key(r), a)
  }
  return [...m].sort((x, y) => y[1].bytes - x[1].bytes)
}

const total = ok.reduce((s, r) => s + r.bytes, 0)
const sorted = ok.map((r) => r.bytes).sort((a, b) => a - b)
const pct = (p: number): number => sorted[Math.min(sorted.length - 1, Math.floor((sorted.length * p) / 100))]

console.log(`計測済み ${rows.length} 件 (成功 ${ok.length} / 失敗 ${failed.length})`)
console.log(`元バイナリ総容量: ${gib(total)} (${total.toLocaleString()} bytes)`)
console.log(`1枚あたり: 平均 ${(total / ok.length / 1024).toFixed(0)} KiB / 中央値 ${(pct(50) / 1024).toFixed(0)} KiB`)
console.log(`  p90 ${(pct(90) / 1024).toFixed(0)} KiB / p99 ${(pct(99) / 1024).toFixed(0)} KiB / 最大 ${mib(sorted[sorted.length - 1])}`)

console.log('\n--- ホスト別 ---')
for (const [host, a] of group((r) => r.host)) {
  console.log(`${host.padEnd(30)} ${String(a.count).padStart(6)} 件  ${gib(a.bytes).padStart(10)}  平均 ${(a.bytes / a.count / 1024).toFixed(0).padStart(5)} KiB  最大 ${mib(a.max)}`)
}

console.log('\n--- テーブル別 ---')
for (const [source, a] of group((r) => r.source)) {
  console.log(`${source.padEnd(20)} ${String(a.count).padStart(6)} 件  ${gib(a.bytes).padStart(10)}`)
}

if (failed.length > 0) {
  const reasons = new Map<string, number>()
  for (const r of failed) {
    const k = r.status === 0 ? r.type.slice(0, 50) : `HTTP ${r.status} (${r.type.split(';')[0].slice(0, 40)})`
    reasons.set(k, (reasons.get(k) ?? 0) + 1)
  }
  console.log('\n--- 取得できなかったもの ---')
  for (const [k, n] of [...reasons].sort((a, b) => b[1] - a[1])) console.log(`${String(n).padStart(5)}  ${k}`)
}
