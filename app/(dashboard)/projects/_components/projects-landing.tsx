'use client'

import Link from 'next/link'
import { useCallback, useMemo, useTransition } from 'react'
import type { ReactNode } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Building2, FolderKanban, UserRound, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { siGithub } from 'simple-icons/icons'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/components/ui/use-toast'
import {
  ProjectStatusFilter,
  DEFAULT_STATUS_FILTER,
} from '@/components/projects/project-status-filter'
import { ProjectStatusCell } from '@/components/projects/project-status-cell'
import type { ProjectStatusValue } from '@/lib/constants'
import { formatProjectDateRange } from '@/lib/settings/projects/project-formatters'
import { buildBoardPath } from '@/lib/projects/board/board-utils'
import {
  createProjectLookup,
  createProjectsByClientLookup,
  createClientSlugLookup,
} from '@/lib/projects/board/board-utils'
import { updateProjectStatus } from '@/lib/settings/projects/actions/update-project-status'
import type { ProjectWithRelations } from '@/lib/types'
import { cn } from '@/lib/utils'

function getInitials(name: string | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

function SimpleIcon({
  icon,
  className,
  color,
}: {
  icon: { title: string; path: string; hex: string }
  className?: string
  color?: string
}) {
  return (
    <svg
      role='img'
      viewBox='0 0 24 24'
      className={className}
      xmlns='http://www.w3.org/2000/svg'
      fill={color || 'currentColor'}
    >
      <title>{icon.title}</title>
      <path d={icon.path} />
    </svg>
  )
}

type ClientProjectSection = {
  client: { id: string; name: string; slug: string | null }
  projects: ProjectWithRelations[]
}

type ProjectsLandingProps = {
  projects: ProjectWithRelations[]
  clients: Array<{ id: string; name: string; slug: string | null }>
  currentUserId: string
  isAdmin: boolean
}

type SectionConfig = {
  key: 'client' | 'internal' | 'personal'
  title: string
  icon: LucideIcon
  count: number
  content: ReactNode
}

export function ProjectsLanding({
  projects,
  clients,
  currentUserId,
  isAdmin,
}: ProjectsLandingProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [, startTransition] = useTransition()

  // Parse status filter from URL params
  const selectedStatuses = useMemo<ProjectStatusValue[]>(() => {
    const statusParam = searchParams.get('status')
    // No param = use default, 'none' = explicitly cleared
    if (!statusParam) {
      return DEFAULT_STATUS_FILTER
    }
    if (statusParam === 'none') {
      return []
    }
    const statuses = statusParam
      .split(',')
      .filter(Boolean) as ProjectStatusValue[]
    return statuses.length > 0 ? statuses : DEFAULT_STATUS_FILTER
  }, [searchParams])

  // Handle filter change - update URL
  const handleStatusFilterChange = useCallback(
    (statuses: ProjectStatusValue[]) => {
      const params = new URLSearchParams(searchParams.toString())
      const hasInteracted = searchParams.has('status')

      // Check if this matches the default
      const isDefault =
        statuses.length === DEFAULT_STATUS_FILTER.length &&
        DEFAULT_STATUS_FILTER.every(s => statuses.includes(s))

      if (statuses.length === 0) {
        // Use 'none' to represent explicitly cleared state
        params.set('status', 'none')
      } else if (isDefault && !hasInteracted) {
        // Only omit from URL if user hasn't interacted yet (clean landing)
        params.delete('status')
      } else {
        // Always include in URL once user has started interacting
        params.set('status', statuses.join(','))
      }

      const queryString = params.toString()
      const newUrl = queryString ? `${pathname}?${queryString}` : pathname

      startTransition(() => {
        router.push(newUrl, { scroll: false })
      })
    },
    [pathname, router, searchParams]
  )

  // Handle status change for a project
  const handleProjectStatusChange = useCallback(
    async (projectId: string, status: ProjectStatusValue) => {
      const result = await updateProjectStatus({ projectId, status })

      if (result.error) {
        toast({
          title: 'Failed to update status',
          description: result.error,
          variant: 'destructive',
        })
        throw new Error(result.error)
      }

      router.refresh()
    },
    [router, toast]
  )

  // Filter projects by selected statuses
  const filteredProjects = useMemo(() => {
    // When no statuses selected, show no projects
    if (selectedStatuses.length === 0) {
      return []
    }
    return projects.filter(p =>
      selectedStatuses.includes(p.status as ProjectStatusValue)
    )
  }, [projects, selectedStatuses])

  // Track unfiltered counts for empty state messaging
  const unfilteredCounts = useMemo(() => {
    let clientCount = 0
    let internalCount = 0
    let personalCount = 0

    projects.forEach(project => {
      if (project.type === 'INTERNAL') {
        internalCount++
      } else if (project.type === 'PERSONAL') {
        if (project.created_by === currentUserId) {
          personalCount++
        }
      } else if (project.client_id && project.client) {
        clientCount++
      }
    })

    return { clientCount, internalCount, personalCount }
  }, [projects, currentUserId])

  const { clientSections, internalProjects, personalProjects } = useMemo(() => {
    const clientMap = new Map<string, ClientProjectSection>()
    const internal: ProjectWithRelations[] = []
    const personal: ProjectWithRelations[] = []

    filteredProjects.forEach(project => {
      if (project.type === 'INTERNAL') {
        internal.push(project)
        return
      }

      if (project.type === 'PERSONAL') {
        if (project.created_by === currentUserId) {
          personal.push(project)
        }
        return
      }

      if (!project.client_id || !project.client) {
        return
      }

      const existing = clientMap.get(project.client_id)
      if (existing) {
        existing.projects.push(project)
      } else {
        clientMap.set(project.client_id, {
          client: {
            id: project.client.id,
            name: project.client.name,
            slug: project.client.slug,
          },
          projects: [project],
        })
      }
    })

    clientMap.forEach(entry => {
      entry.projects.sort((a, b) => a.name.localeCompare(b.name))
    })

    internal.sort((a, b) => a.name.localeCompare(b.name))
    personal.sort((a, b) => a.name.localeCompare(b.name))

    const sortedClientSections = Array.from(clientMap.values()).sort((a, b) =>
      a.client.name.localeCompare(b.client.name)
    )

    return {
      clientSections: sortedClientSections,
      internalProjects: internal,
      personalProjects: personal,
    }
  }, [filteredProjects, currentUserId])

  const projectLookup = useMemo(() => createProjectLookup(projects), [projects])
  const projectsByClientId = useMemo(
    () => createProjectsByClientLookup(projects),
    [projects]
  )
  const clientSlugLookup = useMemo(
    () => createClientSlugLookup(clients),
    [clients]
  )

  const getProjectHref = (project: ProjectWithRelations) => {
    const path = buildBoardPath(
      project.id,
      {
        projectLookup,
        projectsByClientId,
        clientSlugLookup,
      },
      { view: 'board' }
    )
    return path ?? '#'
  }

  const hasAnyProjects = projects.length > 0

  if (!hasAnyProjects) {
    return (
      <div className='grid h-full w-full place-items-center rounded-xl border border-dashed p-12 text-center'>
        <div className='space-y-2'>
          <h2 className='text-lg font-semibold'>No projects found</h2>
          <p className='text-muted-foreground text-sm'>
            Projects will appear here once they are created.
          </p>
        </div>
      </div>
    )
  }

  const renderSectionEmptyState = (message: string) => (
    <div className='text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm'>
      {message}
    </div>
  )

  const renderProjectRow = (
    project: ProjectWithRelations,
    options?: { indent?: boolean; isLast?: boolean }
  ) => {
    const href = getProjectHref(project)
    const dateRange = formatProjectDateRange(project.starts_on, project.ends_on)

    const activeTasks = project.tasks.filter(task => task.status !== 'ARCHIVED')
    const doneCount = activeTasks.filter(task => task.status === 'DONE').length
    const totalCount = activeTasks.length
    const progressPercentage =
      totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0

    const treeLine = options?.indent ? (options.isLast ? '└' : '├') : null
    const firstRepo = project.githubRepos[0]

    return (
      <TableRow key={project.id}>
        <TableCell>
          <div className='flex items-center'>
            {treeLine && (
              <span className='text-muted-foreground/30 mr-2 w-4 shrink-0 text-center font-mono'>
                {treeLine}
              </span>
            )}
            <Link
              href={href}
              className='flex items-center gap-2 py-1 hover:underline'
            >
              <FolderKanban className='h-4 w-4 shrink-0 text-emerald-500' />
              <span className='font-medium'>{project.name}</span>
            </Link>
          </div>
        </TableCell>
        <TableCell>
          <ProjectStatusCell
            projectId={project.id}
            status={project.status}
            onStatusChange={handleProjectStatusChange}
            disabled={!isAdmin}
          />
        </TableCell>
        <TableCell>
          <div className='flex items-center gap-3'>
            <Progress value={progressPercentage} className='h-2 w-24' />
            <span className='text-muted-foreground text-xs'>
              {doneCount}/{totalCount}
            </span>
          </div>
        </TableCell>
        <TableCell>
          <span className='text-muted-foreground text-sm'>
            {dateRange !== '—' ? dateRange : '—'}
          </span>
        </TableCell>
        <TableCell className='align-middle'>
          {project.owner ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Avatar className='h-7 w-7'>
                    {project.owner.avatar_url && (
                      <AvatarImage
                        src={`/api/storage/user-avatar/${project.owner.id}`}
                        alt={project.owner.full_name ?? 'Owner'}
                      />
                    )}
                    <AvatarFallback className='text-xs'>
                      {getInitials(project.owner.full_name)}
                    </AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{project.owner.full_name ?? 'Unknown'}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <span className='text-muted-foreground/40'>—</span>
          )}
        </TableCell>
        <TableCell className='align-middle'>
          <div className='flex h-full items-center'>
            {firstRepo ? (
              <a
                href={`https://github.com/${firstRepo.repoFullName}`}
                target='_blank'
                rel='noopener noreferrer'
                className='text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition-colors'
                title={firstRepo.repoFullName}
              >
                <SimpleIcon icon={siGithub} className='h-4 w-4' />
              </a>
            ) : (
              <span className='text-muted-foreground/40'>—</span>
            )}
          </div>
        </TableCell>
      </TableRow>
    )
  }

  const tableColumnWidths = {
    project: 'w-[30%]',
    status: 'w-[11%]',
    progress: 'w-[20%]',
    dates: 'w-[16%]',
    owner: 'w-[11%]',
    links: 'w-[12%]',
  }

  const renderProjectTable = (items: ProjectWithRelations[]) => (
    <div className='rounded-lg border'>
      <Table className='table-fixed'>
        <TableHeader>
          <TableRow className='bg-muted/40'>
            <TableHead className={tableColumnWidths.project}>Project</TableHead>
            <TableHead className={tableColumnWidths.status}>Status</TableHead>
            <TableHead className={tableColumnWidths.progress}>
              Progress
            </TableHead>
            <TableHead className={tableColumnWidths.dates}>Dates</TableHead>
            <TableHead className={tableColumnWidths.owner}>Owner</TableHead>
            <TableHead className={tableColumnWidths.links}>Links</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>{items.map(project => renderProjectRow(project))}</TableBody>
      </Table>
    </div>
  )

  const renderClientSeparatorRow = (client: {
    id: string
    name: string
    slug: string | null
  }) => (
    <TableRow
      key={`client-${client.id}`}
      className='border-t-muted hover:bg-transparent'
    >
      <TableCell
        colSpan={6}
        className='bg-blue-100 py-3 align-middle dark:bg-blue-500/8'
      >
        <Link
          href={
            client.slug ? `/clients/${client.slug}` : `/clients/${client.id}`
          }
          className='flex w-fit shrink items-center gap-2 underline-offset-4 opacity-65 hover:underline'
        >
          <Building2 className='h-4 w-4 shrink-0 text-blue-500/80' />
          <span className='text-sm font-semibold'>{client.name}</span>
        </Link>
      </TableCell>
    </TableRow>
  )

  const clientSectionContent =
    clientSections.length > 0 ? (
      <div className='rounded-lg border'>
        <Table className='table-fixed'>
          <TableHeader>
            <TableRow className='bg-muted/40'>
              <TableHead className={tableColumnWidths.project}>
                Project
              </TableHead>
              <TableHead className={tableColumnWidths.status}>Status</TableHead>
              <TableHead className={tableColumnWidths.progress}>
                Progress
              </TableHead>
              <TableHead className={tableColumnWidths.dates}>Dates</TableHead>
              <TableHead className={tableColumnWidths.owner}>Owner</TableHead>
              <TableHead className={tableColumnWidths.links}>Links</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clientSections.flatMap(({ client, projects: clientProjects }) => [
              renderClientSeparatorRow(client),
              ...clientProjects.map((project, index) =>
                renderProjectRow(project, {
                  indent: true,
                  isLast: index === clientProjects.length - 1,
                })
              ),
            ])}
          </TableBody>
        </Table>
      </div>
    ) : (
      renderSectionEmptyState(
        unfilteredCounts.clientCount > 0
          ? 'No client projects match the selected status filter.'
          : 'Client projects will appear here once they are created.'
      )
    )

  const getInternalEmptyMessage = () => {
    if (unfilteredCounts.internalCount > 0) {
      return 'No internal projects match the selected status filter.'
    }
    return 'There are no internal projects yet.'
  }

  const getPersonalEmptyMessage = () => {
    if (unfilteredCounts.personalCount > 0) {
      return 'No personal projects match the selected status filter.'
    }
    return 'You have not created any personal projects yet.'
  }

  const sectionConfigs: (SectionConfig & { className?: string })[] = [
    {
      key: 'internal',
      title: 'Internal Projects',
      icon: Users,
      count: internalProjects.length,
      content:
        internalProjects.length > 0
          ? renderProjectTable(internalProjects)
          : renderSectionEmptyState(getInternalEmptyMessage()),
    },
    {
      key: 'personal',
      title: 'Personal Projects',
      icon: UserRound,
      count: personalProjects.length,
      content:
        personalProjects.length > 0
          ? renderProjectTable(personalProjects)
          : renderSectionEmptyState(getPersonalEmptyMessage()),
    },
  ]

  return (
    <div className='space-y-12'>
      <div className='space-y-6'>
        <ProjectStatusFilter
          selectedStatuses={selectedStatuses}
          onSelectionChange={handleStatusFilterChange}
        />
        {clientSectionContent}
      </div>
      {sectionConfigs.map(
        ({ key, title, icon: Icon, count, content, className }) => (
          <div key={key} className={cn('space-y-4', className)}>
            <div className='flex items-center gap-2'>
              <div className='bg-accent flex h-8 w-8 items-center justify-center rounded-md border shadow-sm'>
                <Icon className='text-muted-foreground h-4 w-4' />
              </div>
              <h2 className='text-base font-semibold'>{title}</h2>
              <span className='text-muted-foreground text-sm'>({count})</span>
            </div>
            <div>{content}</div>
          </div>
        )
      )}
    </div>
  )
}
