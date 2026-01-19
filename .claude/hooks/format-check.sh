#!/bin/bash
# format-check.sh - Run Prettier on modified files
# Used by PostToolUse hook for Write|Edit operations

set -e

# Get the file path from TOOL_INPUT
FILE_PATH=$(echo "$TOOL_INPUT" | jq -r '.file_path // .path // empty' 2>/dev/null)

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Only format supported files
case "$FILE_PATH" in
  *.ts|*.tsx|*.js|*.jsx|*.json|*.css|*.md)
    if [ -f "$FILE_PATH" ]; then
      cd "$CLAUDE_PROJECT_DIR"
      npx prettier --write "$FILE_PATH" 2>/dev/null || true
    fi
    ;;
esac

exit 0
