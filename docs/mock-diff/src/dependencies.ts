import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export type Part = { id: string; author: string }

/**
 * 部品の USES を依存順に展開する。同じ CSS は一度だけ取り込む。
 * 決定稿は部品ごとに採用案が違うので、author は部品 id から引く関数でも受ける。
 */
export function components(dir: string, author: string | ((id: string) => string), ids: string[]): Part[] {
  const authorOf = typeof author === 'string' ? () => author : author
  const done = new Set<string>()
  const visiting = new Set<string>()
  const result: Part[] = []
  function visit(id: string) {
    if (done.has(id)) return
    if (visiting.has(id)) throw new Error(`部品の循環依存: ${[...visiting, id].join(' → ')}`)
    const who = authorOf(id)
    if (!existsSync(join(dir, `${id}-${who}.css`))) {
      throw new Error(`部品 CSS がありません: ${id}-${who}`)
    }
    visiting.add(id)
    const html = join(dir, `${id}-${who}.html`)
    if (existsSync(html)) {
      const head = readFileSync(html, 'utf-8').split('\n---\n')[0] ?? ''
      for (const dep of (head.match(/^USES: (.*)$/m)?.[1] ?? '').split(/\s+/).filter(Boolean)) visit(dep)
    }
    visiting.delete(id)
    done.add(id)
    result.push({ id, author: who })
  }
  for (const id of ids) visit(id)
  return result
}

/** mock-diff.adopted.yaml の採用案 (id → 作者)。 */
export function adopted(path: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of readFileSync(path, 'utf-8').split('\n')) {
    const m = line.match(/^\s+([\w-]+):\s*([\w-]+)\s*$/)
    if (m?.[1] && m[2]) out[m[1]] = m[2]
  }
  return out
}

/**
 * ページの USES を部品 id と作者の上書きに割る。`app-header@astra` のように書くと、
 * その部品だけ別案を取り込む (依存先はページの作者のまま)。
 */
export function parseUses(uses: string): { ids: string[]; pinned: Record<string, string> } {
  const ids: string[] = []
  const pinned: Record<string, string> = {}
  for (const token of uses.split(/\s+/).filter(Boolean)) {
    const [id = '', who] = token.split('@')
    ids.push(id)
    if (who) pinned[id] = who
  }
  return { ids, pinned }
}

/** ページの作者から部品の作者を決める。final は採用案、それ以外はページと同じ作者。pinned が最優先。 */
export function authorFor(
  pageAuthor: string,
  adoptedPath: string,
  pinned: Record<string, string> = {}
): (id: string) => string {
  if (pageAuthor !== 'final') return (id) => pinned[id] ?? pageAuthor
  const map = adopted(adoptedPath)
  return (id) => {
    const a = pinned[id] ?? map[id]
    if (!a || a === 'final') throw new Error(`採用案が決まっていない部品: ${id}`)
    return a
  }
}

/** ページ骨格の parts 名。決定稿は page-final-<SKELETON>、それ以外は page-<SKELETON ?? 作者>。 */
export function skeletonOf(pageAuthor: string, skeleton: string | undefined): string {
  if (pageAuthor === 'final') {
    if (!skeleton) throw new Error('決定稿には SKELETON: が要ります')
    return `page-final-${skeleton}`
  }
  return `page-${skeleton || pageAuthor}`
}
