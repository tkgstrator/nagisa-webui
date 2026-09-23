/**
 * D1 の bound parameter 上限を実測する。
 *
 * docs (d1/platform/limits) は「Maximum bound parameters per query: 100」と書いているが、
 * `src/lib/sync/queries.ts` の `D1_VARIABLE_LIMIT` は 500 で、コメントは SQLite 既定の 999 を
 * 根拠にしている。どちらが実態かはローカル D1 (素の SQLite) では再現しないので、
 * リモートの D1 HTTP API に直接投げて確かめる。
 *
 * テーブルには触らない。`SELECT ?, ?, ...` でバインド数だけを振る読み取り専用クエリ。
 *
 * 実行: bun scripts/analysis/d1-param-limit-probe.ts
 *   (bun が .env を自動で読む。CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID が要る)
 */

const DATABASE_ID = 'e1e78f23-da35-4d74-8de0-667a8d7ddefc' // anime-tracker-staging
const COUNTS = [1, 50, 99, 100, 101, 150, 500, 999]

const token = process.env.CLOUDFLARE_API_TOKEN
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID

if (!token || !accountId) {
  console.error('CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID が未設定です。`source .env` してから実行してください。')
  process.exit(1)
}

// 末尾 2 桁だけ出す。過去に account id の取り違え (末尾 b4 / b2) で 10000 番台のエラーに
// 化けた事例があるので、失敗時にどちらを見ていたか判別できるようにしておく。
console.log(`account: ...${accountId.slice(-4)} / database: ${DATABASE_ID}`)
console.log('')

const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${DATABASE_ID}/query`

for (const n of COUNTS) {
  const sql = `SELECT ${Array(n).fill('?').join(', ')}`
  const params = Array.from({ length: n }, (_, i) => String(i))

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ sql, params })
    })
    const json = (await res.json()) as {
      success: boolean
      errors?: { code: number; message: string }[]
    }

    if (json.success) {
      console.log(`  ${String(n).padStart(3)} params: OK`)
    } else {
      const err = json.errors?.[0]
      console.log(`  ${String(n).padStart(3)} params: FAIL  [${err?.code}] ${err?.message}`)
    }
  } catch (e) {
    console.log(`  ${String(n).padStart(3)} params: ERROR ${e instanceof Error ? e.message : String(e)}`)
  }
}
