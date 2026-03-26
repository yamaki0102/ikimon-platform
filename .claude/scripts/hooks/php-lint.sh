#!/bin/bash
# PostToolUse hook: Auto-lint PHP files after edit
# Runs php -l syntax check on modified PHP files

TOOL_INPUT="$CLAUDE_TOOL_INPUT"

FILE=$(echo "$TOOL_INPUT" | grep -oP '"file_path"\s*:\s*"([^"]+)"' | head -1 | sed 's/.*"\([^"]*\)"/\1/')

if [ -z "$FILE" ]; then
  exit 0
fi

if [[ ! "$FILE" =~ \.php$ ]]; then
  exit 0
fi

# Syntax check
RESULT=$(php -l "$FILE" 2>&1)
if [ $? -ne 0 ]; then
  echo "❌ PHP Syntax Error in $FILE:"
  echo "$RESULT"
  exit 1
fi
