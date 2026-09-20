#!/bin/sh

# devflow の VS Code 拡張 (コマンドパレットの `Agents: Start`) を入れ直す。
#
# 拡張の実体は ~/.vscode-server/extensions/ に置かれる。ここは compose のボリューム
# でもバインドでもない素のコンテナ FS なので、リビルドのたびに消える。plugin 側の
# install.ts は導入済みならそのまま抜ける冪等なスクリプトなので、毎回無条件に叩く。
#
# 注意: PATH 上の `code` は remote-cli のラッパーで、VSCODE_IPC_HOOK_CLI が刺さった
# VS Code の統合ターミナルでしか動かない (ライフサイクルコマンドからは
# "Command is only available in ... Visual Studio Code terminal" で落ちる)。
# 拡張の導入・列挙は同梱の code-server が同じ引数で受け付けるので、これを `code` と
# いう名前で PATH の先頭に差し込んで install.ts に使わせる。

installer="$(ls -d "${CLAUDE_CONFIG_DIR:-$HOME/.claude}"/plugins/cache/qtmleap-plugins/devflow/*/scripts/agents/vscode/install.ts 2>/dev/null | sort -V | tail -1)"
if [ -z "$installer" ]; then
  echo "installAgents: devflow plugin not found; skipped" >&2
  exit 0
fi

# サーバは /vscode (リビルドを跨ぐ docker ボリューム) か ~/.vscode-server のどちらかに
# 展開される。アーキテクチャ名の階層が入る配置とそうでない配置の両方を見る。
code_server="$(ls -t \
  /vscode/vscode-server/bin/*/*/bin/code-server \
  /vscode/vscode-server/bin/*/bin/code-server \
  "$HOME"/.vscode-server/bin/*/bin/code-server \
  2>/dev/null | head -1)"
if [ -z "$code_server" ]; then
  echo "installAgents: code-server not found; skipped" >&2
  exit 0
fi

shim="$(mktemp -d)"
trap 'rm -rf "$shim"' EXIT
printf '#!/bin/sh\nexec "%s" "$@"\n' "$code_server" >"$shim/code"
chmod +x "$shim/code"

PATH="$shim:$PATH" bun "$installer" \
  || echo "installAgents: failed; run the /devflow:agents-setup skill manually" >&2