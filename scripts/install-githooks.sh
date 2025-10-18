#!/bin/sh
set -e
HOOKS_DIR=".githooks"
GIT_HOOKS_DIR=".git/hooks"
if [ ! -d "$GIT_HOOKS_DIR" ]; then
  echo "No .git/hooks directory found; are you inside a git repo?"
  exit 1
fi
for f in "$HOOKS_DIR"/*; do
  name=$(basename "$f")
  dest="$GIT_HOOKS_DIR/$name"
  cp "$f" "$dest"
  chmod +x "$dest"
  echo "Installed $dest"
done
echo "Hooks installed"
