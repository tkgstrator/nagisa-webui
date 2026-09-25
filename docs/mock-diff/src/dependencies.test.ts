import { afterEach, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { components, parseUses, skeletonOf } from './dependencies'

const dirs: string[] = []
function fixture(entries: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), 'mock-dependencies-'))
  dirs.push(dir)
  for (const [id, uses] of Object.entries(entries)) {
    writeFileSync(join(dir, `${id}-astra.css`), `.${id} { display: block; }`)
    writeFileSync(join(dir, `${id}-astra.html`), `TITLE: ${id}\nUSES: ${uses}\n---\n`)
  }
  return dir
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true })
})

test('共有依存は先に一度だけ取り込む', () => {
  const dir = fixture({ tone: '', button: 'tone', chip: 'tone', header: 'button chip' })
  expect(components(dir, 'astra', ['header', 'button']).map((c) => c.id)).toEqual(['tone', 'button', 'chip', 'header'])
})
test('循環依存はビルドを止める', () => {
  const dir = fixture({ button: 'header', header: 'button' })
  expect(() => components(dir, 'astra', ['header'])).toThrow('循環依存')
})
test('存在しない部品を拒否する', () => {
  const dir = fixture({ header: 'missing' })
  expect(() => components(dir, 'astra', ['header'])).toThrow('部品 CSS がありません')
})
test('従来の CSS のみの部品も扱える', () => {
  const dir = fixture({})
  writeFileSync(join(dir, 'layout-astra.css'), '.layout {}')
  expect(components(dir, 'astra', ['layout'])).toEqual([{ id: 'layout', author: 'astra' }])
})
test('部品ごとに作者を切り替えられる', () => {
  const dir = fixture({ tone: '', header: 'tone' })
  writeFileSync(join(dir, 'chip-fable.css'), '.chip {}')
  writeFileSync(join(dir, 'chip-fable.html'), 'TITLE: chip\nUSES: tone\n---\n')
  const who = (id: string) => (id === 'chip' ? 'fable' : 'astra')
  expect(components(dir, who, ['header', 'chip'])).toEqual([
    { id: 'tone', author: 'astra' },
    { id: 'header', author: 'astra' },
    { id: 'chip', author: 'fable' }
  ])
})

test('USES の id@author はその部品だけ作者を固定する', () => {
  expect(parseUses('app-header@astra error-state app-footer@astra')).toEqual({
    ids: ['app-header', 'error-state', 'app-footer'],
    pinned: { 'app-header': 'astra', 'app-footer': 'astra' }
  })
})
test('骨格は SKELETON 優先、無ければ作者名', () => {
  expect(skeletonOf('fable', undefined)).toBe('page-fable')
  expect(skeletonOf('fable', 'final-astra')).toBe('page-final-astra')
  expect(skeletonOf('final', 'fable')).toBe('page-final-fable')
  expect(() => skeletonOf('final', undefined)).toThrow()
})
