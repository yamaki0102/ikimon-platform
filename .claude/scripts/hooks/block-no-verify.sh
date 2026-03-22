#!/bin/bash
# PreToolUse hook: Block --no-verify flag on git commands
# Prevents skipping git hooks

TOOL_INPUT="$CLAUDE_TOOL_INPUT"

if echo "$TOOL_INPUT" | grep -q '\-\-no-verify'; then
  echo "❌ --no-verify is not allowed. Fix the underlying issue instead of skipping hooks."
  exit 2
fi
