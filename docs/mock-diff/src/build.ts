#!/usr/bin/env bun
/**
 * モックのビルド。
 *
 *   comp モード: tokens + base + harness + 部品CSS を結合し、コンポーネントの状態カタログを
 *                mocks/components/<id>-<author>.html に出力する。部品CSS の :hover /
 *                :focus-* ルールは .is-hover / .is-focus を併記したコピーを自動生成し、
 *                カタログ上で擬似クラスを静的に見せられるようにする。
 *   page モード: tokens + base + page-<author>.css + USES に挙げた部品CSS を結合し、
 *                mocks/<id>-<author>.html に出力する。ページはコンポーネントの組み合わせ
 *                なので、部品CSS を再定義せず comp/ のものをそのまま取り込む。
 *                SKELETON: <name> で骨格を page-<name>.css に差し替えられ、USES の
 *                <id>@<author> でその部品だけ別案を取り込める。
 *   決定稿:      <id>-final.html は部品ごとに mock-diff.adopted.yaml の採用案を取り込み、
 *                骨格は SKELETON: (astra | fable) に対応する page-final-<skeleton>.css、
 *                最後に still.css (撮影用にアニメーションを止める) を重ねる。
 *
 * 使い方:
 *     bun run src/build.ts                 # 全部
 *     bun run src/build.ts anime-card-fable browse-fable
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { authorFor, components, parseUses, skeletonOf } from './dependencies'
import { mark } from './story'

const ROOT = dirname(fileURLToPath(import.meta.url))
const MOCKS = join(ROOT, '..', 'mocks')
const PARTS = join(ROOT, 'parts')
const COMP = join(ROOT, 'comp')
const PAGES = join(ROOT, 'pages')
const ADOPTED = join(ROOT, '..', 'mock-diff.adopted.yaml')

/** CSS コメント。プリリュード中の位置を保つため findall と sub の両方で使う。 */
const commentRe = () => /\/\*[\s\S]*?\*\//g

type Chunk = { kind: 'rule'; prelude: string; body: string } | { kind: 'raw'; text: string }

/** 波括弧をバランス走査して「プリリュード + 本体」の並びに割る。 */
function splitRules(css: string): Chunk[] {
  const chunks: Chunk[] = []
  let buf = ''
  let i = 0
  while (i < css.length) {
    if (css[i] === '{') {
      const prelude = buf
      buf = ''
      let depth = 1
      let j = i + 1
      while (j < css.length && depth > 0) {
        if (css[j] === '{') depth += 1
        else if (css[j] === '}') depth -= 1
        j += 1
      }
      chunks.push({ kind: 'rule', prelude, body: css.slice(i + 1, j - 1) })
      i = j
      continue
    }
    buf += css[i]
    i += 1
  }
  if (buf.trim()) chunks.push({ kind: 'raw', text: buf })
  return chunks
}

/** :hover / :focus-* を .is-hover / .is-focus に複製する (カタログ専用)。 */
function transform(css: string): string {
  const out: string[] = []
  for (const chunk of splitRules(css)) {
    if (chunk.kind === 'raw') {
      out.push(chunk.text)
      continue
    }
    const { prelude, body } = chunk
    const lead = (prelude.match(commentRe()) ?? []).join('')
    const sel = prelude.replace(commentRe(), '').trim()
    const preWs = prelude.match(/^\s*/)?.[0] ?? ''
    if (sel.startsWith('@media') || sel.startsWith('@supports')) {
      out.push(`${preWs}${lead}${sel} {${transform(body)}}`)
    } else if (sel.startsWith('@')) {
      out.push(`${preWs}${lead}${sel} {${body}}`)
    } else {
      const sels = sel
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      const extra: string[] = []
      for (const s of sels) {
        if (s.includes(':hover')) extra.push(s.replace(':hover', '.is-hover'))
        if (s.includes(':focus-within')) extra.push(s.replace(':focus-within', '.is-focus'))
        if (s.includes(':focus-visible')) extra.push(s.replace(':focus-visible', '.is-focus'))
      }
      out.push(`${preWs}${lead}${[...sels, ...extra].join(', ')} {${body}}`)
    }
  }
  return out.join('')
}

