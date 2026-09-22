/**
 * オリジン側に「小さい画像をくれ」と言えるかを実測する。
 *
 * 4 ホストの URL はすべてクエリパラメータを持たない素のパスだが、オリジンが
 * リサイズ指示を受け付けるかどうかは URL の見た目とは別の話なので、実際に
 * 叩いて確かめる。受け付けるなら、原寸 148 GiB を落として自前で縮める代わりに
 * 配信幅だけをオリジンから直接もらえる。
 *
 * 同時に二重圧縮の代償も測る。オリジンのリサイズ結果は再エンコード済みなので、
 * そこから WebP にすると「原寸 → WebP」より画質が落ちうる。
 *
 * 画質はバイト数で代用しない。出力が小さいことは劣化とも上手い圧縮とも取れるし、
 * 逆に元の JPEG ノイズを忠実に符号化して膨らむこともあるので、向きすら決まらない。
 * 「原寸を無劣化で目標幅に縮めた PNG」を理想形に置き、そこからの SSIM を
 * ffmpeg で測って、2 つの経路のどちらが理想に近いかを直接比べる。
 *
 * 使い方: bun run scripts/analysis/origin-resize-probe.ts [1ホストあたりの件数]
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { readFileSync } from 'node:fs'
import { optimizeImage } from 'wasm-image-optimization'
import { download, hostOf } from './lib/fetch-via'

const URLS = '.cache/image-urls.tsv'
const TMP = '.cache/probe'
const TIMEOUT_MS = 40_000

/** 配信幅のうち最大のもの。ここが取れれば下の幅はすべて自前で作れる */
const TARGET_W = 800
const QUALITY = 80

/**
 * ホストごとの「この幅でくれ」の書き方。実測で効くことを確認した形だけを置く。
 * null を返す = そのホストにはサイズノブが無い。
 */
