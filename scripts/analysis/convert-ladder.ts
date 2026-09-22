/**
 * .cache/originals/ の元バイナリを、フロントが実際に要求する幅 (ラダー) の WebP に一括変換する。
 *
 * 変換条件は src/routes/img.ts と完全に同じにしてある (format webp / quality 80 /
 * 原寸より大きい幅を要求されたら幅指定なしで焼き直す)。したがってここで出る
 * バイト数はそのまま R2 に積まれる量であり、標本からの外挿ではない実測値になる。
 *
 * 出力は .cache/webp/<uuid 先頭2桁>/<uuid>.w<幅>.webp。R2 のキー <uuid>/w<幅>.webp とは
 * シャード用の 2 桁ディレクトリと区切り文字だけが違うので、投入時は機械的に変換できる。
 *
 * wasm の変換は CPU 律速で、1 プロセス内で await を並べても速くならない。
 * worker_threads でコア数ぶんのプロセスを立て、各ワーカーが自前の wasm インスタンスを持つ。
 *
 * 結果は NDJSON に逐次追記するので、途中で打ち切っても再実行で続きから走る。
 *
 * 使い方: bun run scripts/analysis/convert-ladder.ts [--limit N]
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { cpus } from 'node:os'
import { isMainThread, parentPort, Worker, workerData } from 'node:worker_threads'

const SRC = '.cache/originals'
const DST = '.cache/webp'
const OUT = '.cache/webp-ladder.ndjson'

/** src/app/components/proxy-image.tsx の LADDER / src/routes/img.ts の PERSISTED_WIDTHS と同じ値 */
const LADDER = [200, 400, 800] as const
/** img.ts のハードコード値 */
const QUALITY = 80

/**
 * コア数から決めてはいけない。20 コアのマシンで実測すると 8 が頭打ちで、
 * そこから増やすと目に見えて遅くなる (600 枚: 6→26 枚/s, 8→30, 10→21, 12→19, 16→9)。
 * cgroup の CPU 制限は掛かっていないので、wasm インスタンスを並べたことによる
 * メモリ帯域 / アロケータの競合と見ている。上げるより下げるほうが安全。
 */
const WORKERS = Number(process.env.CONV_WORKERS ?? Math.min(8, Math.max(1, cpus().length)))

type Task = { uuid: string; src: string }
type Ok = {
  uuid: string
  originalBytes: number
  originalWidth: number
  originalHeight: number
  /** 幅 -> 出力バイト数 */
  bytes: Record<string, number>
  /** 幅 -> 実際に出力された幅 (原寸に頭打ちされた場合は原寸幅) */
  outWidth: Record<string, number>
  /** 実行した encode 回数。原寸が小さい画像は 1 回で 3 幅ぶんを賄う */
  encodes: number
  ms: number
}
type Ng = { uuid: string; error: string }
type Row = (Ok & { ok: true }) | (Ng & { ok: false })

const shardOf = (uuid: string) => uuid.slice(0, 2)
const destOf = (uuid: string, w: number) => `${DST}/${shardOf(uuid)}/${uuid}.w${w}.webp`

// ---------------------------------------------------------------------------

if (isMainThread) {
  await main()
} else {
  runWorker()
}

// ---------------------------------------------------------------------------

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
      `todo ${tasks.length.toLocaleString()}  (${WORKERS} workers, q${QUALITY}, w${LADDER.join('/')})\n\n`
  )
  if (tasks.length === 0) return

  let cursor = 0
  let ok = 0
  let ng = 0
  let outBytes = 0
  let encodes = 0
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
    Array.from(
      { length: Math.min(WORKERS, tasks.length) },
      (_, id) =>
        new Promise<void>((resolve, reject) => {
          const worker = new Worker(new URL(import.meta.url), { workerData: { id } })

          const next = () => {
            if (cursor >= tasks.length) return void worker.postMessage(null)
            worker.postMessage(tasks[cursor++])
          }

          worker.on('message', (row: Row) => {
            appendFileSync(OUT, `${JSON.stringify(row)}\n`)
            if (row.ok) {
              ok++
              encodes += row.encodes
              for (const w of LADDER) outBytes += row.bytes[w] ?? 0
            } else ng++
            if ((ok + ng) % 500 === 0) report()
            next()
          })
          worker.on('error', reject)
          worker.on('exit', () => resolve())
          next()
        })
    )
  )

  report()
  process.stderr.write(
    `\ndone. ${LADDER.length} 幅合計 ${(outBytes / 1024 ** 3).toFixed(2)} GiB -> ${DST}/\n` +
      `encode ${encodes.toLocaleString()} 回 (${(encodes / Math.max(ok, 1)).toFixed(2)} 回/枚、` +
      `原寸が小さい画像は 1 回の出力を複数幅で使い回す)\n`
  )
  if (ng > 0) process.stderr.write(`失敗 ${ng.toLocaleString()} 件は再実行で追いかけられる\n`)
}

// ---------------------------------------------------------------------------

function runWorker(): void {
  const port = parentPort
  if (!port) throw new Error('parentPort missing')

  // ワーカーごとに自前の wasm インスタンスを持つ (import は各スレッドで独立して解決される)
  const ready = import('wasm-image-optimization').then((m) => m.optimizeImage)

  port.on('message', async (task: Task | null) => {
    if (task === null) return void port.close()
    const optimizeImage = await ready
    const t0 = Date.now()

    try {
      const image = readFileSync(task.src)

      /**
       * 最小の幅から始める。ここで originalWidth が分かるので、以降の幅は
       * 原寸に届くかどうかを判定できる。最大幅から始めると、原寸が小さい画像で
       * 拡大 (= 捨てる出力) を一番高い encode で引いてしまう。
       */
      const probe = await optimizeImage({ image, format: 'webp', width: LADDER[0], quality: QUALITY })
      if (!probe) throw new Error('optimizeImage returned null')
      const ow = probe.originalWidth

      /** 実効幅。原寸に届かない要求は img.ts と同じく幅指定なしに落とす */
      const effOf = (w: number): number | null => (ow >= w ? w : null)

      const cache = new Map<number | null, { data: Uint8Array; width: number }>()
      if (effOf(LADDER[0]) !== null) cache.set(LADDER[0], { data: probe.data, width: probe.width })

      const bytes: Record<string, number> = {}
      const outWidth: Record<string, number> = {}
      let encodes = 1

      for (const w of LADDER) {
        const eff = effOf(w)
        let hit = cache.get(eff)
        if (!hit) {
          const r = await optimizeImage({
            image,
            format: 'webp',
            quality: QUALITY,
            ...(eff === null ? {} : { width: eff })
          })
          if (!r) throw new Error(`optimizeImage returned null (w=${w})`)
          encodes++
          hit = { data: r.data, width: r.width }
          cache.set(eff, hit)
        }
        // 打ち切りで切れたファイルを残さないよう、書き切ってから名前を付ける
        const dest = destOf(task.uuid, w)
        writeFileSync(`${dest}.part`, hit.data)
        renameSync(`${dest}.part`, dest)
        bytes[w] = hit.data.byteLength
        outWidth[w] = hit.width
      }

      port.postMessage({
        ok: true,
        uuid: task.uuid,
        originalBytes: image.byteLength,
        originalWidth: ow,
        originalHeight: probe.originalHeight,
        bytes,
        outWidth,
        encodes,
        ms: Date.now() - t0
      } satisfies Row)
    } catch (e) {
      port.postMessage({
        ok: false,
        uuid: task.uuid,
        error: e instanceof Error ? e.message : String(e)
      } satisfies Row)
    }
  })
}
