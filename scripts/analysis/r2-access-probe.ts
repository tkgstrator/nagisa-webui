/**
 * R2 への到達性を切り分けるプローブ。読み取り専用。
 *
 * ============================================================================
 * 何のためにあるか
 * ============================================================================
 *
 * R2 を叩く操作が失敗したとき、原因が「認証情報が無い / 失効している」のか
 * 「バケットやキーの指定が違う」のかを最初に切り分けるために使う。
 *
 * このリポジトリには R2 の認証情報が入りうる場所が複数あり、どれが生きているかが
 * 分かりにくい。実際に 2026-09-22 時点では次の状態だった。
 *
 *   ~/.aws の [default] / [r2]  … どちらも R2 キーだが**両方失効**
 *                                  (ListBuckets すら Unauthorized)
 *   .env の R2_IMAGE_*           … `scripts/fetch/common/upload_images.sh` が
 *                                  期待している名前だが**未設定**
 *   .env の R2_*                 … こちらが現役
 *
 * さらに、シェルの `AWS_ACCESS_KEY_ID` には ECR push 用の**本物の AWS キー**が
 * 入っているため、素の `aws` CLI は R2 プロファイルより env を優先してしまい
 * "Credential access key has length 20, should be 32" で落ちる。
 * このスクリプトは env や ~/.aws を一切見ず、`.env` の値だけを明示的に使うので、
 * その干渉を受けずに「キー自体が生きているか」だけを判定できる。
 *
 * ============================================================================
 * 使い方
 * ============================================================================
 *
 *   bun scripts/analysis/r2-access-probe.ts
 *
 * bun が `.env` を自動で読むので `source .env` は不要 (というより secrets-guard に
 * 阻まれるのでできない)。出力例:
 *
 *   R2_IMAGE_*: 未設定
 *   R2_* (11f5e7…): OK  先頭 5 件
 *       00001656-…/w200.webp  4940 bytes
 *
 * `FAIL Unauthorized` が出たらトークンが失効しているので、Cloudflare ダッシュボードの
 * R2 > API トークンで nagisa-images に Object Read & Write を持つものを作り直し、
 * `.env` の R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY を差し替える。
 *
 * 秘密そのものは出力しない (どのキーを見ているか判別するため先頭 6 文字だけ出す)。
 */

const BUCKET = 'nagisa-images'
const accountId = process.env.R2_ACCOUNT_ID ?? '2488ea57494b2dacae95a6e363e7dcb2'

/** `.env` に入りうる 2 通りの名前を順に試す。前者は upload_images.sh の流儀。 */
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
