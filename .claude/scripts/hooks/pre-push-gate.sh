#!/bin/bash
# PreToolUse hook: AI Code Review Gate (Sashiko pattern)
# Blocks git push unless:
#   1. Static analysis passes (no critical issues in diff)
#   2. AI code review marker exists and is current
#
# Exit codes:
#   0 = allow
#   2 = block (STDERR shown to Claude as reason)

TOOL_INPUT="$CLAUDE_TOOL_INPUT"

# Only intercept git push
if ! echo "$TOOL_INPUT" | grep -qE 'git[[:space:]]+push'; then
  exit 0
fi

# Emergency bypass: HOTFIX_PUSH=1
if [ "$HOTFIX_PUSH" = "1" ]; then
  echo "HOTFIX bypass active. Skipping review gate." >&2
  exit 0
fi

# --- Layer 1: Static diff analysis ---
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
REMOTE_BRANCH="origin/${BRANCH}"

if git rev-parse --verify "$REMOTE_BRANCH" >/dev/null 2>&1; then
  CHANGED_FILES=$(git diff --name-only "$REMOTE_BRANCH"..HEAD -- '*.php' 2>/dev/null)
else
  CHANGED_FILES=$(git diff --name-only HEAD~1..HEAD -- '*.php' 2>/dev/null)
fi

CRITICAL_ISSUES=""

for FILE in $CHANGED_FILES; do
  [ -f "$FILE" ] || continue

  # PHP syntax check
  LINT=$(php -l "$FILE" 2>&1)
  if [ $? -ne 0 ]; then
    CRITICAL_ISSUES="${CRITICAL_ISSUES}\n  Syntax error: ${FILE}\n  ${LINT}"
  fi

  # Dangerous functions
  DANGEROUS=$(grep -nE '(eval|exec|system|passthru|shell_exec|popen)[[:space:]]*\(' "$FILE" 2>/dev/null)
  if [ -n "$DANGEROUS" ]; then
    CRITICAL_ISSUES="${CRITICAL_ISSUES}\n  Dangerous function in ${FILE}:\n  ${DANGEROUS}"
  fi

  # Debug statements
  DEBUG=$(grep -nE '(var_dump|print_r|dd\(|dump\()' "$FILE" 2>/dev/null)
  if [ -n "$DEBUG" ]; then
    CRITICAL_ISSUES="${CRITICAL_ISSUES}\n  Debug statement in ${FILE}:\n  ${DEBUG}"
  fi

  # ikimon: DataStore misuse
  MISUSE=$(grep -nE 'DataStore::(getAll|findAll|update)\(' "$FILE" 2>/dev/null)
  if [ -n "$MISUSE" ]; then
    CRITICAL_ISSUES="${CRITICAL_ISSUES}\n  Invalid DataStore API in ${FILE}:\n  ${MISUSE}"
  fi

  # ikimon: SiteManager instantiation
  MISUSE2=$(grep -nE 'new[[:space:]]+SiteManager[[:space:]]*\(' "$FILE" 2>/dev/null)
  if [ -n "$MISUSE2" ]; then
    CRITICAL_ISSUES="${CRITICAL_ISSUES}\n  SiteManager must be static in ${FILE}:\n  ${MISUSE2}"
  fi

  # Unescaped echo of user input
  UNESC=$(grep -nE 'echo[[:space:]]+\$_(GET|POST|REQUEST|COOKIE)' "$FILE" 2>/dev/null)
  if [ -n "$UNESC" ]; then
    CRITICAL_ISSUES="${CRITICAL_ISSUES}\n  Unescaped user input in ${FILE}:\n  ${UNESC}"
  fi
done

if [ -n "$CRITICAL_ISSUES" ]; then
  echo "Push blocked — static analysis found critical issues:" >&2
  echo -e "$CRITICAL_ISSUES" >&2
  echo "" >&2
  echo "Fix these issues before pushing." >&2
  exit 2
fi

# --- Layer 2: Review marker check ---
MARKER_FILE=".claude/review-gate/last-review.json"

if [ ! -f "$MARKER_FILE" ]; then
  echo "Push blocked — no AI code review on record." >&2
  echo "Run /code-review first, then push." >&2
  exit 2
fi

MARKER_COMMIT=$(grep -oE '"commit"[[:space:]]*:[[:space:]]*"[^"]+"' "$MARKER_FILE" | sed 's/.*"\([^"]*\)"$/\1/')
MARKER_RESULT=$(grep -oE '"result"[[:space:]]*:[[:space:]]*"[^"]+"' "$MARKER_FILE" | sed 's/.*"\([^"]*\)"$/\1/')
MARKER_TIMESTAMP=$(grep -oE '"timestamp"[[:space:]]*:[[:space:]]*[0-9]+' "$MARKER_FILE" | grep -oE '[0-9]+$')

CURRENT_HEAD=$(git rev-parse HEAD 2>/dev/null)
CURRENT_TIME=$(date +%s)

# Review must have passed
if [ "$MARKER_RESULT" != "pass" ]; then
  echo "Push blocked — last code review did not pass (result: ${MARKER_RESULT})." >&2
  echo "Run /code-review again and resolve all issues." >&2
  exit 2
fi

# Review must be for current HEAD
if [ "$MARKER_COMMIT" != "$CURRENT_HEAD" ]; then
  echo "Push blocked — review was for a different commit." >&2
  echo "New commits detected since last review. Run /code-review again." >&2
  exit 2
fi

# Review must be recent (< 1800 seconds = 30 minutes)
if [ -n "$MARKER_TIMESTAMP" ]; then
  AGE=$(( CURRENT_TIME - MARKER_TIMESTAMP ))
  if [ "$AGE" -gt 1800 ]; then
    echo "Push blocked — review is $(( AGE / 60 )) minutes old (max: 30 min)." >&2
    echo "Run /code-review again to refresh." >&2
    exit 2
  fi
fi

echo "Review gate passed: static analysis clean, AI review verified." >&2
exit 0
