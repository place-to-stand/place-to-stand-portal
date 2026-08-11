import Link from 'next/link'

import type { ClientProject } from '@/lib/data/projects'

export function ProjectCard({ project }: { project: ClientProject }) {
  return (
    <Link
      href={`/projects/${project.id}`}
      className="block rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/50 active:bg-muted"
    >
      <h3 className="font-medium text-card-foreground">{project.name}</h3>
      {project.clientName && (
        <p className="truncate text-xs text-muted-foreground">
          {project.clientName}
        </p>
      )}
    </Link>
  )
}
