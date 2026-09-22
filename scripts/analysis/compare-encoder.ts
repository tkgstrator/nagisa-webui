/**
 * wasm (= img.ts と同じ経路) と vips (ネイティブ) で同じ原本を焼き、バイト数と速度を突き合わせる。
 *
 * 速いほうに乗り換えてよいかは「どれだけ速いか」ではなく「出るバイト数がどれだけ違うか」で決まる。
 * この見積もりの目的は R2 に積まれる量を当てることなので、エンコーダを替えて数 % ずれるなら
 * その差はそのまま見積もりの誤差になる。ここで実測して開示できる形にする。
 *
 * 使い方: bun run scripts/analysis/compare-encoder.ts [--n 200]
 */
import { execFile } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { promisify } from 'node:util'

const exec = promisify(execFile)

const SRC = '.cache/originals'
const TMP = '.cache/cmp'
const NDJSON = '.cache/webp-ladder.ndjson'
const LADDER = [200, 400, 800] as const
const QUALITY = 80

/** vips thumbnail は幅と高さの箱に収めるので、高さを実質無制限にしないと縦長画像が幅に届かない */
const NO_HEIGHT_LIMIT = 10_000_000

type WasmRow = { ok: boolean; uuid: string; bytes: Record<string, number>; originalWidth: number }

const shardOf = (u: string) => u.slice(0, 2)

async function vipsEncode(src: string, dst: string, width: number, _ow: number): Promise<number> {
  // --size down: 原寸より大きい幅を要求しても拡大しない (img.ts の頭打ちと同じ挙動)
  await exec('vips', [
    'thumbnail',
    src,
    `${dst}[Q=${QUALITY},strip]`,
    String(width),
    '--height',
    String(NO_HEIGHT_LIMIT),
    '--size',
    'down'
  ])
  return statSync(dst).size
}

/**
 * cwebp は libwebp 本体の CLI。wasm-image-optimization も libwebp を emscripten で
 * 焼いたものなので、リサイザが同じ (WebPPictureRescale) なら出力が一致するはず。
 * -resize W 0 は高さを縦横比から決める。拡大は img.ts と同じく避け、幅指定なしに落とす。
 */
async function cwebpEncode(src: string, dst: string, width: number, ow: number): Promise<number> {
  const resize = ow >= width ? ['-resize', String(width), '0'] : []
  await exec('cwebp', ['-q', String(QUALITY), ...resize, '-quiet', src, '-o', dst])
  return statSync(dst).size
}

async function main(): Promise<void> {
  const nArg = process.argv.indexOf('--n')
  const n = nArg === -1 ? 200 : Number(process.argv[nArg + 1])

  const rows: WasmRow[] = []
  for (const line of readFileSync(NDJSON, 'utf8').split('\n')) {
    if (!line.trim()) continue
    try {
      const r = JSON.parse(line) as WasmRow
      if (r.ok && existsSync(`${SRC}/${shardOf(r.uuid)}/${r.uuid}`)) rows.push(r)
    } catch {
      // 打ち切りで壊れた最終行
    }
    if (rows.length >= n) break
  }
  if (rows.length === 0) throw new Error(`${NDJSON} に比較できる行がない`)

  await exec('mkdir', ['-p', TMP])

  // ネイティブは 1 枚 1 プロセスなので、wasm と違ってコア数ぶん素直に並ぶ
  const CONC = 20
  let cursor = 0
  const wasmTotal: Record<number, number> = { 200: 0, 400: 0, 800: 0 }
  const vipsTotal: Record<number, number> = { 200: 0, 400: 0, 800: 0 }
  let failed = 0

  const started = Date.now()
  await Promise.all(
    Array.from({ length: CONC }, async () => {
      for (;;) {
        const i = cursor++
        if (i >= rows.length) return
        const row = rows[i]
        const src = `${SRC}/${shardOf(row.uuid)}/${row.uuid}`
        try {
          for (const w of LADDER) {
            const size = await vipsEncode(src, `${TMP}/${row.uuid}.w${w}.webp`, w)
            vipsTotal[w] += size
            wasmTotal[w] += row.bytes[w] ?? 0
          }
        } catch {
          failed++
        }
      }
    })
  )
  const sec = (Date.now() - started) / 1000

  process.stdout.write(`標本 ${rows.length} 枚 (失敗 ${failed})\n`)
  process.stdout.write(`vips: ${sec.toFixed(1)}s = ${(rows.length / sec).toFixed(0)} 枚/s (並列 ${CONC})\n\n`)
  process.stdout.write('幅     wasm(KiB)   vips(KiB)     差\n')
  let wAll = 0
  let vAll = 0
  for (const w of LADDER) {
    const a = wasmTotal[w] / 1024
    const b = vipsTotal[w] / 1024
    wAll += a
    vAll += b
    process.stdout.write(
      `w${String(w).padEnd(5)}${a.toFixed(0).padStart(9)}${b.toFixed(0).padStart(12)}` +
        `${(((b - a) / a) * 100).toFixed(1).padStart(8)}%\n`
    )
  }
  process.stdout.write(
    `合計  ${wAll.toFixed(0).padStart(9)}${vAll.toFixed(0).padStart(12)}` +
      `${(((vAll - wAll) / wAll) * 100).toFixed(1).padStart(8)}%\n`
  )
}

await main()
