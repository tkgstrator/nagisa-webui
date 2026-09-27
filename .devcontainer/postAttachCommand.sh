#!/bin/zsh

git config --global --unset commit.template
git config --global --add safe.directory /home/vscode/app
git config --global fetch.prune true
git config --global --add --bool push.autoSetupRemote true
git config --global commit.gpgSign false
while IFS='|' read -r branch worktree; do
  case "$branch" in
    develop|main|master) continue ;;
  esac
  if [[ -z "$worktree" ]]; then
    git branch -d -- "$branch"
  fi
done < <(git for-each-ref --merged HEAD --format='%(refname:short)|%(worktreepath)' refs/heads)
direnv allow
