/**
 * image-sizes.ndjson のサンプルを実際にダウンロードし、Worker と同じ
 * wasm-image-optimization で WebP に変換して圧縮率を実測する。
 *
 * 使い方: bun run scripts/analysis/image-convert-sample.ts [1ホストあたりの件数] > .cache/convert-sample.json
 */
import { optimizeImage } from 'wasm-image-optimization'

type Probe = { url: string; source: string; host: string; bytes: number | null; status: number; type: string }

const PER_HOST = Number.parseInt(process.argv[2] ?? '40', 10)
/** フロントが実際に使う幅。幅なし (原寸) と合わせて R2 に保存される対象 */
const WIDTHS = [undefined, 176, 200, 400, 480, 800] as const

/** 計測が応答しないホストで張り付くのを防ぐ */
const TIMEOUT_MS = 30_000

// 再計測で同じ URL の行が増えるので、URL ごとに最後の結果を採る
const probes: Probe[] = [
  ...(await Bun.file('.cache/image-sizes.ndjson').text())
    .split('\n')
    .filter((l) => l.trim() !== '')
    .reduce((m, l) => {
      try {
        const p = JSON.parse(l) as Probe
        m.set(p.url, p)
      } catch {
        // 中断時の欠けた最終行
      }
      return m
    }, new Map<string, Probe>())
    .values()
]
const ok = probes.filter((p) => p.bytes !== null && p.bytes > 0)

/** ホストごとにサイズ順で等間隔に抜き、大小が偏らないようにする */
const byHost = new Map<string, Probe[]>()
for (const p of ok) {
  const list = byHost.get(p.host) ?? []
  list.push(p)
  byHost.set(p.host, list)
}
const sample: Probe[] = []
for (const [, list] of byHost) {
  list.sort((a, b) => (a.bytes ?? 0) - (b.bytes ?? 0))
  const n = Math.min(PER_HOST, list.length)
  for (let i = 0; i < n; i++) sample.push(list[Math.floor(((i + 0.5) * list.length) / n)])
}

type Row = { host: string; original: number; webp: Record<string, number | null> }
const rows: Row[] = []
let done = 0

for (const p of sample) {
  try {
    const res = await fetch(p.url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
    if (!res.ok) continue
    const image = await res.arrayBuffer()
    const webp: Record<string, number | null> = {}
    for (const width of WIDTHS) {
      try {
        const r = await optimizeImage({ image, format: 'webp', width, quality: 80 })
        webp[width === undefined ? 'full' : `w${width}`] = r?.data.byteLength ?? null
      } catch {
        webp[width === undefined ? 'full' : `w${width}`] = null
      }
    }
    rows.push({ host: p.host, original: image.byteLength, webp })
  } catch {
    // ネットワーク失敗はサンプルから落とすだけ
  }
  if (++done % 20 === 0) process.stderr.write(`${done}/${sample.length}\n`)
}

console.log(JSON.stringify(rows))
process.stderr.write(`converted ${rows.length}/${sample.length}\n`)
