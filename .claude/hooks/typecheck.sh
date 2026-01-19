#!/bin/bash
# typecheck.sh - Run TypeScript type checking
# Used by Stop hook to verify no type errors before completion

set -e

cd "$CLAUDE_PROJECT_DIR"

# Run TypeScript compiler in noEmit mode
npx tsc --noEmit 2>&1 | head -20

# Capture exit code
EXIT_CODE=${PIPESTATUS[0]}

if [ $EXIT_CODE -ne 0 ]; then
  echo "TypeScript errors found. Please fix before completing."
  exit 1
fi

echo "Type checking passed."
exit 0
