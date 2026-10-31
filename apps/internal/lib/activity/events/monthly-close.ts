import { ActivityVerbs, type ActivityEvent } from '@/lib/activity/types'
import { formatCurrency } from '@pts/ui/numbers'

import { toMetadata } from './shared'

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

const periodLabel = (year: number, month: number): string =>
  `${MONTH_NAMES[month - 1] ?? `Month ${month}`} ${year}`

export const monthlyCloseClosedEvent = (args: {
  year: number
  month: number
  combinedBillingTotal: number
  combinedPayoutTotal: number
}): ActivityEvent => ({
  verb: ActivityVerbs.MONTHLY_CLOSE_CLOSED,
  summary: `Closed ${periodLabel(args.year, args.month)} (billing ${formatCurrency(args.combinedBillingTotal, { cents: false })} / payouts ${formatCurrency(args.combinedPayoutTotal, { cents: false })})`,
  metadata: toMetadata({
    year: args.year,
    month: args.month,
    combinedBillingTotal: args.combinedBillingTotal,
    combinedPayoutTotal: args.combinedPayoutTotal,
  }),
})

export const monthlyCloseReclosedEvent = (args: {
  year: number
  month: number
  combinedBillingTotal: number
  combinedPayoutTotal: number
  previousSnapshotId?: string | null
}): ActivityEvent => ({
  verb: ActivityVerbs.MONTHLY_CLOSE_RECLOSED,
  summary: `Re-closed ${periodLabel(args.year, args.month)} (billing ${formatCurrency(args.combinedBillingTotal, { cents: false })} / payouts ${formatCurrency(args.combinedPayoutTotal, { cents: false })})`,
  metadata: toMetadata({
    year: args.year,
    month: args.month,
    combinedBillingTotal: args.combinedBillingTotal,
    combinedPayoutTotal: args.combinedPayoutTotal,
    previousSnapshotId: args.previousSnapshotId ?? null,
  }),
})

export const monthlyCloseReopenedEvent = (args: {
  year: number
  month: number
}): ActivityEvent => ({
  verb: ActivityVerbs.MONTHLY_CLOSE_REOPENED,
  summary: `Reopened ${periodLabel(args.year, args.month)}`,
  metadata: toMetadata({ year: args.year, month: args.month }),
})
