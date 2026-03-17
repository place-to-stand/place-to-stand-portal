'use client'

import Link from 'next/link'
import { FolderKanban } from 'lucide-react'

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'
import type { ClientActiveProject } from '@/lib/data/clients'

type ActiveProjectsCellProps = {
  projects: ClientActiveProject[]
  clientSlug: string | null
  clientId: string
  totalProjectCount: number
}

export function ActiveProjectsCell({
  projects,
  clientSlug,
  clientId,
  totalProjectCount,
}: ActiveProjectsCellProps) {
  const activeCount = projects.length

  // Build base path for project links
  const clientPath = clientSlug ?? clientId

  if (activeCount === 0) {
    return (
      <div className='flex items-center gap-2 text-sm'>
        <FolderKanban className='text-muted-foreground h-4 w-4' />
        <span className='text-muted-foreground/50'>0 active</span>
        {totalProjectCount > 0 && (
          <span className='text-muted-foreground/50'>
            ({totalProjectCount} total)
          </span>
        )}
      </div>
    )
  }

  return (
    <div className='flex items-center gap-2 text-sm'>
      <FolderKanban className='text-muted-foreground h-4 w-4' />
      <HoverCard>
        <HoverCardTrigger asChild>
          <button
            type='button'
            className='text-muted-foreground cursor-pointer border-b border-dotted border-current transition hover:border-solid focus:outline-none'
          >
            {activeCount} active
          </button>
        </HoverCardTrigger>
        <HoverCardContent align='start' className='w-56 p-0'>
          <ul className='py-1'>
            {projects.map(project => {
              const projectPath = project.slug ?? project.id
              return (
                <li key={project.id}>
                  <Link
                    href={`/projects/${clientPath}/${projectPath}/board`}
                    className='hover:bg-accent flex items-center gap-2 px-3 py-2 text-sm transition-colors'
                  >
                    <FolderKanban className='text-muted-foreground h-4 w-4 shrink-0' />
                    <span className='truncate'>{project.name}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </HoverCardContent>
      </HoverCard>
      {totalProjectCount > activeCount && (
        <span className='text-muted-foreground/60'>
          ({totalProjectCount} total)
        </span>
      )}
    </div>
  )
}
