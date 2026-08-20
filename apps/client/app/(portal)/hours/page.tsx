export const dynamic = 'force-dynamic'

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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Hours</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your purchased hours and how much remains.
        </p>
      </div>

      {summaries.length === 0 ? (
        <div className="rounded-lg border border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">
            {needsClientSelection
              ? 'Select a contact above to preview the portal.'
              : 'No hours information is available for your account yet. Contact your account manager to get started.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
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
