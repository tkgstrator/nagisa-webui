/**
 * R2 への到達性を確かめるだけのプローブ。読み取り専用。
 *
 * `~/.aws` の 2 プロファイル (default / r2) はどちらも ListBuckets から Unauthorized で、
 * 失効している。一方 `scripts/fetch/common/upload_images.sh` は `.env` の
 * `R2_IMAGE_ACCESS_KEY_ID` / `R2_IMAGE_SECRET_ACCESS_KEY` を使っているので、
 * そちらが生きていないかを確かめる。
 *
 * 秘密そのものは出力しない (先頭 6 文字だけ、どのキーを見ているかの判別用)。
 *
 * 実行: bun scripts/analysis/r2-access-probe.ts
 */

const BUCKET = 'nagisa-images'
const accountId = process.env.R2_ACCOUNT_ID ?? '2488ea57494b2dacae95a6e363e7dcb2'

const candidates = [
  { label: 'R2_IMAGE_*', id: process.env.R2_IMAGE_ACCESS_KEY_ID, secret: process.env.R2_IMAGE_SECRET_ACCESS_KEY },
  { label: 'R2_*', id: process.env.R2_ACCESS_KEY_ID, secret: process.env.R2_SECRET_ACCESS_KEY }
]

for (const { label, id, secret } of candidates) {
  if (!id || !secret) {
    console.log(`${label}: 未設定`)
    continue
  }

  const client = new Bun.S3Client({
    accessKeyId: id,
    secretAccessKey: secret,
    bucket: BUCKET,
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`
  })

  try {
    const listed = await client.list({ maxKeys: 5 })
    const total = listed.keyCount ?? listed.contents?.length ?? 0
    console.log(`${label} (${id.slice(0, 6)}…): OK  先頭 ${total} 件`)
    for (const obj of listed.contents ?? []) {
      console.log(`    ${obj.key}  ${obj.size} bytes`)
    }
  } catch (e) {
    console.log(`${label} (${id.slice(0, 6)}…): FAIL  ${e instanceof Error ? e.message : String(e)}`)
  }
}