const RESIZERS: Record<string, (url: string, w: number) => string | null> = {
  // Amazon のメディアサーバは拡張子の手前に修飾子を挟む。SX = 幅指定。
  'm.media-amazon.com': (url, w) => url.replace(/\.([^./]+)$/, `._SX${w}_.$1`),
  'image.p-c2-x.abema-tv.com': (url, w) => `${url}?width=${w}`,
  'images.prod.hjholdings.tv': (url, w) => `${url}?w=${w}`,
  // Crunchyroll はパスに寸法が入っている。16:9 固定なので高さも合わせて書き換える。
  'www.crunchyroll.com': (url, w) => url.replace(/\/\d+x\d+\//, `/${w}x${Math.round((w * 9) / 16)}/`)
}

const PER_HOST = Number.parseInt(process.argv[2] ?? '8', 10)

mkdirSync(TMP, { recursive: true })

/**
 * ffmpeg の ssim フィルタで 2 枚の一致度を出す。1.0 が完全一致。
 * 目安として 0.99 を超えると並べても差が分からない領域に入る。
 */
async function ssim(a: string, ref: string): Promise<number | null> {
  const p = Bun.spawn(['ffmpeg', '-hide_banner', '-i', a, '-i', ref, '-lavfi', 'ssim', '-f', 'null', '-'], {
    stdout: 'ignore',
    stderr: 'pipe'
  })
  const err = await new Response(p.stderr).text()
  await p.exited
  const m = err.match(/All:([0-9.]+)/)
  return m === null ? null : Number(m[1])
}

const byHost = new Map<string, string[]>()
for (const line of readFileSync(URLS, 'utf8').split('\n')) {
  const url = line.split('\t')[0]
  if (!url) continue
  const h = hostOf(url)
  byHost.set(h, [...(byHost.get(h) ?? []), url])
}

const kib = (b: number) => `${(b / 1024).toFixed(0)} KiB`

type Stat = {
  origBytes: number
  varBytes: number
  fromOrig: number
  fromVar: number
  ssimOrig: number | null
  ssimVar: number | null
}

console.log(`## オリジンのリサイズ指示 (w${TARGET_W}) と二重圧縮の代償\n`)

for (const [host, urls] of byHost) {
  const make = RESIZERS[host]
  console.log(`### ${host}`)
  if (make === undefined) {
    console.log('サイズノブ未確認\n')
    continue
  }

  const stats: Stat[] = []
  // 先頭から等間隔に抜く。並び順は D1 の登録順なので作品の偏りが出にくい
  for (let i = 0; i < PER_HOST; i++) {
    const url = urls[Math.floor(((i + 0.5) * urls.length) / PER_HOST)]
    const variant = make(url, TARGET_W)
    if (variant === null) continue

    try {
      const [a, b] = await Promise.all([download(url, TIMEOUT_MS), download(variant, TIMEOUT_MS)])
      if (a.body === null || b.body === null) continue

      // 同じ幅・同じ品質で WebP にして、原寸経由とオリジン縮小経由を並べる
      const [wa, wb] = await Promise.all([
        optimizeImage({ image: a.body, format: 'webp', width: TARGET_W, quality: QUALITY }),
        optimizeImage({ image: b.body, format: 'webp', width: TARGET_W, quality: QUALITY })
      ])
      if (!wa || !wb) continue

      if (stats.length === 0) {
        console.log(`原寸 ${wa.originalWidth}x${wa.originalHeight} ${wa.originalFormat} / ` +
          `オリジン縮小 ${wb.originalWidth}x${wb.originalHeight} ${wb.originalFormat}`)
      }

      // 理想形: 原寸を無劣化 (PNG) で目標幅に縮めたもの。両経路をここから測る
      const ref = await optimizeImage({ image: a.body, format: 'png', width: TARGET_W })
      const base = `${TMP}/${host}-${i}`
      let ssimOrig: number | null = null
      let ssimVar: number | null = null
      if (ref) {
        writeFileSync(`${base}-ref.png`, ref.data)
        writeFileSync(`${base}-a.webp`, wa.data)
        writeFileSync(`${base}-b.webp`, wb.data)
        ;[ssimOrig, ssimVar] = await Promise.all([
          ssim(`${base}-a.webp`, `${base}-ref.png`),
          ssim(`${base}-b.webp`, `${base}-ref.png`)
        ])
      }

      stats.push({
        origBytes: a.body.byteLength,
        varBytes: b.body.byteLength,
        fromOrig: wa.data.byteLength,
        fromVar: wb.data.byteLength,
        ssimOrig,
        ssimVar
      })
    } catch {
      // 取得失敗は標本から落とすだけ
    }
  }

  if (stats.length === 0) {
    console.log('標本が取れなかった\n')
    continue
  }

  const avg = (f: (s: Stat) => number) => stats.reduce((t, s) => t + f(s), 0) / stats.length
  const avgSsim = (f: (s: Stat) => number | null) => {
    const xs = stats.map(f).filter((x): x is number => x !== null)
    return xs.length === 0 ? null : xs.reduce((t, x) => t + x, 0) / xs.length
  }
  const o = avg((s) => s.origBytes)
  const v = avg((s) => s.varBytes)
  const fo = avg((s) => s.fromOrig)
  const fv = avg((s) => s.fromVar)
  const so = avgSsim((s) => s.ssimOrig)
  const sv = avgSsim((s) => s.ssimVar)
  const s4 = (x: number | null) => (x === null ? '—' : x.toFixed(4))

  console.log(`標本 ${stats.length} 枚 (平均)\n`)
  console.log('| 経路 | 取得バイト | WebP q80 w800 出力 | 無劣化 w800 との SSIM |')
  console.log('|---|---:|---:|---:|')
  console.log(`| 原寸をそのまま落とす | ${kib(o)} | ${kib(fo)} | ${s4(so)} |`)
  console.log(`| オリジンに w${TARGET_W} で要求 | ${kib(v)} | ${kib(fv)} | ${s4(sv)} |`)
  console.log(`\n取得量 **${((v / o) * 100).toFixed(1)}%** に減る (${(o / v).toFixed(1)}分の1)。`)
  if (so !== null && sv !== null) {
    console.log(`SSIM の差 ${(sv - so >= 0 ? '+' : '') + (sv - so).toFixed(4)} (オリジン縮小 − 原寸経由)。\n`)
  } else {
    console.log('SSIM は測れなかった。\n')
  }
}
