#!/bin/zsh

# Codex reads credentials from auth.json, not from OPENAI_API_KEY, so the
# variable alone leaves the TUI sitting on its sign-in screen. Log in once,
# with the key piped over stdin so it never shows up in ps.
[ -n "$OPENAI_API_KEY" ] && command -v codex >/dev/null 2>&1 \
  && { codex login status >/dev/null 2>&1 \
    || printenv OPENAI_API_KEY | codex login --with-api-key; } || true
