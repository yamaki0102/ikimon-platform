#!/bin/bash
# PostToolUse hook: Check for common PHP security issues in edited files

TOOL_INPUT="$CLAUDE_TOOL_INPUT"

FILE=$(echo "$TOOL_INPUT" | grep -oP '"file_path"\s*:\s*"([^"]+)"' | head -1 | sed 's/.*"\([^"]*\)"/\1/')

if [ -z "$FILE" ]; then
  exit 0
fi

if [[ ! "$FILE" =~ \.php$ ]]; then
  exit 0
fi

WARNINGS=""

# Check for raw SQL (potential injection)
if grep -nP '\$_(GET|POST|REQUEST|COOKIE)\[' "$FILE" 2>/dev/null | grep -iP '(mysql_query|mysqli_query|->query\()' | head -5; then
  WARNINGS="${WARNINGS}\n⚠️ Potential SQL injection: raw user input in query"
fi

# Check for unescaped output (XSS)
if grep -nP 'echo\s+\$_(GET|POST|REQUEST)' "$FILE" 2>/dev/null | head -5; then
  WARNINGS="${WARNINGS}\n⚠️ Potential XSS: unescaped user input in echo"
fi

# Check for eval/exec with variables
if grep -nP '\b(eval|exec|system|passthru|shell_exec|popen)\s*\(' "$FILE" 2>/dev/null | head -5; then
  WARNINGS="${WARNINGS}\n⚠️ Dangerous function detected (eval/exec/system)"
fi

if [ -n "$WARNINGS" ]; then
  echo "🔒 Security warnings in $FILE:"
  echo -e "$WARNINGS"
fi
