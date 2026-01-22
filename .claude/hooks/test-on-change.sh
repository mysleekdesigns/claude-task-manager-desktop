#!/bin/bash
# test-on-change.sh - Runs relevant tests after code changes
# Used by PostToolUse hook for Write|Edit operations on TS/TSX files
# Runs in background, does not block edits

set -e

# Get the file path from TOOL_INPUT
FILE_PATH=$(echo "$TOOL_INPUT" | jq -r '.file_path // .path // empty' 2>/dev/null)

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Determine if this is a renderer or main process file
run_tests() {
  local file="$1"
  local test_pattern=""
  local test_cmd=""

  case "$file" in
    */src/*.ts|*/src/*.tsx)
      # Renderer process file - check for corresponding test file
      local base_name=$(basename "$file" | sed 's/\.tsx\?$//')
      local dir_name=$(dirname "$file")

      # Look for test files in same directory or __tests__ subdirectory
      if [ -f "${dir_name}/${base_name}.test.ts" ] || \
         [ -f "${dir_name}/${base_name}.test.tsx" ] || \
         [ -f "${dir_name}/__tests__/${base_name}.test.ts" ] || \
         [ -f "${dir_name}/__tests__/${base_name}.test.tsx" ]; then
        test_pattern="$base_name"
        test_cmd="npm run test:renderer -- --run --testNamePattern=\"$test_pattern\""
      else
        # No specific test file, skip
        exit 0
      fi
      ;;
    */electron/*.ts)
      # Main process file - check for corresponding test file
      local base_name=$(basename "$file" .ts)
      local dir_name=$(dirname "$file")

      # Look for test files in same directory or __tests__ subdirectory
      if [ -f "${dir_name}/${base_name}.test.ts" ] || \
         [ -f "${dir_name}/__tests__/${base_name}.test.ts" ]; then
        test_pattern="$base_name"
        test_cmd="npm run test:main -- --run --testNamePattern=\"$test_pattern\""
      else
        # No specific test file, skip
        exit 0
      fi
      ;;
    *)
      # Not a TypeScript source file, skip
      exit 0
      ;;
  esac

  if [ -n "$test_cmd" ]; then
    cd "$CLAUDE_PROJECT_DIR"
    echo "Running tests for: $base_name"
    # Run tests in background, output results
    eval "$test_cmd" 2>&1 || {
      echo "Tests failed for $base_name"
      # Don't exit with error - we don't want to block the edit
    }
  fi
}

# Only process TypeScript/TSX files
case "$FILE_PATH" in
  *.ts|*.tsx)
    if [ -f "$FILE_PATH" ]; then
      run_tests "$FILE_PATH"
    fi
    ;;
esac

exit 0
