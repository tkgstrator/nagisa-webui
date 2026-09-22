/**
 * convert-sample.json (実測した変換結果) と image-sizes.ndjson (原寸サイズの標本) から、
 * R2 に実際どれだけ積まれるかを推計する。
 *
 * 母数はあくまで image-urls.tsv (リモート D1 の全 URL)。ndjson は標本でしかないので
 * 件数には使わない。使うと計測できた分だけが全体ということになって桁を間違える。
 *
 * 使い方: bun run scripts/analysis/convert-report.ts
 */
type Row = { host: string; original: number; webp: Record<string, number | null> }
type Probe = { url: string; host: string; bytes: number | null; type: string }

const WIDTH_KEYS = ['full', 'w176', 'w200', 'w400', 'w480', 'w800'] as const

const gib = (n: number) => `${(n / 1024 ** 3).toFixed(2)} GiB`
const kib = (n: number) => `${Math.round(n / 1024)} KiB`

const host = (url: string): string => {
  try {
    return new URL(url).host
  } catch {
    return '<invalid>'
  }
}

/** 母数: コーパス全体の URL 件数をホスト別に数える */
const corpus = new Map<string, number>()
{
  const seen = new Set<string>()
  for (const line of (await Bun.file('.cache/image-urls.tsv').text()).split('\n')) {
    if (!line) continue
    const url = line.split('\t')[0]
    // ページ位置だけを残した行 (url が空) は読み飛ばす
    if (!url || seen.has(url)) continue
    seen.add(url)
    corpus.set(host(url), (corpus.get(host(url)) ?? 0) + 1)
  }
}

const rows: Row[] = await Bun.file('.cache/convert-sample.json').json()
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

/**
 * geo ブロックされたホストは 200 でエラーページ HTML が返るので、
 * 変換が全滅した行が標本に混ざる。原寸 WebP が取れていない行は標本から外す。
 */
const valid = rows.filter((r) => typeof r.webp.full === 'number' && r.webp.full > 0)

/** ホスト別: 原寸の平均 (probe 実測) と、幅ごとの平均 WebP サイズ (変換実測) */
type Stat = { n: number; origAvg: number; per: Record<string, number> }
const stats = new Map<string, Stat>()
for (const h of new Set(valid.map((r) => r.host))) {
  const list = valid.filter((r) => r.host === h)
  // content-type を見ない古い計測結果には、geo ブロックの HTML が成功として混ざっている
  const ok = probes.filter(
    (p) => p.host === h && typeof p.bytes === 'number' && p.bytes > 0 && p.type.startsWith('image/')
  )
  const per: Record<string, number> = {}
  for (const k of WIDTH_KEYS) {
    const vals = list.map((r) => r.webp[k]).filter((v): v is number => typeof v === 'number')
    per[k] = vals.length === 0 ? 0 : vals.reduce((a, b) => a + b, 0) / vals.length
  }
  stats.set(h, {
    n: list.length,
    origAvg: ok.length === 0 ? 0 : ok.reduce((a, p) => a + (p.bytes ?? 0), 0) / ok.length,
    per
  })
}

console.log('== ホスト別 実測 (標本) ==')
for (const [h, s] of stats) {
  const parts = WIDTH_KEYS.map((k) => `${k} ${kib(s.per[k])}`)
  const ratio = s.origAvg === 0 ? 0 : (s.per.full / s.origAvg) * 100
  console.log(`${h.padEnd(26)} 変換n=${String(s.n).padStart(3)} 原寸 ${kib(s.origAvg).padStart(9)}`)
  console.log(`${' '.repeat(26)}  ${parts.join(' / ')}   (原寸WebP は元の ${ratio.toFixed(1)}%)`)
}

/** 計測できたホストの加重平均。未計測ホストの代理値に使う */
const measured = [...stats].filter(([h]) => corpus.has(h))
const wTotal = measured.reduce((a, [h]) => a + (corpus.get(h) ?? 0), 0)
const proxy: Stat = {
  n: 0,
  origAvg: measured.reduce((a, [h, s]) => a + s.origAvg * (corpus.get(h) ?? 0), 0) / wTotal,
  per: Object.fromEntries(
    WIDTH_KEYS.map((k) => [k, measured.reduce((a, [h, s]) => a + s.per[k] * (corpus.get(h) ?? 0), 0) / wTotal])
  )
}

console.log('\n== 全件推計 (R2 に積まれる量) ==')
const sum = { orig: 0, full: 0, all: 0 }
const est = { orig: 0, full: 0, all: 0 }
for (const [h, count] of [...corpus].sort((a, b) => b[1] - a[1])) {
  const s = stats.get(h)
  const use = s ?? proxy
  const o = use.origAvg * count
  const f = use.per.full * count
  const a = WIDTH_KEYS.reduce((t, k) => t + use.per[k], 0) * count
  const tgt = s ? sum : est
  tgt.orig += o
  tgt.full += f
  tgt.all += a
  const tag = s ? '' : '  ← 変換標本なし (他ホストの加重平均で代用)'
  console.log(
    `${h.padEnd(26)} ${String(count).padStart(6)} 件  原寸 ${gib(o).padStart(9)}  →  WebP原寸 ${gib(f).padStart(9)}  全6幅込み ${gib(a).padStart(9)}${tag}`
  )
}

const total = [...corpus.values()].reduce((a, b) => a + b, 0)
const covered = measured.reduce((a, [h]) => a + (corpus.get(h) ?? 0), 0)
console.log(`\n-- 合計 (全 ${total.toLocaleString()} 件 / うち実測ホスト ${((covered / total) * 100).toFixed(1)}%) --`)
console.log(`元バイナリ (originalKey に保存)      : ${gib(sum.orig + est.orig)}`)
console.log(`WebP 原寸のみ (webpKey, width なし)  : ${gib(sum.full + est.full)}`)
console.log(`WebP 全6幅 (最悪ケース)              : ${gib(sum.all + est.all)}`)
console.log(`\nA. 元 + WebP全6幅 (現行実装)         : ${gib(sum.orig + est.orig + sum.all + est.all)}`)
console.log(`B. WebP全6幅のみ (元を保存しない)    : ${gib(sum.all + est.all)}`)
