/**
 * WebP の品質 (quality) × 解像度 (width) を総当たりで変換し、実バイト数を記録する。
 *
 * img.ts と同じ wasm-image-optimization を使うので、ここで出た数字はそのまま
 * Worker が R2 に積む量になる。geo ブロックされた Crunchyroll も
 * lib/fetch-via.ts 経由で取れるため、全ホストを同じ条件で並べられる。
 *
 * 標本は image-sizes.ndjson (原寸サイズの実測) からホストごとにサイズ順で
 * 等間隔に抜く。大きい画像だけ・小さい画像だけに偏ると圧縮率を読み違える。
 *
 * 結果は NDJSON に逐次追記するので、途中で打ち切っても再実行で続きから走る。
 *
 * 使い方: bun run scripts/analysis/webp-matrix.ts [1ホストあたりの件数]
 */
import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import { optimizeImage } from 'wasm-image-optimization'
import { download } from './lib/fetch-via'
import { type MatrixRow, QUALITIES, slotKey, WIDTHS } from './lib/webp-axes'

const IN = '.cache/image-sizes.ndjson'
const OUT = '.cache/webp-matrix.ndjson'

const TIMEOUT_MS = 40_000
/** wasm の変換は CPU 律速。大きい画像を並べすぎるとメモリを食うので控えめにする */
const CONCURRENCY = 3

type Probe = { url: string; host: string; bytes: number | null; type: string }

/** 再計測で行が増えるので、URL ごとに最後の結果を採る */
const lastByUrl = <T extends { url: string }>(text: string): T[] => [
  ...text
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

const probes = lastByUrl<Probe>(readFileSync(IN, 'utf8')).filter(
  (p) => p.bytes !== null && p.bytes > 0 && p.type.startsWith('image/')
)

/** 変換済みの URL は飛ばす (再開用) */
const done = new Set<string>()
if (existsSync(OUT)) for (const r of lastByUrl<MatrixRow>(readFileSync(OUT, 'utf8'))) done.add(r.url)

const PER_HOST = Number.parseInt(process.argv[2] ?? '40', 10)

const byHost = new Map<string, Probe[]>()
for (const p of probes) byHost.set(p.host, [...(byHost.get(p.host) ?? []), p])

/** ホストごとにサイズ順で等間隔に抜く */
const sample: Probe[] = []
for (const [, list] of byHost) {
  list.sort((a, b) => (a.bytes ?? 0) - (b.bytes ?? 0))
  const n = Math.min(PER_HOST, list.length)
  for (let i = 0; i < n; i++) {
    const p = list[Math.floor(((i + 0.5) * list.length) / n)]
    if (!done.has(p.url)) sample.push(p)
  }
}

process.stderr.write(
  `hosts ${byHost.size} / sample ${sample.length} (既存 ${done.size} 件は skip) / ` +
    `${QUALITIES.length}品質 x ${WIDTHS.length}幅 = ${QUALITIES.length * WIDTHS.length} 変換/枚\n`
)

let cursor = 0
let finished = 0
const started = Date.now()

await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    for (;;) {
      const i = cursor++
      if (i >= sample.length) return
      const p = sample[i]

      let image: Uint8Array
      try {
        const res = await download(p.url, TIMEOUT_MS)
        if (res.body === null) continue
        image = res.body
      } catch {
        continue // ネットワーク失敗は標本から落とすだけ
      }

      const webp: Record<string, number | null> = {}
      const outWidth: Record<string, number | null> = {}
      let originalWidth = 0
      let originalHeight = 0
      let originalFormat = ''

      for (const quality of QUALITIES) {
        for (const width of WIDTHS) {
          const k = slotKey(quality, width)
          try {
            const r = await optimizeImage({ image, format: 'webp', width, quality })
            webp[k] = r?.data.byteLength ?? null
            outWidth[k] = r?.width ?? null
            if (r) {
              originalWidth = r.originalWidth
              originalHeight = r.originalHeight
              originalFormat = r.originalFormat
            }
          } catch {
            webp[k] = null
            outWidth[k] = null
          }
        }
      }

      const row: MatrixRow = {
        url: p.url,
        host: p.host,
        original: image.byteLength,
        originalWidth,
        originalHeight,
        originalFormat,
        webp,
        outWidth
      }
      appendFileSync(OUT, `${JSON.stringify(row)}\n`)

      if (++finished % 10 === 0) {
        const perImage = (Date.now() - started) / finished
        const eta = Math.round(((sample.length - finished) * perImage) / 1000)
        process.stderr.write(`${finished}/${sample.length}  (${Math.round(perImage)}ms/枚, 残り ~${eta}s)\n`)
      }
    }
  })
)

process.stderr.write(`done ${finished}/${sample.length} -> ${OUT}\n`)
