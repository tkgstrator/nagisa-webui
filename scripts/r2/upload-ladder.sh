#!/usr/bin/env bash
#
# 変換済みのラダー WebP を R2 に投入する。
#
# 変換は scripts/analysis/convert-ladder-native.ts が実施済みで、
# .cache/webp-native/<2桁>/<uuid>.w<width>.webp に 687,420 件 (229,140 × 3 幅 / 12 GB) がある。
#
# s5cmd sync 一発にならないのは、ローカルが <2桁>/<uuid>.w200.webp のフラット命名なのに対し、
# R2 のキーが webpKey() すなわち <uuid>/w200.webp (uuid がディレクトリ) で階層が違うため。
# find | sed で宛先キーを書いたコマンドリストに直してから s5cmd run に食わせる。
#
# 使い方: bash scripts/r2/upload-ladder.sh
#
set -euo pipefail

cd "$(dirname "$0")/../.."

# .env を読み込む (export なしの変数も拾う)
set -a
source .env
set +a

: "${R2_ACCESS_KEY_ID:?Missing R2_ACCESS_KEY_ID}"
: "${R2_SECRET_ACCESS_KEY:?Missing R2_SECRET_ACCESS_KEY}"
R2_ACCOUNT_ID="${R2_ACCOUNT_ID:-2488ea57494b2dacae95a6e363e7dcb2}"

# s5cmd は AWS_* を見るが、このシェルの AWS_* には ECR push 用の本物の AWS キーが
# 入っている。そのまま渡すと R2 に AWS のキーを送って
# "Credential access key has length 20, should be 32" で落ちる (CLAUDE.md の環境変数節)。
export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
export AWS_REGION=auto
# ~/.aws は R2 専用だが両プロファイルとも失効済み。読ませると事故になるので切る。
export AWS_CONFIG_FILE=/dev/null
export AWS_SHARED_CREDENTIALS_FILE=/dev/null

BUCKET="nagisa-images"
SRC=".cache/webp-native"
LIST=".cache/upload-commands.txt"
ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

# devcontainer feature が無いので ~/.local/bin に置いている
export PATH="$HOME/.local/bin:$PATH"

echo "コマンドリストを生成中..."
find "$SRC" -type f -name '*.webp' \
  | sed -E "s|^(.*/([0-9a-f-]{36})\.w([0-9]+)\.webp)\$|cp --content-type image/webp '\1' 's3://${BUCKET}/\2/w\3.webp'|" \
  > "$LIST"

echo "$(wc -l < "$LIST") 件 → $LIST"
echo "投入開始..."

s5cmd --endpoint-url "$ENDPOINT" run "$LIST"

echo "完了"
