/**
 * Single source of truth for Agents workspace model tiers.
 *
 * Structurally identical to lib/planning/models.ts (kept separate so an
 * unrelated feature doesn't import from the `lib/planning/` namespace) — the
 * two tier -> gateway-model-id maps can drift if one is updated without the
 * other on a future model bump; keep them in sync by hand.
 */

export const AGENT_MODEL_TIERS = ['sonnet', 'opus', 'haiku'] as const

export type AgentModelTier = (typeof AGENT_MODEL_TIERS)[number]

export const DEFAULT_AGENT_TIER: AgentModelTier = 'sonnet'

const TIER_LABELS: Record<AgentModelTier, string> = {
  sonnet: 'Sonnet (latest)',
  opus: 'Opus (latest)',
  haiku: 'Haiku (latest)',
}

/** Latest known gateway model id for each tier (without the provider prefix). */
const TIER_LATEST_MODEL_ID: Record<AgentModelTier, string> = {
  sonnet: 'claude-sonnet-4-6',
  opus: 'claude-opus-4-6',
  haiku: 'claude-haiku-4-5',
}

/** Human-readable label for a tier, e.g. "Sonnet (latest)". */
export function getModelLabel(tier: AgentModelTier): string {
  return TIER_LABELS[tier] ?? TIER_LABELS[DEFAULT_AGENT_TIER]
}

/** Type guard: is the given string a valid agent tier? */
export function isAgentModelTier(value: unknown): value is AgentModelTier {
  return (
    typeof value === 'string' &&
    AGENT_MODEL_TIERS.includes(value as AgentModelTier)
  )
}

/** Coerce an arbitrary value to a valid tier, falling back to the default. */
export function toAgentModelTier(value: unknown): AgentModelTier {
  return isAgentModelTier(value) ? value : DEFAULT_AGENT_TIER
}

/**
 * Resolve a tier to the gateway model id (with provider prefix) for the
 * AI SDK gateway, e.g. 'anthropic/claude-sonnet-4-6'.
 */
export function resolveGatewayModel(tier: AgentModelTier): string {
  const id = TIER_LATEST_MODEL_ID[tier] ?? TIER_LATEST_MODEL_ID[DEFAULT_AGENT_TIER]
  return `anthropic/${id}`
}

/** Whether a tier's model supports Anthropic extended thinking. */
export function tierSupportsThinking(tier: AgentModelTier): boolean {
  return tier !== 'haiku'
}
