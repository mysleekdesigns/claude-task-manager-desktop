#!/bin/bash
# lint-check.sh - Run ESLint on modified files
# Used by PostToolUse hook for Write|Edit operations

set -e

# Get the file path from TOOL_INPUT
FILE_PATH=$(echo "$TOOL_INPUT" | jq -r '.file_path // .path // empty' 2>/dev/null)

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Only lint TypeScript/JavaScript files
case "$FILE_PATH" in
  *.ts|*.tsx|*.js|*.jsx)
    # Check if file exists
    if [ -f "$FILE_PATH" ]; then
      # Run ESLint on the specific file
      cd "$CLAUDE_PROJECT_DIR"
      npx eslint "$FILE_PATH" --fix --quiet 2>/dev/null || true
    fi
    ;;
esac

exit 0
