export const dynamic = 'force-dynamic'

import { requireClientUser } from '@/lib/auth/session'
import { fetchClientProjects } from '@/lib/data/projects'
import { ProjectCard } from '@/components/project-card'

export default async function DashboardPage() {
  const user = await requireClientUser()
  const projects = await fetchClientProjects(user)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Your Projects</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          View and manage your active projects.
        </p>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-lg border border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No projects found. Contact your account manager to get started.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {projects.map(project => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  )
}
