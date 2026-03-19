'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CheckCircle2Icon, CircleIcon, GitBranchIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ClientProject } from '@/lib/data/projects'

function GitHubIndicator({
  hasRepoLinked,
  repoFullName,
  hasInstallation,
}: Pick<ClientProject, 'hasRepoLinked' | 'repoFullName' | 'hasInstallation'>) {
  if (hasRepoLinked) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-green-600">
        <GitBranchIcon className="size-3.5" />
        <span className="hidden sm:inline truncate max-w-[160px]">
          {repoFullName}
        </span>
      </span>
    )
  }

  if (hasInstallation) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-amber-600">
        <span className="size-2 rounded-full bg-amber-500" />
        <span className="hidden sm:inline">App installed</span>
      </span>
    )
  }

  return null
}

function SetupChecklist({ project }: { project: ClientProject }) {
  const router = useRouter()

  const steps = [
    {
      label: 'Install GitHub App',
      done: project.hasInstallation,
      href: `/api/github/install?projectId=${project.id}&returnTo=/`,
      external: true,
    },
    {
      label: 'Link a repository',
      done: project.hasRepoLinked,
      href: `/projects/${project.id}`,
      external: false,
    },
  ]

  return (
    <ul className="space-y-1">
      {steps.map(step => (
        <li key={step.label} className="flex items-center gap-1.5 text-xs">
          {step.done ? (
            <>
              <CheckCircle2Icon className="size-3.5 text-green-600 shrink-0" />
              <span className="text-muted-foreground">{step.label}</span>
            </>
          ) : (
            <>
              <CircleIcon className="size-3.5 text-muted-foreground/50 shrink-0" />
              <span
                role="link"
                tabIndex={0}
                className="text-white hover:underline cursor-pointer"
                onClick={e => {
                  e.preventDefault()
                  e.stopPropagation()
                  if (step.external) {
                    window.location.href = step.href
                  } else {
                    router.push(step.href)
                  }
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    e.stopPropagation()
                    if (step.external) {
                      window.location.href = step.href
                    } else {
                      router.push(step.href)
                    }
                  }
                }}
              >
                {step.label}
              </span>
            </>
          )}
        </li>
      ))}
    </ul>
  )
}

export function ProjectCard({ project }: { project: ClientProject }) {
  return (
    <Link
      href={`/projects/${project.id}`}
      className="block rounded-lg border border-border bg-card p-4 transition-colors active:bg-muted hover:bg-muted/50"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-medium text-card-foreground">{project.name}</h3>
        <Badge
          variant="secondary"
          className={cn(
            'shrink-0',
            project.status === 'ONBOARDING' &&
              'border-transparent bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
          )}
        >
          {project.status}
        </Badge>
      </div>
      <div className="mt-2">
        {project.status === 'ONBOARDING' ? (
          <SetupChecklist project={project} />
        ) : (
          <GitHubIndicator
            hasRepoLinked={project.hasRepoLinked}
            repoFullName={project.repoFullName}
            hasInstallation={project.hasInstallation}
          />
        )}
      </div>
    </Link>
  )
}
