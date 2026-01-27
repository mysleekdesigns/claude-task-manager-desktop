#!/bin/bash

# Supabase validation hook
# Runs after Write/Edit on Supabase-related files

# Read the tool input from stdin
INPUT=$(cat)

# Extract the file path from the JSON input
FILE_PATH=$(echo "$INPUT" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/"file_path"[[:space:]]*:[[:space:]]*"//' | sed 's/"$//')

# Only check relevant files
case "$FILE_PATH" in
  *supabase*|*sync*|*.env*)
    ;;
  *)
    exit 0 # Not a Supabase-related file
    ;;
esac

# Check for exposed secrets
if [[ -f "$FILE_PATH" ]]; then
  # Check for hardcoded Supabase keys
  if grep -qE "supabase.*key.*['\"][a-zA-Z0-9]{30,}['\"]" "$FILE_PATH" 2>/dev/null; then
    echo "WARNING: Possible hardcoded Supabase key detected in $FILE_PATH" >&2
    echo "Use environment variables instead: process.env.SUPABASE_ANON_KEY" >&2
  fi

  # Check for service_role key exposure
  if grep -qi "service_role" "$FILE_PATH" 2>/dev/null; then
    if grep -qi "renderer\|src/" <<< "$FILE_PATH"; then
      echo "ERROR: service_role key must NEVER be used in renderer process!" >&2
      exit 2
    fi
  fi

  # Check for missing RLS reminder
  if grep -qE "\.from\(['\"][a-z_]+['\"]\)" "$FILE_PATH" 2>/dev/null; then
    if ! grep -qi "rls\|policy" "$FILE_PATH" 2>/dev/null; then
      echo "REMINDER: Ensure RLS policies are enabled for any tables accessed" >&2
    fi
  fi
fi

exit 0
