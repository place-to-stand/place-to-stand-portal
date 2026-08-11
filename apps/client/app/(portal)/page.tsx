export const dynamic = 'force-dynamic'

import { requireClientUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/permissions'
import { resolvePortalScope } from '@/lib/auth/view-as'
import { fetchClientProjects } from '@/lib/data/projects'
import { fetchClientHoursSummaries } from '@/lib/data/hours'
import { ProjectCard } from '@/components/project-card'
import { HoursSummaryCard } from '@/components/hours/hours-summary-card'

export default async function DashboardPage() {
  const user = await requireClientUser()
  const [projects, hoursSummaries, scope] = await Promise.all([
    fetchClientProjects(user),
    fetchClientHoursSummaries(user),
    resolvePortalScope(user),
  ])

  const needsClientSelection = isAdmin(user) && scope.clientIds.length === 0

  return (
    <div className="space-y-6">
      {hoursSummaries.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Your Hours
          </h2>

          <div className="grid gap-3">
            {hoursSummaries.map(summary => (
              <HoursSummaryCard
                key={summary.clientId}
                summary={summary}
                showClientName={hoursSummaries.length > 1}
              />
            ))}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h1 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Projects
        </h1>

        {projects.length === 0 ? (
          <div className="rounded-lg border border-border p-6 text-center">
            <p className="text-sm text-muted-foreground">
              {needsClientSelection
                ? 'Select a client above to preview their portal.'
                : 'No projects found. Contact your account manager to get started.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {projects.map(project => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
