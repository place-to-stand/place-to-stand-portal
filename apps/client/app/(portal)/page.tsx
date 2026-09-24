export const dynamic = 'force-dynamic'

import { EmptyState } from '@pts/ui/empty-state'

import { requireClientUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/permissions'
import { resolvePortalScope } from '@/lib/auth/view-as'
import { fetchClientProjects } from '@/lib/data/projects'
import { fetchClientHoursSummaries } from '@/lib/data/hours'
import {
  EMPTY_INVOICE_SUMMARY,
  fetchClientInvoiceSummaries,
} from '@/lib/data/invoices'
import { AccountCard } from '@/components/account-card'
import { ProjectsCard } from '@/components/projects-card'

export default async function DashboardPage() {
  const user = await requireClientUser()
  const [
    projects,
    hoursSummaries,
    invoiceSummaries,
    scope,
  ] = await Promise.all([
    fetchClientProjects(user),
    fetchClientHoursSummaries(user),
    fetchClientInvoiceSummaries(user),
    resolvePortalScope(user),
  ])

  const needsClientSelection = isAdmin(user) && scope.clientIds.length === 0
  const clients = [...scope.scopedClients].sort((a, b) =>
    a.name.localeCompare(b.name)
  )
  const sections = clients.map(client => ({
    client,
    hoursSummary: hoursSummaries.find(s => s.clientId === client.id),
    invoiceSummary: invoiceSummaries.get(client.id) ?? EMPTY_INVOICE_SUMMARY,
    projects: projects.filter(p => p.clientId === client.id),
  }))

  return (
    <div className='space-y-8'>
      <div>
        <h1 className='text-foreground text-3xl font-semibold tracking-tight'>
          Dashboard
        </h1>
        {/* One paragraph, not two lines: text-balance only evens out the lines
            of a single block, and hard-splitting the sentences left a ragged
            first line beside a short second one at most widths. */}
        <p className='text-muted-foreground mt-1 text-sm text-balance'>
          This is a snapshot of your current engagement with Place To Stand —
          your hours, invoices, and project progress.
        </p>
      </div>

      {sections.length === 0 ? (
        <EmptyState
          message={
            needsClientSelection
              ? 'Select a contact above to preview the portal.'
              : 'No account information yet.'
          }
        />
      ) : (
        // The same layout for one client or several: every section is headed
        // by its client. GitHub setup lives on each project page; a project
        // that still needs it is flagged on the projects card.
        sections.map(section => (
          <section
            key={section.client.id}
            aria-labelledby={`client-${section.client.id}`}
            className='space-y-3'
          >
            <h2
              id={`client-${section.client.id}`}
              className='text-foreground text-lg font-semibold'
            >
              {section.client.name}
            </h2>

            {/* items-start, so each card is only as tall as its content. The
                two columns are aligned by their SummaryHeader rows sharing a
                min-height, not by stretching the cards. */}
            <div className='dash:grid-cols-2 grid items-start gap-6'>
              <AccountCard
                clientId={section.client.id}
                hoursSummary={section.hoursSummary}
                invoiceSummary={section.invoiceSummary}
              />
              {section.projects.length === 0 ? (
                <EmptyState message='No projects yet.' />
              ) : (
                <ProjectsCard projects={section.projects} />
              )}
            </div>
          </section>
        ))
      )}
    </div>
  )
}
