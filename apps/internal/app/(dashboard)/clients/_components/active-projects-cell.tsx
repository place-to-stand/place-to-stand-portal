'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { FolderKanban } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'
import { getProjectStatusLabel, getProjectStatusToken } from '@/lib/constants'
import type { ClientProjectSummary } from '@/lib/data/clients'
import { cn } from '@/lib/utils'

type ActiveProjectsCellProps = {
  projects: ClientProjectSummary[]
  allProjects: ClientProjectSummary[]
  clientSlug: string | null
  clientId: string
  totalProjectCount: number
}

type OpenCard = 'active' | 'total' | null

export function ActiveProjectsCell({
  projects,
  allProjects,
  clientSlug,
  clientId,
  totalProjectCount,
}: ActiveProjectsCellProps) {
  const activeCount = projects.length

  // Build base path for project links
  const clientPath = clientSlug ?? clientId

  // Coordinated hovers (W8): both cards are controlled here so opening one
  // force-closes the other — the wrapper's 50ms open / 200ms close timers
  // would otherwise show both for ~150ms when sliding between triggers.
  const [openCard, setOpenCard] = useState<OpenCard>(null)

  // Close callbacks clear shared state only if they still own it (R8): a
  // stale close from the previous card must not wipe the just-opened one.
  const handleActiveOpenChange = useCallback((open: boolean) => {
    if (open) {
      setOpenCard('active')
    } else {
      setOpenCard(current => (current === 'active' ? null : current))
    }
  }, [])

  const handleTotalOpenChange = useCallback((open: boolean) => {
    if (open) {
      setOpenCard('total')
    } else {
      setOpenCard(current => (current === 'total' ? null : current))
    }
  }, [])

  const totalHover = (tone: string) => (
    <HoverCard open={openCard === 'total'} onOpenChange={handleTotalOpenChange}>
      <HoverCardTrigger asChild>
        <button
          type='button'
          className={cn(
            'cursor-pointer border-b border-dotted border-current transition hover:border-solid focus:outline-none',
            tone
          )}
        >
          ({totalProjectCount} total)
        </button>
      </HoverCardTrigger>
      <HoverCardContent align='start' className='w-auto min-w-64 p-0'>
        <ul className='max-h-80 overflow-y-auto py-1'>
          {allProjects.map(project => {
            const projectPath = project.slug ?? project.id
            return (
              <li key={project.id}>
                <Link
                  href={`/projects/${clientPath}/${projectPath}/tasks`}
                  className='hover:bg-accent flex items-center gap-2 px-3 py-2 text-sm transition-colors'
                >
                  <FolderKanban className='text-muted-foreground h-4 w-4 shrink-0' />
                  <span className='flex-1 whitespace-nowrap'>
                    {project.name}
                  </span>
                  <Badge
                    variant='outline'
                    className={cn(
                      'text-xs',
                      getProjectStatusToken(project.status)
                    )}
                  >
                    {getProjectStatusLabel(project.status)}
                  </Badge>
                </Link>
              </li>
            )
          })}
        </ul>
      </HoverCardContent>
    </HoverCard>
  )

  if (activeCount === 0) {
    return (
      <div className='flex items-center gap-2 text-sm'>
        <FolderKanban className='text-muted-foreground h-4 w-4' />
        <span className='text-muted-foreground/50'>0 active</span>
        {totalProjectCount > 0 && totalHover('text-muted-foreground/50')}
      </div>
    )
  }

  return (
    <div className='flex items-center gap-2 text-sm'>
      <FolderKanban className='text-muted-foreground h-4 w-4' />
      <HoverCard
        open={openCard === 'active'}
        onOpenChange={handleActiveOpenChange}
      >
        <HoverCardTrigger asChild>
          <button
            type='button'
            className='text-muted-foreground cursor-pointer border-b border-dotted border-current transition hover:border-solid focus:outline-none'
          >
            {activeCount} active
          </button>
        </HoverCardTrigger>
        <HoverCardContent align='start' className='w-auto min-w-56 p-0'>
          <ul className='py-1'>
            {projects.map(project => {
              const projectPath = project.slug ?? project.id
              return (
                <li key={project.id}>
                  <Link
                    href={`/projects/${clientPath}/${projectPath}/tasks`}
                    className='hover:bg-accent flex items-center gap-2 px-3 py-2 text-sm transition-colors'
                  >
                    <FolderKanban className='text-muted-foreground h-4 w-4 shrink-0' />
                    <span className='whitespace-nowrap'>{project.name}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </HoverCardContent>
      </HoverCard>
      {totalProjectCount > activeCount &&
        totalHover('text-muted-foreground/60')}
    </div>
  )
}
