/**
 * カタログの断片をページへ差し込む。
 *
 * ページのモックはコンポーネントの組み合わせなので、サイドバーやフッターのマークアップを
 * ページ側に書き写すと、カタログを直したときにページだけ古いまま残る。そこでページには
 *
 *     <!-- @part app-header:sticky current=録画一覧 -->
 *       …slot に入れる中身…
 *     <!-- /@part -->
 *
 * とだけ書き、ビルド時にカタログ comp/<id>-<作者>.html の `data-part="sticky"` が付いた
 * 要素を丸ごと持ってくる。中身が無いときは `<!-- @part app-footer:fixed /-->` と閉じてよい。
 *
 * - 中身は断片の `<!-- slot -->` の位置に入る。slot の無い断片に中身を渡すとエラー。
 * - `current=<title>` は断片の中の aria-current="page" を外し、title が一致するリンクに付け直す。
 * - 中身の中にさらに @part を書いてよい (入れ子は深さを数えて対応付ける)。取り込んだ断片の
 *   中の @part も展開する。
 */

const OPEN = /<!--\s*@part\s+([\w-]+):([\w-]+)((?:\s+[\w-]+=[^\s]+)*)\s*(\/)?-->/
const TOKEN = /<!--\s*(\/)?@part\b[^>]*?(\/)?-->/g
const SLOT = /<!--\s*slot\s*-->/

/** 開始タグの位置から、対応する閉じタグの直後まで。 */
function extent(html: string, start: number, tag: string): number {
  const scan = new RegExp(`<${tag}\\b|</${tag}\\s*>`, 'gi')
  scan.lastIndex = start
  let depth = 0
  for (let m = scan.exec(html); m !== null; m = scan.exec(html)) {
    depth += m[0].startsWith('</') ? -1 : 1
    if (depth === 0) return m.index + m[0].length
  }
  throw new Error(`<${tag}> が閉じていません`)
}

/** カタログから `data-part="<name>"` の付いた要素を 1 つ抜き出す。目印の属性は落とす。 */
export function extract(catalog: string, name: string, where: string): string {
  const open = new RegExp(`<([a-z][\\w-]*)\\b[^>]*\\sdata-part="${name}"[^>]*>`, 'i').exec(catalog)
  if (!open?.[1]) throw new Error(`${where} に data-part="${name}" がありません`)
  const html = catalog.slice(open.index, extent(catalog, open.index, open[1]))
  return html.replace(new RegExp(`\\sdata-part="${name}"`), '')
}

/** 断片の現在地を付け替える。 */
function setCurrent(html: string, title: string): string {
  const cleared = html.replace(/\s+aria-current="page"/g, '')
  const link = new RegExp(`<a\\b([^>]*)\\stitle="${title}"`)
  if (!link.test(cleared)) throw new Error(`current=${title}: title="${title}" のリンクがありません`)
  return cleared.replace(link, `<a$1 aria-current="page" title="${title}"`)
}

/**
 * html の中の @part を全部展開する。load は部品 id からカタログ本文 (メタ行を除いたもの) を返す。
 * used には展開した部品 id を積む (ページの USES との突き合わせ用)。
 */
export function expandParts(html: string, load: (id: string) => string, used = new Set<string>(), depth = 0): string {
  if (depth > 8) throw new Error('@part の入れ子が深すぎます (循環していませんか)')
  const open = OPEN.exec(html)
  if (!open) return html
  const [directive, id = '', name = '', args = '', selfClosing] = open
  const start = open.index
  let bodyStart = start + directive.length
  let end = bodyStart
  let children = ''
  if (!selfClosing) {
    // 対応する閉じを深さで探す。自己閉じの @part は深さを動かさない。
    TOKEN.lastIndex = bodyStart
    let level = 1
    let m: RegExpExecArray | null = null
    for (m = TOKEN.exec(html); m !== null; m = TOKEN.exec(html)) {
      if (m[1]) level -= 1
      else if (!m[2]) level += 1
      if (level === 0) break
    }
    if (!m) throw new Error(`@part ${id}:${name} が閉じていません`)
    children = html.slice(bodyStart, m.index).trim()
    end = m.index + m[0].length
  } else {
    bodyStart = end
  }

  used.add(id)
  let part = extract(load(id), name, `${id} のカタログ`)
  const opts = Object.fromEntries([...args.matchAll(/([\w-]+)=([^\s]+)/g)].map((a) => [a[1], a[2]]))
  if (opts.current) part = setCurrent(part, opts.current)
  if (children) {
    if (!SLOT.test(part)) throw new Error(`${id}:${name} には slot が無いので中身を入れられません`)
    part = part.replace(SLOT, () => children)
  } else {
    part = part.replace(new RegExp(`\\n?[ \\t]*${SLOT.source}`), '')
  }
  part = expandParts(part, load, used, depth + 1)
  return html.slice(0, start) + part + expandParts(html.slice(end), load, used, depth)
}
