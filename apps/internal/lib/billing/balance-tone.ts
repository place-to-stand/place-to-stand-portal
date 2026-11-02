/**
 * The colour of an hours balance (a client's remaining prepaid hours): muted
 * green while there are hours left, muted red once overdrawn, neutral at
 * zero. One pair of classes so every "remaining" figure reads the same.
 */
export type BalanceTone = 'positive' | 'negative' | 'default'

export function balanceTone(hours: number): BalanceTone {
  if (hours > 0) return 'positive'
  if (hours < 0) return 'negative'
  return 'default'
}

export const BALANCE_TONE_CLASS: Record<BalanceTone, string> = {
  positive: 'text-success/85',
  negative: 'text-destructive/85',
  default: '',
}
