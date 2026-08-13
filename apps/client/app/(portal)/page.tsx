export const dynamic = 'force-dynamic'

import { requireClientUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/permissions'
import { resolvePortalScope } from '@/lib/auth/view-as'
import { fetchClientProjects } from '@/lib/data/projects'
import { fetchClientHoursSummaries } from '@/lib/data/hours'
import { fetchClientInvoiceSummary } from '@/lib/data/invoices'
import { AccountCard } from '@/components/account-card'
import { ProjectsCard } from '@/components/projects-card'

export default async function DashboardPage() {
  const user = await requireClientUser()
  const [projects, hoursSummaries, invoiceSummary, scope] = await Promise.all([
    fetchClientProjects(user),
    fetchClientHoursSummaries(user),
    fetchClientInvoiceSummary(user),
    resolvePortalScope(user),
  ])

  const needsClientSelection = isAdmin(user) && scope.clientIds.length === 0
  const showClientName = scope.scopedClients.length > 1

  // With one client there is a name worth putting at the top of the page. With
  // several — or none, which is an admin who has not picked one yet — there
  // isn't, and the per-client breakdown is already on the cards via
  // showClientName.
  const title = showClientName
    ? 'Dashboard'
    : (scope.scopedClients[0]?.name ?? 'Dashboard')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        {/* One paragraph, not two lines: text-balance only evens out the lines
            of a single block, and hard-splitting the sentences left a ragged
            first line beside a short second one at most widths.
            Says "hours" rather than "hours remaining" on purpose — a net_30
            client sees their terms here, not a balance. */}
        <p className="mt-1 text-sm text-balance text-muted-foreground">
          This is a snapshot of your current engagement with Place to Stand —
          your hours, invoices, and project progress.
        </p>
      </div>

      {/* items-start, so each card is only as tall as its content. The two
          columns are aligned by their SummaryHeader rows sharing a min-height,
          not by stretching the cards. */}
      <div className="grid items-start gap-6 dash:grid-cols-2">
        {/* No section headings: each card's SummaryHeader already names it
            ("Hours Remaining", "Tasks Completed"), and "Account" would collide
            with the header menu of the same name. */}
        <div>
          {scope.clientIds.length > 0 ? (
            <AccountCard
              hoursSummaries={hoursSummaries}
              invoiceSummary={invoiceSummary}
              showClientName={showClientName}
            />
          ) : (
            <EmptyState>
              {needsClientSelection
                ? 'Select a client above to preview their portal.'
                : 'No account information is available yet. Contact your account manager to get started.'}
            </EmptyState>
          )}
        </div>

        <div>
          {projects.length === 0 ? (
            <EmptyState>
              {needsClientSelection
                ? 'Select a client above to preview their portal.'
                : 'No projects found. Contact your account manager to get started.'}
            </EmptyState>
          ) : (
            <ProjectsCard projects={projects} showClientName={showClientName} />
          )}
        </div>
      </div>
    </div>
  )
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border p-6 text-center">
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  )
}
