/**
 * Lead Intelligence Types
 *
 * Types for AI-powered lead scoring, priority tiers, and signals.
 */

export type PriorityTier = 'hot' | 'warm' | 'cold'

export const PRIORITY_TIERS = ['hot', 'warm', 'cold'] as const

/**
 * A signal detected during lead scoring that contributes to the overall score.
 */
export interface LeadSignal {
  /** Signal type identifier (e.g., 'fast_response', 'budget_mentioned') */
  type: string
  /** When the signal was detected */
  timestamp: string
  /** Weight contribution to overall score (0-1) */
  weight: number
  /** Optional additional details about the signal */
  details?: Record<string, unknown>
}

/**
 * Signal type identifiers used by the scoring system.
 */
export const SignalTypes = {
  FAST_RESPONSE: 'fast_response',
  MULTIPLE_STAKEHOLDERS: 'multiple_stakeholders',
  BUDGET_MENTIONED: 'budget_mentioned',
  URGENCY_DETECTED: 'urgency_detected',
  COMPETITOR_MENTIONED: 'competitor_mentioned',
  DECISION_MAKER: 'decision_maker',
  GOING_COLD: 'going_cold',
  TECHNICAL_FIT: 'technical_fit',
  CLEAR_REQUIREMENTS: 'clear_requirements',
  FOLLOW_UP_REQUESTED: 'follow_up_requested',
} as const

export type SignalType = (typeof SignalTypes)[keyof typeof SignalTypes]

/**
 * Intelligence data attached to a lead record.
 */
export interface LeadIntelligence {
  overallScore: number | null
  priorityTier: PriorityTier | null
  signals: LeadSignal[]
  lastScoredAt: string | null
  lastContactAt: string | null
  awaitingReply: boolean
  predictedCloseProbability: number | null
  estimatedValue: number | null
  expectedCloseDate: string | null
}

/**
 * Conversion tracking data for a lead.
 */
export interface LeadConversionInfo {
  convertedAt: string | null
  convertedToClientId: string | null
}

/**
 * Score thresholds for priority tier assignment.
 */
export const PRIORITY_THRESHOLDS = {
  hot: 70, // Score >= 70 is "hot"
  warm: 40, // Score >= 40 is "warm"
  // Score < 40 is "cold"
} as const

/**
 * Determine priority tier from overall score.
 */
export function getPriorityTierFromScore(score: number | null): PriorityTier | null {
  if (score === null) return null
  if (score >= PRIORITY_THRESHOLDS.hot) return 'hot'
  if (score >= PRIORITY_THRESHOLDS.warm) return 'warm'
  return 'cold'
}

/**
 * Signal labels for display.
 */
export const SIGNAL_LABELS: Record<SignalType, string> = {
  [SignalTypes.FAST_RESPONSE]: 'Fast Response',
  [SignalTypes.MULTIPLE_STAKEHOLDERS]: 'Multiple Stakeholders',
  [SignalTypes.BUDGET_MENTIONED]: 'Budget Discussed',
  [SignalTypes.URGENCY_DETECTED]: 'Timeline Urgency',
  [SignalTypes.COMPETITOR_MENTIONED]: 'Evaluating Alternatives',
  [SignalTypes.DECISION_MAKER]: 'Decision Maker Involved',
  [SignalTypes.GOING_COLD]: 'Going Cold',
  [SignalTypes.TECHNICAL_FIT]: 'Technical Fit',
  [SignalTypes.CLEAR_REQUIREMENTS]: 'Clear Requirements',
  [SignalTypes.FOLLOW_UP_REQUESTED]: 'Follow-up Requested',
}
