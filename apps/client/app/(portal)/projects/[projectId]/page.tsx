export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeftIcon } from 'lucide-react'

import { requireClientUser } from '@/lib/auth/session'
import { ensureClientAccess, isAdmin } from '@/lib/auth/permissions'
import { fetchProjectDetail } from '@/lib/data/project-detail'
import { Badge } from '@/components/ui/badge'
import { GitHubSection } from '@/components/github/github-section'
import { GitHubSuccessBanner } from '@/components/github/github-success-banner'

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
  const project = await fetchProjectDetail(projectId)

  if (!project) {
    notFound()
  }

  // Verify access
  if (project.clientId && !isAdmin(user)) {
    await ensureClientAccess(user, project.clientId)
  }

  return (
    <div className="space-y-6">
      <GitHubSuccessBanner />

      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        Back to projects
      </Link>

      <div className="flex items-start justify-between gap-3">
        <h1 className="text-2xl font-bold text-foreground">{project.name}</h1>
        <Badge variant="secondary" className="shrink-0">
          {project.status}
        </Badge>
      </div>

      <GitHubSection project={project} />
    </div>
  )
}
