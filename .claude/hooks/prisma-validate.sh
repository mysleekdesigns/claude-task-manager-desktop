#!/bin/bash
# prisma-validate.sh - Validate Prisma schema after changes
# Used by PostToolUse hook for edits to prisma/schema.prisma

set -e

# Get the file path from TOOL_INPUT
FILE_PATH=$(echo "$TOOL_INPUT" | jq -r '.file_path // .path // empty' 2>/dev/null)

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Only run for Prisma schema
case "$FILE_PATH" in
  *prisma/schema.prisma)
    cd "$CLAUDE_PROJECT_DIR"
    echo "Validating Prisma schema..."
    npx prisma validate 2>&1

    if [ $? -ne 0 ]; then
      echo "Prisma schema validation failed."
      exit 1
    fi

    echo "Prisma schema is valid."
    ;;
esac

exit 0
