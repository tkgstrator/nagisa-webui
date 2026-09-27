#!/usr/bin/env bun
/**
 * 生ログタブ (src/lib/observability.ts) が使う Workers Logs のキー名が、実物と合っているかを見る。
 *
 * 直近の LogTape 行を数件引き、source のトップレベルのキーと properties のキーを出す。
 * あわせて KEYS の各フィルタを 1 本ずつ掛け、0 件になるキーを知らせる。
 *
 *   CF_ACCOUNT_ID=... CF_OBSERVABILITY_TOKEN=... bun scripts/observability/check-keys.ts [worker-name] [hours]
 */
import { KEYS } from '../../src/lib/observability'

// Worker と同じ読み取り用トークンを優先する。デプロイ用の CLOUDFLARE_* は予備
const accountTag = process.env.CF_ACCOUNT_ID ?? process.env.CLOUDFLARE_ACCOUNT_ID
const token = process.env.CF_OBSERVABILITY_TOKEN ?? process.env.CLOUDFLARE_API_TOKEN
if (!accountTag || !token) {
  console.error('CF_ACCOUNT_ID / CF_OBSERVABILITY_TOKEN (または CLOUDFLARE_*) が未設定')
  process.exit(1)
}
const service = process.argv[2] ?? 'anime-tracker-staging'
const hours = Number(process.argv[3] ?? 24)

type Filter = { key: string; operation: string; type: 'string'; value?: string }

const query = async (filters: Filter[], limit: number): Promise<{ source: unknown }[]> => {
  const now = Date.now()
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountTag}/workers/observability/telemetry/query`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        queryId: 'check-keys',
        view: 'events',
        timeframe: { from: now - hours * 60 * 60 * 1000, to: now },
        limit,
        parameters: {
          filters: [{ key: KEYS.service, operation: 'eq', type: 'string', value: service }, ...filters],
          filterCombination: 'and'
        }
      })
    }
  )
  const json = (await res.json()) as { success: boolean; errors?: unknown; result?: { events?: { events?: [] } } }
  if (!res.ok || !json.success) throw new Error(`${res.status} ${JSON.stringify(json.errors)}`)
  return json.result?.events?.events ?? []
}

const sample = await query([{ key: KEYS.logger, operation: 'starts_with', type: 'string', value: 'app.' }], 20)
console.log(`${service}: ${KEYS.logger} starts_with 'app.' → ${sample.length} 件 (直近 ${hours} 時間)`)
const topKeys = new Set<string>()
const propKeys = new Set<string>()
for (const e of sample) {
  const src = typeof e.source === 'string' ? JSON.parse(e.source) : e.source
  if (src === null || typeof src !== 'object') continue
  for (const k of Object.keys(src)) topKeys.add(k)
  const props = (src as { properties?: object }).properties
  if (props) for (const k of Object.keys(props)) propKeys.add(k)
}
console.log('source のキー:', [...topKeys].sort().join(', '))
console.log('properties のキー:', [...propKeys].sort().join(', '))

// 値に依存しない exists で、各キーが Workers Logs 側で引けるかを見る
for (const [name, key] of Object.entries(KEYS)) {
  if (name === 'service') continue
  const hit = await query([{ key, operation: 'exists', type: 'string' }], 1)
  console.log(`${hit.length > 0 ? 'ok  ' : 'NONE'} ${name} (${key})`)
}
