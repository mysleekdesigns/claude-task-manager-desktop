#!/bin/bash
# typecheck-on-edit.sh - Runs TypeScript type checking after TS file edits
# Lighter weight than full build, runs only on changed files when possible
# Used by PostToolUse hook for Write|Edit operations on TypeScript files

set -e

# Get the file path from TOOL_INPUT
FILE_PATH=$(echo "$TOOL_INPUT" | jq -r '.file_path // .path // empty' 2>/dev/null)

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Only run for TypeScript files
case "$FILE_PATH" in
  *.ts|*.tsx)
    if [ -f "$FILE_PATH" ]; then
      cd "$CLAUDE_PROJECT_DIR"

      # Determine which tsconfig to use based on file location
      case "$FILE_PATH" in
        */electron/*)
          echo "Type checking electron files..."
          # Run electron-specific typecheck
          npx tsc -p tsconfig.electron.json --noEmit 2>&1 | head -30 || {
            echo "TypeScript errors found in electron code."
            # Don't exit with error to avoid blocking the edit
          }
          ;;
        */src/*)
          echo "Type checking renderer files..."
          # Run renderer typecheck
          npx tsc --noEmit 2>&1 | head -30 || {
            echo "TypeScript errors found in renderer code."
            # Don't exit with error to avoid blocking the edit
          }
          ;;
        *)
          echo "Type checking..."
          # Run full typecheck for files in other locations
          npx tsc --noEmit 2>&1 | head -30 || {
            echo "TypeScript errors found."
            # Don't exit with error to avoid blocking the edit
          }
          ;;
      esac
    fi
    ;;
esac

exit 0
