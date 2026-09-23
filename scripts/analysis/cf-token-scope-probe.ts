/**
 * .env の CLOUDFLARE_API_TOKEN に何の権限が付いているかを確認する。読み取り専用。
 *
 * D1 は通る (scripts/analysis/d1-param-limit-probe.ts) ことが分かっているが、
 * R2 が見えるかどうかで「既存トークンを広げれば済む」のか「R2 キーを別途作る」のかが変わる。
 * なお R2 のオブジェクト操作は S3 API 専用で、このトークンでは代用できない。
 * ここで見ているのはあくまでバケット管理 API の可否。
 */

const token = process.env.CLOUDFLARE_API_TOKEN
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID

if (!token || !accountId) {
  console.error('CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID が未設定です。')
  process.exit(1)
}

const headers = { authorization: `Bearer ${token}` }

async function probe(label: string, path: string) {
  try {
    const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, { headers })
    const json = (await res.json()) as { success: boolean; errors?: { code: number; message: string }[]; result?: unknown }
    if (json.success) {
      const count = Array.isArray(json.result) ? `${json.result.length} 件` : 'OK'
      console.log(`  ${label.padEnd(24)} OK   ${count}`)
      return json.result
    }
    const err = json.errors?.[0]
    console.log(`  ${label.padEnd(24)} FAIL [${err?.code}] ${err?.message}`)
  } catch (e) {
    console.log(`  ${label.padEnd(24)} ERROR ${e instanceof Error ? e.message : String(e)}`)
  }
  return null
}

console.log(`account: ...${accountId.slice(-4)}\n`)

await probe('token verify', '/user/tokens/verify')
const buckets = await probe('R2 bucket 一覧', `/accounts/${accountId}/r2/buckets`)
await probe('D1 一覧', `/accounts/${accountId}/d1/database`)

if (buckets && typeof buckets === 'object' && 'buckets' in buckets) {
  const list = (buckets as { buckets: { name: string }[] }).buckets
  console.log(`\n  バケット: ${list.map((b) => b.name).join(', ')}`)
}
