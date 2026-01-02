#!/bin/bash
# View Claude Code session costs
# Usage: ./view-costs.sh [--json] [--nice] [--sessions] [--pricing]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="$SCRIPT_DIR/session-costs.jsonl"

if [ ! -f "$LOG_FILE" ]; then
  echo "No session costs logged yet."
  exit 0
fi

# Pricing metadata
PRICING_SOURCE="https://claude.com/pricing"
PRICING_RETRIEVED="2025-01-01"

# Pricing per 1M tokens
# Unknown sessions use Sonnet pricing (recommended model)
PRICING_JSON=$(cat <<'EOF'
{
  "claude-opus-4-5-20251101": {"input": 5.00, "output": 25.00, "cache_write": 6.25, "cache_read": 0.50},
  "claude-sonnet-4-5-20251101": {"input": 3.00, "output": 15.00, "cache_write": 3.75, "cache_read": 0.30},
  "claude-sonnet-4-20250514": {"input": 3.00, "output": 15.00, "cache_write": 3.75, "cache_read": 0.30},
  "claude-haiku-4-5-20251101": {"input": 1.00, "output": 5.00, "cache_write": 1.25, "cache_read": 0.10},
  "unknown": {"input": 3.00, "output": 15.00, "cache_write": 3.75, "cache_read": 0.30}
}
EOF
)

case "${1:-}" in
  --pricing)
    cat <<EOF

Claude API Pricing (per 1M tokens)
==================================

Source: $PRICING_SOURCE
Retrieved: $PRICING_RETRIEVED

Model                         Input    Output   Cache Write  Cache Read
---------------------------------------------------------------------------
claude-opus-4-5-20251101      \$5.00    \$25.00      \$6.25       \$0.50
claude-sonnet-4-5-20251101    \$3.00    \$15.00      \$3.75       \$0.30
claude-sonnet-4-20250514      \$3.00    \$15.00      \$3.75       \$0.30
claude-haiku-4-5-20251101     \$1.00     \$5.00      \$1.25       \$0.10
---------------------------------------------------------------------------
unknown (default)             \$3.00    \$15.00      \$3.75       \$0.30
                              (uses Sonnet pricing for sessions without model data)

EOF
    ;;
  --json)
    cat "$LOG_FILE" | jq .
    ;;
  --nice)
    cat "$LOG_FILE" | jq -rs --argjson pricing "$PRICING_JSON" '
      def fmt: (. / 1000 | round) as $k | $k | tostring | explode | reverse | [foreach .[] as $c (0; .+1; if . > 1 and (.-1) % 3 == 0 then [44, $c] else [$c] end)] | flatten | reverse | implode + "k";
      def cost(model; inp; out; cw; cr):
        ($pricing[model] // $pricing["unknown"]) as $p |
        ((inp / 1000000 * $p.input) + (out / 1000000 * $p.output) + (cw / 1000000 * $p.cache_write) + (cr / 1000000 * $p.cache_read)) | . * 100 | round / 100;

      # Group by model
      group_by(.model // "unknown") | map({
        model: (.[0].model // "unknown"),
        sessions: length,
        input: (map(.input_tokens // 0) | add),
        output: (map(.output_tokens // 0) | add),
        cache_write: (map(.cache_creation_tokens // 0) | add),
        cache_read: (map(.cache_read_tokens // 0) | add)
      }) | map(. + {cost: cost(.model; .input; .output; .cache_write; .cache_read)}) |

      # Calculate totals
      (map(.sessions) | add) as $total_sessions |
      (map(.cost) | add | . * 100 | round / 100) as $total_cost |

      [
        "",
        "Claude Code Usage Summary",
        "==========================",
        "",
        "Total Sessions: \($total_sessions)",
        "Total Est Cost: $\($total_cost)",
        "",
        "By Model:",
        "--------",
        (.[] | (
          "",
          (if .model == "unknown" then "  \(.model) (using Sonnet pricing)" else "  \(.model)" end),
          "    Sessions:  \(.sessions)",
          "    Tokens:    \(.input | fmt) in, \(.output | fmt) out",
          "    Cache:     \(.cache_write | fmt) write, \(.cache_read | fmt) read",
          "    Est Cost:  $\(.cost)"
        )),
        ""
      ] | .[]
    '
    ;;
  --sessions)
    echo "Claude Code Session Costs"
    echo "========================="
    echo ""
    cat "$LOG_FILE" | jq -r '
      def fmt: (. / 1000 | round) as $k | $k | tostring | explode | reverse | [foreach .[] as $c (0; .+1; if . > 1 and (.-1) % 3 == 0 then [44, $c] else [$c] end)] | flatten | reverse | implode;
      "Session: \(.session_id[0:8])... @ \(.timestamp)"
      + "\n  User:   \(.user)"
      + "\n  Model:  \(.model // "unknown")"
      + "\n  Exit:   \(.exit_reason)"
      + "\n  Tokens: \((.input_tokens // 0) | fmt)k in, \((.output_tokens // 0) | fmt)k out"
      + "\n  Cache:  \((.cache_creation_tokens // 0) | fmt)k write, \((.cache_read_tokens // 0) | fmt)k read"
      + "\n"'
    ;;
  *)
    cat "$LOG_FILE" | jq -s --argjson pricing "$PRICING_JSON" '
      def fmt: (. / 1000 | round) as $k | $k | tostring | explode | reverse | [foreach .[] as $c (0; .+1; if . > 1 and (.-1) % 3 == 0 then [44, $c] else [$c] end)] | flatten | reverse | implode + "k";
      def cost(model; inp; out; cw; cr):
        ($pricing[model] // $pricing["unknown"]) as $p |
        ((inp / 1000000 * $p.input) + (out / 1000000 * $p.output) + (cw / 1000000 * $p.cache_write) + (cr / 1000000 * $p.cache_read)) | . * 100 | round / 100;

      # Group by model
      group_by(.model // "unknown") | map({
        model: (.[0].model // "unknown"),
        sessions: length,
        input_tokens: (map(.input_tokens // 0) | add),
        output_tokens: (map(.output_tokens // 0) | add),
        cache_write_tokens: (map(.cache_creation_tokens // 0) | add),
        cache_read_tokens: (map(.cache_read_tokens // 0) | add)
      }) | map(. + {estimated_cost_usd: cost(.model; .input_tokens; .output_tokens; .cache_write_tokens; .cache_read_tokens)}) |

      # Build result with totals and by-model breakdown
      {
        total_sessions: (map(.sessions) | add),
        total_est_cost_usd: (map(.estimated_cost_usd) | add | . * 100 | round / 100),
        by_model: (map({
          (.model): ({
            sessions: .sessions,
            input_tokens: (.input_tokens | fmt),
            output_tokens: (.output_tokens | fmt),
            cache_write_tokens: (.cache_write_tokens | fmt),
            cache_read_tokens: (.cache_read_tokens | fmt),
            est_cost_usd: .estimated_cost_usd
          } + (if .model == "unknown" then {note: "using Sonnet pricing"} else {} end))
        }) | add)
      }'
    ;;
esac
