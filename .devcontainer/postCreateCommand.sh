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


# Install the single root web app (TanStack Start + Hono + Cloudflare Workers).
if [ -f package.json ]; then
  if [ -f bun.lock ]; then
    bun install --frozen-lockfile
  else
    bun install
  fi
fi
