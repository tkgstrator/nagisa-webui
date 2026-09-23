/**
 * nagisa の実物から採取した応答を、Workers 側の Zod DTO でそのまま parse する。
 * 両リポジトリの契約が一致していることの証拠であり、nagisa を上げたときの回帰検査。
 *
 *   python scripts/contract/capture-nagisa.py ~/nagisa scripts/contract/nagisa-1.5.2.json
 *   bun scripts/contract/verify-nagisa-contract.ts
 *
 * 採取側 (capture-nagisa.py) は Flask の test client を叩くだけなので、Redis も
 * 実際の録画ファイルも要らない。
 */
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  NagisaLibraryChangesSchema,
  NagisaLibraryErrorSchema,
  NagisaLibrarySnapshotSchema,
  NagisaLibraryStatsSchema,
  NagisaQueueSnapshotSchema,
  NagisaStatusSchema
} from '@/schemas/nagisa.dto'

type Entry = { status: number; body: unknown }

const fixture = process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), 'nagisa-1.5.2.json')
const doc = (await Bun.file(fixture).json()) as Record<string, Entry>

const cases: Array<[string, { parse: (v: unknown) => unknown }, number]> = [
  ['library_snapshot', NagisaLibrarySnapshotSchema, 200],
  ['library_snapshot_page2', NagisaLibrarySnapshotSchema, 200],
  ['library_stats', NagisaLibraryStatsSchema, 200],
  ['library_changes', NagisaLibraryChangesSchema, 200],
  ['library_changes_empty', NagisaLibraryChangesSchema, 200],
  ['library_changes_no_cursor', NagisaLibraryErrorSchema, 409],
  ['status', NagisaStatusSchema, 200],
  ['status_with_queue', NagisaStatusSchema, 200],
  ['queue_snapshot', NagisaQueueSnapshotSchema, 200]
]

let bad = 0
for (const [key, schema, wantStatus] of cases) {
  const entry = doc[key]
  if (!entry) {
    console.log(`✗ ${key}: 採取されていない`)
    bad++
    continue
  }
  if (entry.status !== wantStatus) {
    console.log(`✗ ${key}: status ${entry.status} (期待 ${wantStatus})`)
    bad++
    continue
  }
  try {
    schema.parse(entry.body)
    console.log(`✓ ${key} (${entry.status})`)
  } catch (e) {
    bad++
    console.log(`✗ ${key}:`, e instanceof Error ? e.message.slice(0, 600) : String(e))
  }
}

// 台帳→episodes の突き合わせ鍵が実データに揃っているか (library-sync.ts の matchKey)
const snap = NagisaLibrarySnapshotSchema.parse(doc.library_snapshot.body)
for (const item of snap.items) {
  if (!item.provider || !item.content_id || !item.episode_id) {
    console.log('✗ matchKey を作れない item:', JSON.stringify(item))
    bad++
  }
}
// 差分取り込みの証拠。空だと「壊れていても通る」検査になる
const changes = NagisaLibraryChangesSchema.parse(doc.library_changes.body)
if (changes.changes.length === 0) {
  console.log('✗ changes が空: 差分取り込みの証拠にならない')
  bad++
}

console.log(bad === 0 ? '\nすべて契約どおり' : `\n${bad} 件不一致`)
process.exit(bad === 0 ? 0 : 1)
