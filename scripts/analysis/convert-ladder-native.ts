/**
 * convert-ladder.ts のネイティブ版。sharp (libvips) で .cache/originals/ をラダーの各幅に焼く。
 *
 * wasm 版との違いは速度と、出力バイト数が本番 (img.ts = wasm-image-optimization) と
 * 一致しないこと。実測で合計は 6.4% ほど小さく、幅が小さいほど差が開く (w200 で -18%)。
 * リサイザが違う (libvips は lanczos3、libwebp は自前の rescaler) ためで、フラグでは埋まらない。
 * したがってここで出る数字は「R2 に積まれる量そのもの」ではなく、同一条件で撮った近似値である。
 *
 * 出力先とログは wasm 版と分けてある。混ぜると合計がエンコーダ 2 種のキメラになる。
 *
 * sharp はデコードとリサイズを libuv のスレッドプールで回すので、worker_threads は要らない。
 * 並列度は UV_THREADPOOL_SIZE ではなく in-flight 数で制御する。
 *
 * 使い方: bun run scripts/analysis/convert-ladder-native.ts [--limit N] [--conc N]
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { cpus } from 'node:os'
import sharp from 'sharp'

const SRC = '.cache/originals'
const DST = '.cache/webp-native'
const OUT = '.cache/webp-ladder-native.ndjson'

/** src/app/components/proxy-image.tsx の LADDER / src/routes/img.ts の PERSISTED_WIDTHS と同じ値 */
const LADDER = [200, 400, 800] as const
/** img.ts のハードコード値 */
const QUALITY = 80

const concArg = process.argv.indexOf('--conc')
const CONC = Number(concArg === -1 ? (process.env.CONV_CONC ?? cpus().length) : process.argv[concArg + 1])

// libvips 自身のスレッドプールは切る。並列は in-flight 数で出すので、
// 二重に並列化すると 1 枚あたりのスレッド取り合いで遅くなる。
sharp.concurrency(1)
sharp.cache(false)

type Task = { uuid: string; src: string }
type Row =
  | {
      ok: true
      uuid: string
      originalBytes: number
      originalWidth: number
      originalHeight: number
      bytes: Record<string, number>
      outWidth: Record<string, number>
    }
  | { ok: false; uuid: string; error: string }

const shardOf = (uuid: string) => uuid.slice(0, 2)
const destOf = (uuid: string, w: number) => `${DST}/${shardOf(uuid)}/${uuid}.w${w}.webp`

async function convert(task: Task): Promise<Row> {
  try {
    const image = readFileSync(task.src)
    const bytes: Record<string, number> = {}
    const outWidth: Record<string, number> = {}
    let ow = 0
    let oh = 0

    for (const w of LADDER) {
      // withoutEnlargement: 原寸より大きい幅を要求しても拡大しない (img.ts の頭打ちと同じ挙動)
      const { data, info } = await sharp(image)
        .resize({ width: w, withoutEnlargement: true })
        .webp({ quality: QUALITY })
        .toBuffer({ resolveWithObject: true })

      // 打ち切りで切れたファイルを残さないよう、書き切ってから名前を付ける
      const dest = destOf(task.uuid, w)
      writeFileSync(`${dest}.part`, data)
      renameSync(`${dest}.part`, dest)
      bytes[w] = data.byteLength
      outWidth[w] = info.width
      if (ow === 0) {
        // resize 後の info には原寸が出ないので、縮小率から逆算せず素直に読む
        const meta = await sharp(image).metadata()
        ow = meta.width ?? 0
        oh = meta.height ?? 0
      }
    }

    return {
      ok: true,
      uuid: task.uuid,
      originalBytes: image.byteLength,
      originalWidth: ow,
      originalHeight: oh,
      bytes,
      outWidth
    }
  } catch (e) {
    return { ok: false, uuid: task.uuid, error: e instanceof Error ? e.message : String(e) }
  }
}

async function main(): Promise<void> {
  for (let i = 0; i < 256; i++) mkdirSync(`${DST}/${i.toString(16).padStart(2, '0')}`, { recursive: true })

  /** 再開用。NDJSON に成功が記録されていても、実体が欠けていれば作り直す */
  const done = new Set<string>()
  if (existsSync(OUT)) {
    for (const line of readFileSync(OUT, 'utf8').split('\n')) {
      if (!line.trim()) continue
      try {
        const r = JSON.parse(line) as Row
        if (r.ok) done.add(r.uuid)
      } catch {
        // 打ち切りで壊れた最終行は捨てる
      }
    }
  }

  const tasks: Task[] = []
  let skipped = 0
  for (let i = 0; i < 256; i++) {
    const shard = i.toString(16).padStart(2, '0')
    for (const uuid of await readdir(`${SRC}/${shard}`)) {
      if (uuid.endsWith('.part')) continue
      if (done.has(uuid) && LADDER.every((w) => existsSync(destOf(uuid, w)))) {
        skipped++
        continue
      }
      tasks.push({ uuid, src: `${SRC}/${shard}/${uuid}` })
    }
  }

  const limitArg = process.argv.indexOf('--limit')
  if (limitArg !== -1) tasks.length = Math.min(tasks.length, Number(process.argv[limitArg + 1]))

  process.stderr.write(
    `total ${(tasks.length + skipped).toLocaleString()} / skip ${skipped.toLocaleString()} / ` +
      `todo ${tasks.length.toLocaleString()}  (sharp, conc ${CONC}, q${QUALITY}, w${LADDER.join('/')})\n\n`
  )
  if (tasks.length === 0) return

  let cursor = 0
  let ok = 0
  let ng = 0
  let outBytes = 0
  const started = Date.now()

  const report = () => {
    const sec = (Date.now() - started) / 1000
    const eta = Math.round(((tasks.length - ok - ng) * sec) / Math.max(ok + ng, 1))
    process.stderr.write(
      `${(ok + ng).toLocaleString()}/${tasks.length.toLocaleString()}  ` +
        `ok ${ok.toLocaleString()} ng ${ng.toLocaleString()}  ` +
        `${(outBytes / 1024 ** 3).toFixed(2)} GiB  ${((ok + ng) / sec).toFixed(0)} 枚/s  ` +
        `残り ~${Math.floor(eta / 60)}m${eta % 60}s\n`
    )
  }

  await Promise.all(
    Array.from({ length: Math.min(CONC, tasks.length) }, async () => {
      for (;;) {
        const i = cursor++
        if (i >= tasks.length) return
        const row = await convert(tasks[i])
        appendFileSync(OUT, `${JSON.stringify(row)}\n`)
        if (row.ok) {
          ok++
          for (const w of LADDER) outBytes += row.bytes[w] ?? 0
        } else ng++
        if ((ok + ng) % 1000 === 0) report()
      }
    })
  )

  report()
  process.stderr.write(`\ndone. ${LADDER.length} 幅合計 ${(outBytes / 1024 ** 3).toFixed(2)} GiB -> ${DST}/\n`)
  if (ng > 0) process.stderr.write(`失敗 ${ng.toLocaleString()} 件は再実行で追いかけられる\n`)
}

await main()
