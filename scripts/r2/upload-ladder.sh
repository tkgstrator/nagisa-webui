#!/usr/bin/env bash
#
# 変換済みのラダー WebP を R2 (nagisa-images) に一括投入する。
#
# ============================================================================
# 何をするか
# ============================================================================
#
# ローカルに変換済みで置いてある WebP を、`src/lib/image-key.ts` の `webpKey()` と
# 同じキーで R2 に流し込む。リクエスト時の変換とオリジン取得を不要にするための
# 事前投入で、`src/lib/image-warm.ts` の Lambda 経由 warm とは別経路。
#
# ローカルに原本がある分はこちらの方が速く、Crunchyroll の geo-block も
# Lambda Function URL の 6 MB 上限も通らない。warm が相手にするのは
# 「今後新しく見つかる画像」だけでよくなる。
#
# ============================================================================
# 前提
# ============================================================================
#
# 1. 変換済みデータが `.cache/webp-native/` にあること
#
#    `.cache/webp-native/<uuid の先頭2桁>/<uuid>.w<width>.webp`
#    687,420 件 = 229,140 画像 × 3 幅 (200/400/800) / 約 12 GB
#
#    無ければ `scripts/analysis/convert-ladder-native.ts` で作る。その入力は
#    `.cache/originals/` (原本 229,140 件 / 146 GB、`download-originals.ts` が取得)。
#    どちらも .gitignore 済みでリポジトリには入らない。
#
# 2. `.env` に R2 の認証情報があること
#
#    R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY
#    (Cloudflare ダッシュボード > R2 > API トークン。nagisa-images に Object Read & Write)
#    R2_ACCOUNT_ID は未設定なら既定値を使う。
#
# 3. s5cmd が入っていること
#
#    公式の devcontainer feature は存在しないので postCreateCommand か手動で入れる:
#      VER=$(curl -sL https://api.github.com/repos/peak/s5cmd/releases/latest \
#            | grep -oE '"tag_name": "v[^"]+"' | head -1 | grep -oE '[0-9.]+')
#      curl -sL "https://github.com/peak/s5cmd/releases/download/v${VER}/s5cmd_${VER}_Linux-arm64.tar.gz" \
#        | tar xz -C ~/.local/bin s5cmd
#
# ============================================================================
# 使い方
# ============================================================================
#
#   bash scripts/r2/upload-ladder.sh
#
# 所要時間は実測で約 35 分 (687,420 オブジェクト)。Class A 操作が同数発生するので
# 課金は約 $3.09。何度流しても同じキーを上書きするだけなので冪等で、中断したら
# そのまま再実行してよい (未投入分だけを選ぶ機能は無く、全件を投げ直す)。
#
# 投入後の照合は scripts/r2/verify-ladder.sh を使う。
#
# ============================================================================
# なぜ s5cmd sync 一発ではないのか
# ============================================================================
#
# ローカルとリモートでキーの階層が違うため。
#
#   ローカル: .cache/webp-native/a0/a05f53b7-….w200.webp   ← シャード直下のフラット
#   R2 キー : a05f53b7-…/w200.webp                          ← uuid がディレクトリ
#
# `s5cmd sync` はディレクトリ構造をそのまま写すので、素直に流すと
# `a0/a05f53b7-….w200.webp` という別のキーになってしまい、`webpKey()` が引けない。
# そこで find | sed で宛先キーを 1 件ずつ書いたコマンドリストに直し、
# `s5cmd run` に食わせている。
#
set -euo pipefail

cd "$(dirname "$0")/../.."

# .env を読み込む (export なしの変数も拾う)
set -a
source .env
set +a

: "${R2_ACCESS_KEY_ID:?Missing R2_ACCESS_KEY_ID (.env に R2 の API トークンを入れてください)}"
: "${R2_SECRET_ACCESS_KEY:?Missing R2_SECRET_ACCESS_KEY}"
R2_ACCOUNT_ID="${R2_ACCOUNT_ID:-2488ea57494b2dacae95a6e363e7dcb2}"

# s5cmd は AWS_* を見るが、このリポジトリのシェル env には ECR push 用の
# **本物の AWS キー** が同じ名前で入っている。そのまま渡すと R2 に AWS のキーを
# 送ってしまい "Credential access key has length 20, should be 32" で落ちる
# (CLAUDE.md の環境変数節を参照)。ここで R2 のものに差し替える。
export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
export AWS_REGION=auto
# ~/.aws は R2 専用のマウントだが両プロファイルとも失効済み。読ませると事故になるので切る。
export AWS_CONFIG_FILE=/dev/null
export AWS_SHARED_CREDENTIALS_FILE=/dev/null

# devcontainer feature が無いので ~/.local/bin に置いている
export PATH="$HOME/.local/bin:$PATH"

BUCKET="nagisa-images"
SRC=".cache/webp-native"
LIST=".cache/upload-commands.txt"
ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

if [ ! -d "$SRC" ]; then
  echo "エラー: $SRC がありません。先に scripts/analysis/convert-ladder-native.ts を流してください。" >&2
  exit 1
fi

command -v s5cmd >/dev/null || { echo "エラー: s5cmd が見つかりません (冒頭の導入手順を参照)。" >&2; exit 1; }

echo "コマンドリストを生成中..."
find "$SRC" -type f -name '*.webp' \
  | sed -E "s|^(.*/([0-9a-f-]{36})\.w([0-9]+)\.webp)\$|cp --content-type image/webp '\1' 's3://${BUCKET}/\2/w\3.webp'|" \
  > "$LIST"

echo "$(wc -l < "$LIST") 件 → $LIST"
echo "投入開始 (実測で約 35 分)..."

s5cmd --endpoint-url "$ENDPOINT" run "$LIST"

echo "完了。照合は bash scripts/r2/verify-ladder.sh"
