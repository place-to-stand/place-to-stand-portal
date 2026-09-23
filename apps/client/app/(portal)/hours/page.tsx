export const dynamic = 'force-dynamic'

import { EmptyState } from '@pts/ui/empty-state'

import { requireClientUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/permissions'
import { resolvePortalScope } from '@/lib/auth/view-as'
import { fetchClientHoursSummaries } from '@/lib/data/hours'
import { HoursSummaryCard } from '@/components/hours/hours-summary-card'

export default async function HoursPage() {
  const user = await requireClientUser()
  const [summaries, scope] = await Promise.all([
    fetchClientHoursSummaries(user),
    resolvePortalScope(user),
  ])

  const needsClientSelection = isAdmin(user) && scope.clientIds.length === 0

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-foreground text-3xl font-semibold tracking-tight'>
          Hours
        </h1>
        <p className='text-muted-foreground mt-1 text-sm'>
          Your purchased hours and how much remains.
        </p>
      </div>

      {summaries.length === 0 ? (
        <EmptyState
          message={
            needsClientSelection
              ? 'Select a contact above to preview the portal.'
              : 'No hours yet.'
          }
        />
      ) : (
        <div className='grid gap-3'>
          {summaries.map(summary => (
            <HoursSummaryCard
              key={summary.clientId}
              summary={summary}
              showClientName={summaries.length > 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}
