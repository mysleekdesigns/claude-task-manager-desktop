#!/bin/bash
# security-scan.sh - Quick security scan after dependency changes
# Used by PostToolUse hook for Write|Edit operations on package.json or package-lock.json
# Runs npm audit to check for known vulnerabilities

set -e

# Get the file path from TOOL_INPUT
FILE_PATH=$(echo "$TOOL_INPUT" | jq -r '.file_path // .path // empty' 2>/dev/null)

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Only run for package.json or package-lock.json
case "$FILE_PATH" in
  *package.json|*package-lock.json)
    cd "$CLAUDE_PROJECT_DIR"
    echo "Running security audit..."

    # Run npm audit with moderate level (skips low severity)
    # Use --json for machine-readable output, then summarize
    AUDIT_OUTPUT=$(npm audit --audit-level=moderate 2>&1) || true

    # Check if there are vulnerabilities
    if echo "$AUDIT_OUTPUT" | grep -q "found 0 vulnerabilities"; then
      echo "Security scan passed: No vulnerabilities found."
    elif echo "$AUDIT_OUTPUT" | grep -q "vulnerabilities"; then
      echo "Security scan results:"
      echo "$AUDIT_OUTPUT" | grep -A 20 "vulnerabilities" | head -25
      echo ""
      echo "Run 'npm audit' for full details or 'npm audit fix' to auto-fix."
    else
      # Handle case where audit fails for other reasons (e.g., no lock file)
      echo "Security scan completed."
      echo "$AUDIT_OUTPUT" | head -10
    fi
    ;;
esac

exit 0
