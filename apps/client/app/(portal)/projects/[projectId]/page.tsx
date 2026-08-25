export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeftIcon } from 'lucide-react'

import { requireClientUser } from '@/lib/auth/session'
import { fetchProjectDetail } from '@/lib/data/project-detail'
import { fetchProjectTasks } from '@/lib/data/tasks'
import { ProjectTaskList } from '@/components/tasks/project-task-list'
import { GitHubRepoSection } from '@/components/projects/github-repos-section'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params

  if (!UUID_RE.test(projectId)) {
    notFound()
  }

  const user = await requireClientUser()

  // fetchProjectDetail enforces access; it returns null for anything outside
  // the caller's portal scope.
  const project = await fetchProjectDetail(user, projectId)

  if (!project || !project.clientId) {
    notFound()
  }

  // Re-checks access internally; the fetchProjectDetail call above is cached.
  const tasks = await fetchProjectTasks(user, projectId)

  return (
    <div className="space-y-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        Back to dashboard
      </Link>

      <h1 className="text-2xl font-bold text-foreground">{project.name}</h1>

      <ProjectTaskList tasks={tasks} />

      <GitHubRepoSection projectId={project.id} clientId={project.clientId} />
    </div>
  )
}
