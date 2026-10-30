/**
 * Closer splits (client-safe — shared by the client sheet, the save action
 * and the term queries).
 *
 * A commission term pays its closer rate to zero or more closers. Each closer
 * is an admin user or a contact (an insider at the client can help close the
 * deal) and takes `sharePercent` of the closer rate. With any closers the
 * shares must total exactly 100; with none, the closer share stays in House.
 */

export type CloserKind = 'user' | 'contact'

export type CloserShare = {
  kind: CloserKind
  id: string
  /** Share of the closer rate, 0 < share <= 100, two decimals. */
  sharePercent: number
}

/** A closer share resolved for display. */
export type ClientCloser = CloserShare & {
  name: string
  email: string | null
  /** Users only. */
  avatarUrl: string | null
  avatarUpdatedAt: string | null
}

export function closerKey(closer: { kind: CloserKind; id: string }): string {
  return `${closer.kind}:${closer.id}`
}

const round2 = (value: number): number => Math.round(value * 100) / 100

export function closerSharesTotal(closers: readonly CloserShare[]): number {
  return round2(closers.reduce((sum, c) => sum + c.sharePercent, 0))
}

/** Why a split can't be saved, or null when it can. */
export function closerSplitError(closers: readonly CloserShare[]): string | null {
  if (closers.length === 0) return null

  const keys = new Set(closers.map(closerKey))
  if (keys.size !== closers.length) {
    return 'Each closer can only appear once.'
  }

  for (const closer of closers) {
    if (
      !Number.isFinite(closer.sharePercent) ||
      closer.sharePercent <= 0 ||
      closer.sharePercent > 100
    ) {
      return 'Each closer needs a share between 0 and 100%.'
    }
    if (round2(closer.sharePercent) !== closer.sharePercent) {
      return 'Shares can have at most two decimal places.'
    }
  }

  const total = closerSharesTotal(closers)
  if (total !== 100) {
    return `Closer shares must add up to 100% (currently ${total}%).`
  }

  return null
}

/**
 * An even split of 100 across `count` closers, in cents of a percent. The
 * remainder goes to the first closers so the total is exactly 100
 * (3 → 33.34, 33.33, 33.33).
 */
export function evenCloserShares(count: number): number[] {
  if (count <= 0) return []
  const base = Math.floor(10000 / count)
  const remainder = 10000 - base * count
  return Array.from(
    { length: count },
    (_, index) => (base + (index < remainder ? 1 : 0)) / 100
  )
}

/** Same closers with the same shares, ignoring order. */
export function closerSplitsEqual(
  a: readonly CloserShare[],
  b: readonly CloserShare[]
): boolean {
  if (a.length !== b.length) return false
  const shares = new Map(a.map(c => [closerKey(c), c.sharePercent]))
  return b.every(c => shares.get(closerKey(c)) === c.sharePercent)
}

/** "Kris Crawford (50%), Chris Donahue (50%)" — a lone closer drops the share. */
export function describeClosers(closers: readonly ClientCloser[]): string {
  if (closers.length === 1) return closers[0].name
  return closers.map(c => `${c.name} (${c.sharePercent}%)`).join(', ')
}
