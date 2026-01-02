#!/bin/bash
# View Claude Code session costs
# Usage: ./view-costs.sh [--json] [--sessions]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="$SCRIPT_DIR/session-costs.jsonl"

if [ ! -f "$LOG_FILE" ]; then
  echo "No session costs logged yet."
  exit 0
fi

# Opus 4.5 pricing per 1M tokens (as of Jan 2025)
INPUT_PRICE=5.00
OUTPUT_PRICE=25.00
CACHE_WRITE_PRICE=6.25
CACHE_READ_PRICE=0.50

case "${1:-}" in
  --json)
    cat "$LOG_FILE" | jq .
    ;;
  --nice)
    cat "$LOG_FILE" | jq -s '
      def fmt: (. / 1000 | round) as $k | $k | tostring | explode | reverse | [foreach .[] as $c (0; .+1; if . > 1 and (.-1) % 3 == 0 then [44, $c] else [$c] end)] | flatten | reverse | implode + "k";
      (map(.input_tokens // 0) | add) as $in |
      (map(.output_tokens // 0) | add) as $out |
      (map(.cache_creation_tokens // 0) | add) as $cw |
      (map(.cache_read_tokens // 0) | add) as $cr |
      (($in / 1000000 * '"$INPUT_PRICE"') + ($out / 1000000 * '"$OUTPUT_PRICE"') + ($cw / 1000000 * '"$CACHE_WRITE_PRICE"') + ($cr / 1000000 * '"$CACHE_READ_PRICE"') | . * 100 | round / 100) as $cost |
      "",
      "Claude Code Usage Summary",
      "==========================",
      "",
      "Sessions: \(length)",
      "",
      "Tokens:",
      "  Input:  \($in | fmt)",
      "  Output: \($out | fmt)",
      "  Cache:  \($cw | fmt) write, \($cr | fmt) read",
      "",
      "Estimated Cost: $\($cost)",
      ""
    ' -r
    ;;
  --sessions)
    echo "Claude Code Session Costs"
    echo "========================="
    echo ""
    cat "$LOG_FILE" | jq -r '
      def fmt: (. / 1000 | round) as $k | $k | tostring | explode | reverse | [foreach .[] as $c (0; .+1; if . > 1 and (.-1) % 3 == 0 then [44, $c] else [$c] end)] | flatten | reverse | implode;
      "Session: \(.session_id[0:8])... @ \(.timestamp)"
      + "\n  User: \(.user)"
      + "\n  Exit: \(.exit_reason)"
      + "\n  Tokens - Input: \((.input_tokens // 0) | fmt)k, Output: \((.output_tokens // 0) | fmt)k"
      + "\n  Cache  - Write: \((.cache_creation_tokens // 0) | fmt)k, Read: \((.cache_read_tokens // 0) | fmt)k"
      + "\n"'
    ;;
  *)
    cat "$LOG_FILE" | jq -s '
      def fmt: (. / 1000 | round) as $k | $k | tostring | explode | reverse | [foreach .[] as $c (0; .+1; if . > 1 and (.-1) % 3 == 0 then [44, $c] else [$c] end)] | flatten | reverse | implode + "k";
      (map(.input_tokens // 0) | add) as $in |
      (map(.output_tokens // 0) | add) as $out |
      (map(.cache_creation_tokens // 0) | add) as $cw |
      (map(.cache_read_tokens // 0) | add) as $cr |
      {
        total_sessions: length,
        total_input_tokens: ($in | fmt),
        total_output_tokens: ($out | fmt),
        total_cache_write_tokens: ($cw | fmt),
        total_cache_read_tokens: ($cr | fmt),
        estimated_cost_usd: (
          ($in / 1000000 * '"$INPUT_PRICE"') +
          ($out / 1000000 * '"$OUTPUT_PRICE"') +
          ($cw / 1000000 * '"$CACHE_WRITE_PRICE"') +
          ($cr / 1000000 * '"$CACHE_READ_PRICE"')
        ) | . * 100 | round / 100
      }'
    ;;
esac