const rstrip = (s: string) => s.replace(/\s+$/, '')
const read = (p: string) => rstrip(readFileSync(p, 'utf-8'))

/** 先頭のメタ行と本文 (`---` だけの行で区切る) に割る。 */
function metaSplit(frag: string): { meta: Record<string, string>; body: string } {
  const at = frag.indexOf('\n---\n')
  const head = at === -1 ? frag : frag.slice(0, at)
  const body = at === -1 ? '' : frag.slice(at + 5)
  const meta: Record<string, string> = {}
  for (const line of head.trim().split('\n')) {
    const i = line.indexOf(': ')
    if (i === -1) meta[line.trim()] = ''
    else meta[line.slice(0, i).trim()] = line.slice(i + 2).trim()
  }
  return { meta, body: rstrip(body) }
}

const page = (title: string, css: string, bodyattr: string, body: string) => `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
${css}
</style>
</head>
<body${bodyattr}>
${body}
</body>
</html>
`

function buildComp(cid: string, author: string): [string, string] {
  const { meta, body } = metaSplit(readFileSync(join(COMP, `${cid}-${author}.html`), 'utf-8'))
  const css = [read(join(PARTS, 'tokens.css')), read(join(PARTS, 'base.css')), read(join(PARTS, 'harness.css'))]
  const stage = join(COMP, `${cid}-${author}.stage.css`)
  if (existsSync(stage)) css.push(`/* ---------- catalog stage: ${cid} ---------- */\n${read(stage)}`)
  for (const dep of components(COMP, author, [cid])) {
    css.push(
      `/* ---------- component: ${dep.id} ---------- */\n${transform(read(join(COMP, `${dep.id}-${dep.author}.css`))).trim()}`
    )
  }
  const html = page(
    `${meta.TITLE} — ${author} 案 | Nagisa WebUI コンポーネントモック`,
    css.join('\n'),
    '',
    `<main class="cat">\n${mark(body)}\n</main>`
  )
  const dst = join(MOCKS, 'components', `${cid}-${author}.html`)
  mkdirSync(dirname(dst), { recursive: true })
  writeFileSync(dst, html, 'utf-8')
  return [dst, html]
}

function buildPage(pid: string, author: string): [string, string] {
  const { meta, body } = metaSplit(readFileSync(join(PAGES, `${pid}-${author}.html`), 'utf-8'))
  const final = author === 'final'
  const css = [
    read(join(PARTS, 'tokens.css')),
    read(join(PARTS, 'base.css')),
    read(join(PARTS, `${skeletonOf(author, meta.SKELETON)}.css`))
  ]
  const { ids, pinned } = parseUses(meta.USES ?? '')
  for (const c of components(COMP, authorFor(author, ADOPTED, pinned), ids)) {
    css.push(`/* ---------- component: ${c.id} ---------- */\n${read(join(COMP, `${c.id}-${c.author}.css`))}`)
  }
  if (final) css.push(read(join(PARTS, 'still.css')))
  const html = page(
    `${meta.TITLE} — ${final ? '決定稿' : `${author} 案`} | Nagisa WebUI モック`,
    css.join('\n'),
    meta.BODY ?? '',
    body
  )
  const dst = join(MOCKS, `${pid}-${author}.html`)
  writeFileSync(dst, html, 'utf-8')
  return [dst, html]
}

function build(target: string): string {
  const at = target.lastIndexOf('-')
  const [id, author] = [target.slice(0, at), target.slice(at + 1)]
  const [dst, html] = existsSync(join(PAGES, `${target}.html`)) ? buildPage(id, author) : buildComp(id, author)
  return `${relative(join(MOCKS, '..'), dst)}  ${html.split('\n').length} lines`
}

const stems = (dir: string) =>
  readdirSync(dir)
    .filter((f) => f.endsWith('.html'))
    .map((f) => basename(f, '.html'))
    .sort()

const targets = process.argv.slice(2)
for (const t of targets.length ? targets : [...stems(PAGES), ...stems(COMP)]) {
  console.log(build(t))
}
