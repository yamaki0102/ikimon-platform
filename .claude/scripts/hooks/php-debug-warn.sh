#!/bin/bash
# PostToolUse hook: Warn if debug statements left in PHP files
# Checks for var_dump, print_r, dd, die, dump, error_log in edited files

TOOL_INPUT="$CLAUDE_TOOL_INPUT"

# Extract file path from tool input
FILE=$(echo "$TOOL_INPUT" | grep -oP '"file_path"\s*:\s*"([^"]+)"' | head -1 | sed 's/.*"\([^"]*\)"/\1/')

if [ -z "$FILE" ]; then
  exit 0
fi

# Only check PHP files
if [[ ! "$FILE" =~ \.php$ ]]; then
  exit 0
fi

# Check for debug statements
ISSUES=$(grep -nP '\b(var_dump|print_r|dd\(|die\(|dump\()\b' "$FILE" 2>/dev/null)

if [ -n "$ISSUES" ]; then
  echo "⚠️ Debug statements detected in $FILE:"
  echo "$ISSUES"
  echo ""
  echo "Remove before committing."
  exit 0
fi
