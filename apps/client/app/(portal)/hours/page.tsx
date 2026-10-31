export const dynamic = 'force-dynamic'

import { EmptyState } from '@pts/ui/empty-state'

import { requireClientUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/permissions'
import { resolvePortalScope } from '@/lib/auth/view-as'
import {
  fetchClientHoursSummaries,
  fetchNet30MonthlyHours,
  type ClientHoursSummary,
} from '@/lib/data/hours'
import { HoursSummaryCard } from '@/components/hours/hours-summary-card'
import { Net30HoursCard } from '@/components/hours/net-30-hours-card'

/** One line of context, for the billing types on the page. */
function subtitle(summaries: ClientHoursSummary[]): string {
  const hasNet30 = summaries.some(summary => summary.kind === 'net_30')
  const hasPrepaid = summaries.some(summary => summary.kind === 'prepaid')
  if (hasNet30 && hasPrepaid) {
    return 'Purchased hours remaining, or hours logged by month.'
  }
  return hasNet30
    ? 'Hours logged on your projects, by month.'
    : 'Your purchased hours and how much remains.'
}

export default async function HoursPage() {
  const user = await requireClientUser()
  const [summaries, net30Hours, scope] = await Promise.all([
    fetchClientHoursSummaries(user),
    fetchNet30MonthlyHours(user),
    resolvePortalScope(user),
  ])

  const needsClientSelection = isAdmin(user) && scope.companyIds.length === 0
  const showClientName = summaries.length > 1

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-foreground text-3xl font-semibold tracking-tight'>
          Hours
        </h1>
        <p className='text-muted-foreground mt-1 text-sm'>
          {subtitle(summaries)}
        </p>
      </div>

      {summaries.length === 0 ? (
        <EmptyState
          message={
            needsClientSelection
              ? 'Choose a person above to see the portal as they do.'
              : 'No hours yet.'
          }
        />
      ) : (
        <div className='grid gap-3'>
          {summaries.map(summary => {
            const hours =
              summary.kind === 'net_30'
                ? net30Hours.get(summary.companyId)
                : undefined
            return hours ? (
              <Net30HoursCard
                key={summary.companyId}
                label={showClientName ? summary.clientName : 'Hours'}
                hours={hours}
              />
            ) : (
              <HoursSummaryCard
                key={summary.companyId}
                summary={summary}
                showClientName={showClientName}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
