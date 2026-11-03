import type { createPrismaClient } from '../db'
import { chunk, type LedgerRow, type MatchKey, rowKey } from './ledger'
import { IN_CHUNK } from './limits'

type Prisma = ReturnType<typeof createPrismaClient>

/**
 * この upsert 群が **Jellyfin に新しいファイルを足すか** を返す。
 *
 * 解決先のエピソードのうち、同じ録画 (`recording_id` 一致) で既に `completed` なもの以外が
 * 1 つでもあれば true。パス・容量だけが変わった再走査は false (新しいファイルではない)。
 * 別の録画で上書きされるケースは true (ファイルが差し替わる)。
 * 負けた行も数えるので多少 true に寄るが、余分な更新は害にならない (冪等)。
 */
export async function hasNewCompleted(
  prisma: Prisma,
  rows: LedgerRow[],
  resolved: Map<MatchKey, string[]>
): Promise<boolean> {
  const wanted = new Map<string, Set<string>>()
  for (const row of rows) {
    const key = rowKey(row.item)
    if (key === null) continue
    for (const id of resolved.get(key) ?? []) {
      const set = wanted.get(id)
      if (set) set.add(row.recordingId)
      else wanted.set(id, new Set([row.recordingId]))
    }
  }
  if (wanted.size === 0) return false

  const pages = await Promise.all(
    chunk([...wanted.keys()], IN_CHUNK).map((part) =>
      prisma.episode.findMany({
        where: { id: { in: part }, recordStatus: 'completed' },
        select: { id: true, recordingId: true }
      })
    )
  )
  const settled = new Set(
    pages
      .flat()
      .filter((e) => e.recordingId !== null && wanted.get(e.id)?.has(e.recordingId))
      .map((e) => e.id)
  )
  return [...wanted.keys()].some((id) => !settled.has(id))
}
