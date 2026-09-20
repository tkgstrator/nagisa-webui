#!/usr/bin/env bun
/**
 * ページがコンポーネントの組み合わせで出来ているかを検証する。
 *
 * 1. はみ出し — ページ HTML に現れる class のうち、base.css / page-<author>.css /
 *    USES に挙げた comp/<id>-<author>.css のいずれにも定義が無いもの。
 *    0 なら、そのページは骨格 (pg-*) と部品だけで構成されている。
 * 2. 衝突 — ページ骨格 (page-<author>.css) と部品が同じクラス名を定義しているもの。
 *    骨格の値が部品に、あるいはその逆に漏れるので 0 でなければならない。
 *
 * 使い方:
 *     bun run src/check.ts              # 全ページ + 衝突
 *     bun run src/check.ts browse-fable
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(fileURLToPath(import.meta.url))
const MOCKS = join(ROOT, '..', 'mocks')
const AUTHORS = ['fable', 'astra'] as const

/** CSS が定義するクラス名。コメント中の言及は数えない。 */
function defined(path: string): Set<string> {
  if (!existsSync(path)) return new Set()
  const css = readFileSync(path, 'utf-8').replace(/\/\*[\s\S]*?\*\//g, ' ')
  return new Set([...css.matchAll(/\.([a-zA-Z][\w-]*)/g)].flatMap((m) => m[1] ?? []))
}

function used(html: string): Set<string> {
  const out = new Set<string>()
  for (const m of html.matchAll(/class="([^"]*)"/g)) {
    for (const c of (m[1] ?? '').split(/\s+/)) if (c) out.add(c)
  }
  return out
}

/** 骨格と部品でクラス名がぶつかっていないか。ぶつかると値が相互に漏れる。 */
function clashes(): number {
  let bad = 0
  for (const author of AUTHORS) {
    const skel = defined(join(ROOT, 'parts', `page-${author}.css`))
    const comps = readdirSync(join(ROOT, 'comp'))
      .filter((f) => f.endsWith(`-${author}.css`))
      .sort()
    for (const f of comps) {
      const hit = [...defined(join(ROOT, 'comp', f))].filter((c) => skel.has(c)).sort()
      if (hit.length) {
        bad += hit.length
        console.log(`  衝突 page-${author} × ${basename(f, '.css')}: ${hit.join(' ')}`)
      }
    }
  }
  console.log(`骨格と部品の衝突 ${bad}`)
  return bad
}

function check(pid: string, author: string): number {
  const frag = readFileSync(join(ROOT, 'pages', `${pid}-${author}.html`), 'utf-8')
  const head = frag.split('\n---\n')[0] ?? frag
  const uses = (head.match(/^USES: (.*)$/m)?.[1] ?? '').split(/\s+/).filter(Boolean)
  const ok = new Set([
    ...defined(join(ROOT, 'parts', 'base.css')),
    ...defined(join(ROOT, 'parts', `page-${author}.css`)),
  ])
  for (const cid of uses) for (const c of defined(join(ROOT, 'comp', `${cid}-${author}.css`))) ok.add(c)
  const stray = [...used(readFileSync(join(MOCKS, `${pid}-${author}.html`), 'utf-8'))]
    .filter((c) => !ok.has(c))
    .sort()
  console.log(
    `${pid}-${author}: 部品 ${uses.length} / はみ出し ${stray.length}` +
      (stray.length ? `  ${stray.join(' ')}` : ''),
  )
  return stray.length
}

const args = process.argv.slice(2)
const targets = args.length
  ? args
  : readdirSync(join(ROOT, 'pages'))
      .filter((f) => f.endsWith('.html'))
      .map((f) => basename(f, '.html'))
      .sort()

let n = 0
for (const t of targets) {
  const at = t.lastIndexOf('-')
  n += check(t.slice(0, at), t.slice(at + 1))
}
if (!args.length) n += clashes()
process.exit(n ? 1 : 0)
