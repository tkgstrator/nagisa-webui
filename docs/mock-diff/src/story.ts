/**
 * カタログに名札を打つ。
 *
 * コンポーネントのモックは「その部品の全状態を 1 枚に並べた表」であり、作る側に
 * とってはそれが正しい形だが、1 つの状態だけを見たいときには邪魔になる。そこで
 * ビルド時に、状態を 1 つ受け持っている要素へ `data-story="<名前>"` を打っておく。
 * mock-diff の viewer はこの属性を見て、選ばれた状態以外を隠す。
 *
 * 名前は「節の見出し / ラベル」。ラベルだけだと hover や通常が節をまたいで何度も
 * 出てくるので、Storybook の Component/Story と同じ要領で節名を前に置く。
 *
 * 目印を付けるのは「`<span class="cat-label">` を直に抱えている要素」だけで、その
 * 外側の枠 (`.cat-item cat-full` が中に何個も並べている場合など) には付けない。
 * 外側を隠すと中身ごと消えてしまうため。ラベルを一切含まない `.cat-item` は
 * それ自体が 1 つの見本なので、節の見出しを名前にして打つ。
 */

const H2 = /<h2\b[^>]*>([\s\S]*?)<\/h2>/gi
const LABEL = /<span\s+class="cat-label[^"]*"\s*>/gi
const CAT_ITEM = /<div\s+class="cat-item[^"]*"\s*>/gi
/** 見出しやラベルに添えられた補足。名前には入れない。 */
const ASIDE =
  /<(small|span)\b[^>]*class="[^"]*cat-hint[^"]*"[^>]*>[\s\S]*?<\/\1>|<small\b[^>]*>[\s\S]*?<\/small>/gi
const TAG = /<[^>]*>/g

/** 表示されている文字だけ。補足とタグを落として空白を畳む。 */
const text = (html: string): string =>
  html.replace(ASIDE, ' ').replace(TAG, ' ').replace(/\s+/g, ' ').trim()

const escapeAttr = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')

/** `<div ...>` の開始位置から、対応する `</div>` の直後まで。div は自己閉じしない。 */
function divExtent(html: string, start: number): number {
  const scan = /<div\b|<\/div\s*>/gi
  scan.lastIndex = start
  let depth = 0
  for (const match of matches(scan, html)) {
    depth += match[0].startsWith('</') ? -1 : 1
    if (depth === 0) return match.index + match[0].length
  }
  return html.length
}

/** 開始位置を動かしながら回す用。`matchAll` は lastIndex を尊重しない。 */
function* matches(re: RegExp, html: string): Generator<RegExpExecArray> {
  const found = re.exec(html)
  if (found === null) return
  yield found
  yield* matches(re, html)
}

/** `<span class="cat-label">` の中身。入れ子の span を数えて閉じを見つける。 */
function labelText(html: string, openEnd: number): string {
  const scan = /<span\b|<\/span\s*>/gi
  scan.lastIndex = openEnd
  let depth = 1
  for (const match of matches(scan, html)) {
    depth += match[0].startsWith('</') ? -1 : 1
    if (depth === 0) return text(html.slice(openEnd, match.index))
  }
  return text(html.slice(openEnd))
}

/** ラベルを直に抱えている要素の開始タグ。直前の `>` からその `<` まで戻る。 */
function owner(html: string, labelStart: number): { start: number; end: number } | undefined {
  let end = labelStart
  while (end > 0 && /\s/.test(html[end - 1] ?? '')) end -= 1
  if (html[end - 1] !== '>') return undefined
  const start = html.lastIndexOf('<', end - 1)
  if (start === -1) return undefined
  const tag = html.slice(start, end)
  // 閉じタグと自己閉じタグは何も抱えていない。
  if (tag.startsWith('</') || tag.endsWith('/>')) return undefined
  return { start, end }
}

/** その位置より前にある最後の `<h2>` の文字列。節の外なら空。 */
function heading(sections: { at: number; name: string }[], at: number): string {
  let name = ''
  for (const section of sections) {
    if (section.at > at) break
    name = section.name
  }
  return name
}

/**
 * カタログの本文に `data-story` を打ったもの。1 枚の中で名前は重複しないよう
 * 連番を振る。名前の付けようが無い要素には何も打たない (常に見える)。
 */
export function mark(body: string): string {
  const sections = [...body.matchAll(H2)].map((match) => ({
    at: match.index,
    name: text(match[1] ?? ''),
  }))

  // 「開始タグの末尾 → 打つ名前」。同じ要素を二度打たないよう位置で持つ。
  const marks = new Map<number, string>()
  const taken = new Set<string>()
  const unique = (base: string): string => {
    const name = base === '' ? '見本' : base
    if (!taken.has(name)) {
      taken.add(name)
      return name
    }
    for (let n = 2; ; n += 1) {
      const numbered = `${name} ${n}`
      if (!taken.has(numbered)) {
        taken.add(numbered)
        return numbered
      }
    }
  }

  for (const match of body.matchAll(LABEL)) {
    const cell = owner(body, match.index)
    if (cell === undefined) continue
    const label = labelText(body, match.index + match[0].length)
    if (label === '') continue
    const section = heading(sections, cell.start)
    marks.set(cell.end - 1, unique(section === '' ? label : `${section} / ${label}`))
  }

  // ラベルを 1 つも含まない見本は、それ自体が 1 つの状態。
  for (const match of body.matchAll(CAT_ITEM)) {
    const end = match.index + match[0].length
    if (marks.has(end - 1)) continue
    if (body.slice(match.index, divExtent(body, match.index)).includes('cat-label')) continue
    marks.set(end - 1, unique(heading(sections, match.index)))
  }

  // 後ろから差し込む。前を書き換えると後ろの位置がずれるため。
  const at = [...marks.keys()].sort((a, b) => b - a)
  return at.reduce((html, index) => {
    const name = marks.get(index)
    if (name === undefined) return html
    return `${html.slice(0, index)} data-story="${escapeAttr(name)}"${html.slice(index)}`
  }, body)
}
