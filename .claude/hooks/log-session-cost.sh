#!/bin/bash
# Log Claude Code session data on session end
# This hook is triggered by the SessionEnd event

set -e

# Directory where this script lives
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_FILE="$PROJECT_DIR/session-costs.jsonl"

# Read hook input from stdin
HOOK_INPUT=$(cat)

# Extract fields from hook input
SESSION_ID=$(echo "$HOOK_INPUT" | jq -r '.session_id // "unknown"')
TRANSCRIPT_PATH=$(echo "$HOOK_INPUT" | jq -r '.transcript_path // ""')
EXIT_REASON=$(echo "$HOOK_INPUT" | jq -r '.reason // "unknown"')

# Get user info (prefer git config, fallback to whoami)
USER_NAME=$(git config user.name 2>/dev/null || whoami)

# Get current timestamp in ISO 8601 format
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Extract token usage and model from transcript if it exists
INPUT_TOKENS=0
OUTPUT_TOKENS=0
CACHE_CREATION_TOKENS=0
CACHE_READ_TOKENS=0
MODEL="unknown"

if [ -n "$TRANSCRIPT_PATH" ] && [ -f "$TRANSCRIPT_PATH" ]; then
  USAGE=$(cat "$TRANSCRIPT_PATH" | jq -s '
    [.[] | select(.message.usage) | .message.usage] |
    {
      input: (map(.input_tokens // 0) | add // 0),
      output: (map(.output_tokens // 0) | add // 0),
      cache_creation: (map(.cache_creation_input_tokens // 0) | add // 0),
      cache_read: (map(.cache_read_input_tokens // 0) | add // 0)
    }' 2>/dev/null || echo '{"input":0,"output":0,"cache_creation":0,"cache_read":0}')

  INPUT_TOKENS=$(echo "$USAGE" | jq -r '.input')
  OUTPUT_TOKENS=$(echo "$USAGE" | jq -r '.output')
  CACHE_CREATION_TOKENS=$(echo "$USAGE" | jq -r '.cache_creation')
  CACHE_READ_TOKENS=$(echo "$USAGE" | jq -r '.cache_read')

  # Extract model (first occurrence)
  MODEL=$(grep -o '"model":"[^"]*"' "$TRANSCRIPT_PATH" 2>/dev/null | head -1 | sed 's/"model":"//;s/"//' || echo "unknown")
fi

# Create log entry as compact JSON (single line for JSONL format)
LOG_ENTRY=$(jq -c -n \
  --arg timestamp "$TIMESTAMP" \
  --arg session_id "$SESSION_ID" \
  --arg user "$USER_NAME" \
  --arg model "$MODEL" \
  --arg exit_reason "$EXIT_REASON" \
  --arg transcript_path "$TRANSCRIPT_PATH" \
  --argjson input_tokens "$INPUT_TOKENS" \
  --argjson output_tokens "$OUTPUT_TOKENS" \
  --argjson cache_creation_tokens "$CACHE_CREATION_TOKENS" \
  --argjson cache_read_tokens "$CACHE_READ_TOKENS" \
  '{
    timestamp: $timestamp,
    session_id: $session_id,
    user: $user,
    model: $model,
    exit_reason: $exit_reason,
    input_tokens: $input_tokens,
    output_tokens: $output_tokens,
    cache_creation_tokens: $cache_creation_tokens,
    cache_read_tokens: $cache_read_tokens,
    transcript_path: $transcript_path
  }'
)

# Append to log file (create if doesn't exist)
echo "$LOG_ENTRY" >> "$LOG_FILE"

# Open a new terminal window to display session costs
osascript -e "tell application \"Terminal\"
  activate
  do script \"'$PROJECT_DIR/view-costs.sh' --sessions | tail -7; echo ''; '$PROJECT_DIR/view-costs.sh'; echo ''; echo 'Press any key to close...'; read -n 1\"
end tell" &>/dev/null &

exit 0
