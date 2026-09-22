#!/bin/zsh
set -e

# Named volumes are created root-owned because their mount points do not exist
# in the image.
sudo chown -R $(whoami):$(whoami) .venv 2>/dev/null || true
sudo chown -R $(whoami):$(whoami) ~/.cache/uv 2>/dev/null || true

# The devcontainers-extra direnv feature only installs the binary, unlike the
# devcontainers-community one which also writes the shell hook.
if [ -f /etc/zsh/zshrc ] && ! grep -q 'direnv hook zsh' /etc/zsh/zshrc; then
  echo 'eval "$(direnv hook zsh)"' | sudo tee -a /etc/zsh/zshrc > /dev/null
fi
if [ -f /etc/bash.bashrc ] && ! grep -q 'direnv hook bash' /etc/bash.bashrc; then
  echo 'eval "$(direnv hook bash)"' | sudo tee -a /etc/bash.bashrc > /dev/null
fi

# Silence direnv output.
# In direnv 2.36+, DIRENV_LOG_FORMAT env var is ignored unless direnv.toml exists.
# See: https://github.com/direnv/direnv/issues/1418
mkdir -p ~/.config/direnv
cat > ~/.config/direnv/direnv.toml <<'EOF'
[global]
log_format = ""
hide_env_diff = true
EOF

# Codex CLI の繋ぎ先。既定は api.openai.com なので、互換サーバを使うなら provider を
# 書いておかないと 401 で落ちる。~/.claude と違って ~/.codex はホストから
# マウントしていない (コンテナの中だけの置き場) ので、作り直すたびにここで書き直す。
# 鍵そのものは remoteEnv 経由でホストから来る OPENAI_API_KEY を参照するだけで、
# ファイルには書かない。
if [ -n "${OPENAI_BASE_URL:-}" ]; then
  mkdir -p ~/.codex
  cat > ~/.codex/config.toml <<EOF
# postCreateCommand.sh が書き出す。手で直しても作り直しで消える。
model_provider = "gateway"

[model_providers.gateway]
name = "gateway"
base_url = "${OPENAI_BASE_URL%/}"
env_key = "OPENAI_API_KEY"
wire_api = "responses"

[projects."/home/vscode/app"]
trust_level = "trusted"
EOF
  chmod 600 ~/.codex/config.toml
fi

# Install the single root web app (TanStack Start + Hono + Cloudflare Workers).
if [ -f package.json ]; then
  if [ -f bun.lock ]; then
    bun install --frozen-lockfile
  else
    bun install
  fi
fi
