/**
 * Partner profit share: whatever the company's Mercury balance holds at the
 * end of a month, after that month's partner payouts and a minimum operating
 * balance, is split evenly between the profit-share partners.
 *
 *   available = max(0, month-end balance − partner payouts − minimum balance)
 *   each partner = available ÷ partners, rounded DOWN to the cent
 *
 * Rounding down means a stray cent stays in the account instead of being
 * paid twice. The start month, minimum balance and partners are set on
 * Settings → Business (`readProfitSharePolicy` in @pts/db/business); a
 * closed month keeps the figures frozen in its snapshot.
 *
 * Pure module (no server-only): the close drift comparison and the UI both
 * call computeProfitShare.
 */

export type ProfitSharePartner = {
  userId: string
  name: string
  email: string
  avatarUpdatedAt: string | null
  /** This partner's share of `available`, in dollars. */
  amount: number
}

export type ProfitShareAccount = {
  id: string
  name: string
  balance: number
}

export type ProfitShareData = {
  /** Last day of the month the balance is taken at (YYYY-MM-DD). */
  asOfDate: string
  /** False while the month is still running: the balance is today's. */
  monthComplete: boolean
  balance: number
  accounts: ProfitShareAccount[]
  /** When the balance was read from Mercury (ISO). */
  fetchedAt: string
  /** Set when the profit share was added to a close after the fact (ISO). */
  addedAfterCloseAt: string | null
  payouts: number
  minimumBalance: number
  /** balance − payouts − minimum, floored at zero. */
  available: number
  /** How far the balance fell short of payouts + minimum (0 when it didn't). */
  shortfall: number
  partners: ProfitSharePartner[]
  /** Sum of partner amounts (≤ available by at most a few cents). */
  totalAmount: number
}

const round2 = (value: number): number => Math.round(value * 100) / 100

/**
 * True when the profit share is set up and the month (1-indexed) is on or
 * after its start.
 */
export function profitShareAppliesTo(
  policy: { startsOn: string } | null,
  year: number,
  month: number
): boolean {
  if (!policy) return false
  const period = `${year}-${String(month).padStart(2, '0')}-01`
  return period >= policy.startsOn
}

export function computeProfitShare(input: {
  asOfDate: string
  monthComplete: boolean
  balance: number
  accounts: ProfitShareAccount[]
  fetchedAt: string
  addedAfterCloseAt?: string | null
  payouts: number
  partners: Array<Omit<ProfitSharePartner, 'amount'>>
  minimumBalance: number
}): ProfitShareData {
  const minimumBalance = input.minimumBalance
  const raw = round2(input.balance - input.payouts - minimumBalance)
  const available = Math.max(0, raw)
  const count = input.partners.length
  const eachCents = count > 0 ? Math.floor((available * 100) / count) : 0
  const each = eachCents / 100

  const partners = input.partners.map(partner => ({ ...partner, amount: each }))

  return {
    asOfDate: input.asOfDate,
    monthComplete: input.monthComplete,
    balance: round2(input.balance),
    accounts: input.accounts,
    fetchedAt: input.fetchedAt,
    addedAfterCloseAt: input.addedAfterCloseAt ?? null,
    payouts: round2(input.payouts),
    minimumBalance,
    available,
    shortfall: raw < 0 ? round2(-raw) : 0,
    partners,
    totalAmount: round2(each * count),
  }
}
