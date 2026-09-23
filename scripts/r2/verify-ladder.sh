#!/usr/bin/env bash
#
# R2 (nagisa-images) に入っているラダー WebP を照合する。
#
# ============================================================================
# 何をするか
# ============================================================================
#
# バケット内の全オブジェクトを列挙し、以下を出す。
#
#   - ローカル (.cache/webp-native) と R2 の件数が一致しているか
#   - 幅ごとの内訳 (w200 / w400 / w800 が同数あるか)
#   - `<uuid>/w<width>.webp` の形に合わないキーが混ざっていないか
#   - 合計サイズ
#
# scripts/r2/upload-ladder.sh の投入結果を確かめるために使う。投入を伴わない
# 読み取り専用の操作なので、いつ流しても安全。
#
# ============================================================================
# 前提
# ============================================================================
#
# upload-ladder.sh と同じ (`.env` の R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY、
# および s5cmd)。導入手順は upload-ladder.sh の冒頭を参照。
#
# ============================================================================
# 使い方
# ============================================================================
#
#   bash scripts/r2/verify-ladder.sh
#
# 687,420 件を列挙するので数分かかる。列挙結果は `.cache/r2-listing.txt` に
# 残すので、件数以外を調べたいときはそのファイルを直接見ればよい。
#
# 期待される出力 (2026-09-22 の全件投入直後):
#
#   ローカル: 687,420 件 / R2: 687,420 件
#   229140 w200 / 229140 w400 / 229140 w800
#   キー形式が想定外のもの: なし
#   合計 9.92 GiB
#
# 件数が合わない場合は upload-ladder.sh を流し直す。同じキーを上書きするだけなので
# 全件やり直しても壊れない。
#
set -euo pipefail

cd "$(dirname "$0")/../.."

set -a
source .env
set +a

: "${R2_ACCESS_KEY_ID:?Missing R2_ACCESS_KEY_ID}"
: "${R2_SECRET_ACCESS_KEY:?Missing R2_SECRET_ACCESS_KEY}"
R2_ACCOUNT_ID="${R2_ACCOUNT_ID:-2488ea57494b2dacae95a6e363e7dcb2}"

# シェルの AWS_* は ECR 用の本物の AWS キー。R2 のものに差し替える
# (詳細は upload-ladder.sh の同じ箇所のコメント)。
export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
export AWS_REGION=auto
export AWS_CONFIG_FILE=/dev/null
export AWS_SHARED_CREDENTIALS_FILE=/dev/null
export PATH="$HOME/.local/bin:$PATH"

BUCKET="nagisa-images"
ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
LISTING=".cache/r2-listing.txt"

command -v s5cmd >/dev/null || { echo "エラー: s5cmd が見つかりません。" >&2; exit 1; }

mkdir -p .cache

echo "R2 のオブジェクトを列挙中 (数分かかります)..."
s5cmd --endpoint-url "$ENDPOINT" ls "s3://${BUCKET}/*" > "$LISTING"

echo ""
echo "== 件数 =="
if [ -d .cache/webp-native ]; then
  printf "  ローカル: %'d 件\n" "$(find .cache/webp-native -type f -name '*.webp' | wc -l)"
else
  echo "  ローカル: .cache/webp-native が無いため比較できません"
fi
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
