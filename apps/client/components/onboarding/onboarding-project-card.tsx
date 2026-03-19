'use client'

import { GitBranchIcon, CheckCircle2Icon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RepoSelector } from '@/components/github/repo-selector'
import type { ClientProject } from '@/lib/data/projects'

function GitHubStatus({ project }: { project: ClientProject }) {
  if (project.hasRepoLinked) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-green-600">
        <CheckCircle2Icon className="size-3.5" />
        <span className="truncate max-w-[200px]">{project.repoFullName}</span>
      </span>
    )
  }

  if (project.hasInstallation && project.clientId) {
    return (
      <div className="mt-2">
        <p className="mb-2 text-xs text-muted-foreground">
          Select a repository to link:
        </p>
        <RepoSelector projectId={project.id} clientId={project.clientId} />
      </div>
    )
  }

  return (
    <Button asChild variant="outline" size="sm" className="mt-2 gap-1.5">
      <a href={`/api/github/install?projectId=${project.id}&returnTo=/onboarding`}>
        <GitBranchIcon className="size-3.5" />
        Connect GitHub
      </a>
    </Button>
  )
}

export function OnboardingProjectCard({
  project,
}: {
  project: ClientProject
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-medium text-card-foreground">{project.name}</h3>
        <Badge variant="secondary" className="shrink-0">
          {project.status}
        </Badge>
      </div>
      <div className="mt-2">
        <GitHubStatus project={project} />
      </div>
    </div>
  )
}
