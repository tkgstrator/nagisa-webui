#!/usr/bin/env bash
#
# R2 のラダー投入結果を照合する。
#
# ローカル (.cache/webp-native) の件数と R2 のオブジェクト数を突き合わせ、幅ごとの内訳を出す。
# 687,420 件を列挙するので数分かかる。
#
# 使い方: bash scripts/r2/verify-ladder.sh
#
set -euo pipefail

cd "$(dirname "$0")/../.."

set -a
source .env
set +a

: "${R2_ACCESS_KEY_ID:?Missing R2_ACCESS_KEY_ID}"
: "${R2_SECRET_ACCESS_KEY:?Missing R2_SECRET_ACCESS_KEY}"
R2_ACCOUNT_ID="${R2_ACCOUNT_ID:-2488ea57494b2dacae95a6e363e7dcb2}"

export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
export AWS_REGION=auto
export AWS_CONFIG_FILE=/dev/null
export AWS_SHARED_CREDENTIALS_FILE=/dev/null
export PATH="$HOME/.local/bin:$PATH"

BUCKET="nagisa-images"
ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
LISTING=".cache/r2-listing.txt"

echo "R2 のオブジェクトを列挙中 (数分かかります)..."
s5cmd --endpoint-url "$ENDPOINT" ls "s3://${BUCKET}/*" > "$LISTING"

echo ""
echo "== 件数 =="
printf "  ローカル: %'d 件\n" "$(find .cache/webp-native -type f -name '*.webp' | wc -l)"
printf "  R2      : %'d 件\n" "$(wc -l < "$LISTING")"

echo ""
echo "== R2 の幅別内訳 =="
sed -E 's|.*/(w[0-9]+)\.webp$|\1|' "$LISTING" | sort | uniq -c

echo ""
echo "== キー形式が想定外のもの (先頭5件) =="
grep -vE '[0-9a-f-]{36}/w[0-9]+\.webp$' "$LISTING" | head -5 || echo "  なし"

echo ""
echo "== 合計サイズ =="
awk '{ total += $(NF-1) } END { printf "  %.2f GiB\n", total / 1024 / 1024 / 1024 }' "$LISTING"
