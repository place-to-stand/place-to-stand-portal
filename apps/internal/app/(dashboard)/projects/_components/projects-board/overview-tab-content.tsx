'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Calendar, ExternalLink } from 'lucide-react'
import { siGithub } from 'simple-icons/icons'
import { IntegrationProviderIcon } from '@/components/integrations/provider-icon'
import { formatIntegrationLinkLabel } from '@/lib/types/integrations'

import { Avatar, AvatarFallback, AvatarImage } from '@pts/ui/avatar'
import { Button } from '@pts/ui/button'
import { formatCalendarDate, formatRelativeTime } from '@pts/ui/dates'
import { EmptyState } from '@pts/ui/empty-state'
import { TabsContent } from '@pts/ui/tabs'
import { formatHours } from '@pts/ui/numbers'
import { ProjectStatusBadge } from '@/components/projects/project-status-badge'
import { formatProjectDateRange } from '@/lib/settings/projects/project-formatters'
import { useSheetParams } from '@/lib/sheets/use-sheet-params'
import { prefetchSheetInit } from '@/lib/sheets/wrappers/use-sheet-init'
import { cn } from '@/lib/utils'
import { ProjectsBoardEmpty } from '../projects-board-empty'
import { NO_SELECTION_MESSAGE } from './projects-board-tabs.constants'
import type { ProjectsBoardActiveProject } from './board-tab-content'
import { ENTITY_ICONS } from '@/lib/entity-accents'
import { ActivityFeed } from '@/components/activity/activity-feed'
import { BillingTypeBadge } from '@/components/billing/billing-type-badge'
import { WidgetCard } from '@/components/dashboard/widget-card'
import {
  SheetRecordList,
  SheetRecordRow,
} from '@/components/sheets/sheet-record-row'
import { StatCard } from '@/components/ui/stat-card'
import { BOARD_COLUMNS } from '@/lib/projects/board/board-constants'
import { formatTaskStatusLabel } from '../project-time-log/task-status-utils'
import { companySheetHref } from '@/lib/sheets/hrefs'

export type OverviewTabContentProps = {
  isActive: boolean
  activeProject: ProjectsBoardActiveProject
}

export function OverviewTabContent(props: OverviewTabContentProps) {
  const { isActive, activeProject } = props

  if (!isActive) {
    return null
  }

  return (
    <TabsContent
      value='overview'
      className='flex min-h-0 flex-1 flex-col gap-4 pb-8 sm:gap-6'
    >
      {!activeProject ? (
        <ProjectsBoardEmpty message={NO_SELECTION_MESSAGE} />
      ) : (
        <ProjectOverview project={activeProject} />
      )}
    </TabsContent>
  )
}

/**
 * The project at a glance, in the home dashboard's cards: its hours, where
 * the work stands (with what's blocked or in progress), recent activity,
 * then the details, members and infrastructure on the side. Read-only:
 * everything comes from the project already loaded for the board.
 */
function ProjectOverview({
  project,
}: {
  project: NonNullable<ProjectsBoardActiveProject>
}) {
  const pathname = usePathname()
  const tasksHref = pathname.replace(/\/overview$/, '/tasks')
  const prepaid = project.client?.billing_type === 'prepaid'
  const burndown = project.burndown

  return (
    <div className='flex flex-col gap-6'>
      <div className='grid grid-cols-2 gap-3 lg:grid-cols-4'>
        <StatCard
          label='Logged this month'
          value={formatHours(burndown?.projectMonthToDateLoggedHours ?? 0)}
        />
        <StatCard
          label='Logged in total'
          value={formatHours(burndown?.totalProjectLoggedHours ?? 0)}
        />
        {prepaid ? (
          <StatCard
            label='Client remaining'
            value={formatHours(burndown?.totalClientRemainingHours ?? 0)}
            tone={
              (burndown?.totalClientRemainingHours ?? 0) < 0
                ? 'negative'
                : 'default'
            }
          />
        ) : (
          <StatCard
            label='Open tasks'
            value={String(
              project.tasks.filter(task => task.status !== 'DONE').length
            )}
          />
        )}
        <StatCard
          label='Last logged'
          value={
            burndown?.lastLogAt
              ? (formatRelativeTime(burndown.lastLogAt) ?? '—')
              : '—'
          }
        />
      </div>

      <div className='grid grid-cols-1 items-start gap-6 lg:grid-cols-3'>
        <div className='flex flex-col gap-6 lg:col-span-2'>
          <TasksWidget project={project} tasksHref={tasksHref} />
          <WidgetCard id='project-activity' title='Recent activity'>
            <div className='px-4 py-3'>
              <ActivityFeed
                targetType={['PROJECT', 'TASK', 'COMMENT', 'TIME_LOG']}
                projectId={project.id}
                companyId={project.company_id ?? null}
                pageSize={8}
                emptyState='No project activity yet.'
              />
            </div>
          </WidgetCard>
        </div>
        <div className='flex flex-col gap-6'>
          <ProjectDetailsWidget project={project} />
          <MembersWidget project={project} />
          <InfrastructureWidget project={project} />
        </div>
      </div>
    </div>
  )
}

/** Task counts by board column, then the work that needs eyes. */
function TasksWidget({
  project,
  tasksHref,
}: {
  project: NonNullable<ProjectsBoardActiveProject>
  tasksHref: string
}) {
  const { open } = useSheetParams()
  const count = (status: string) =>
    project.tasks.filter(task => task.status === status).length
  const needsEyes = [
    ...project.tasks.filter(task => task.status === 'BLOCKED'),
    ...project.tasks.filter(task => task.status === 'IN_PROGRESS'),
  ].slice(0, 6)

  return (
    <WidgetCard
      id='project-tasks'
      title='Tasks'
      action={
        <Button variant='outline' size='sm' asChild>
          <Link href={tasksHref}>Open board</Link>
        </Button>
      }
    >
      <div className='flex flex-col gap-4 p-4'>
        <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
          {BOARD_COLUMNS.map(column => (
            <StatCard
              key={column.id}
              label={column.label}
              value={String(count(column.id))}
            />
          ))}
        </div>
        {needsEyes.length > 0 ? (
          <div className='flex flex-col gap-2'>
            <h3 className='text-sm font-semibold'>Blocked and in progress</h3>
            <SheetRecordList>
              {needsEyes.map(task => (
                <SheetRecordRow
                  key={task.id}
                  icon={ENTITY_ICONS.task}
                  title={task.title}
                  description={[
                    formatTaskStatusLabel(task.status),
                    task.due_on
                      ? `Due ${formatCalendarDate(task.due_on) ?? task.due_on}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  onOpen={() => open('task', task.id)}
                  openLabel={`Open ${task.title}`}
                />
              ))}
            </SheetRecordList>
          </div>
        ) : (
          <EmptyState message='Nothing blocked or in progress.' />
        )}
      </div>
    </WidgetCard>
  )
}

function MembersWidget({
  project,
}: {
  project: NonNullable<ProjectsBoardActiveProject>
}) {
  const members = project.members.filter(member => !member.deleted_at)
  return (
    <WidgetCard
      id='project-members'
      title='Members'
      meta={members.length ? String(members.length) : null}
    >
      <div className='p-4'>
        {members.length ? (
          <SheetRecordList>
            {members.map(member => (
              <SheetRecordRow
                key={member.id}
                icon={ENTITY_ICONS.contact}
                title={member.user.full_name ?? member.user.email}
                description={member.user.full_name ? member.user.email : null}
              />
            ))}
          </SheetRecordList>
        ) : (
          <EmptyState message='Admins see every project. No other staff on it.' />
        )}
      </div>
    </WidgetCard>
  )
}

/** Where the code lives and runs: GitHub, Vercel, Supabase. */
function InfrastructureWidget({
  project,
}: {
  project: NonNullable<ProjectsBoardActiveProject>
}) {
  const hasAny =
    project.githubRepos.length > 0 || project.integrationLinks.length > 0
  return (
    <WidgetCard id='project-infrastructure' title='Infrastructure'>
      <div className='p-4'>
        {hasAny ? (
          <div className='flex flex-col gap-2'>
            {project.githubRepos.map(repo => (
              <a
                key={repo.id}
                href={`https://github.com/${repo.repoFullName}`}
                target='_blank'
                rel='noopener noreferrer'
                className='hover:text-foreground text-muted-foreground inline-flex min-w-0 items-center gap-2 text-sm transition-colors'
              >
                <SimpleIcon icon={siGithub} className='h-4 w-4 shrink-0' />
                <span className='truncate font-medium'>
                  {repo.repoFullName}
                </span>
                <ExternalLink className='h-3 w-3 shrink-0' />
              </a>
            ))}
            {project.integrationLinks.map(link => (
              <a
                key={link.id}
                href={link.url}
                target='_blank'
                rel='noopener noreferrer'
                className='hover:text-foreground text-muted-foreground inline-flex min-w-0 items-center gap-2 text-sm transition-colors'
              >
                <IntegrationProviderIcon
                  provider={link.provider}
                  className='h-4 w-4 shrink-0'
                />
                <span className='truncate font-medium'>
                  {formatIntegrationLinkLabel(link)}
                </span>
                <ExternalLink className='h-3 w-3 shrink-0' />
              </a>
            ))}
          </div>
        ) : (
          <EmptyState message='No repositories or hosting linked.' />
        )}
      </div>
    </WidgetCard>
  )
}

function SimpleIcon({
  icon,
  className,
}: {
  icon: { title: string; path: string }
  className?: string
}) {
  return (
    <svg
      role='img'
      viewBox='0 0 24 24'
      className={className}
      xmlns='http://www.w3.org/2000/svg'
      fill='currentColor'
    >
      <title>{icon.title}</title>
      <path d={icon.path} />
    </svg>
  )
}

function getInitials(name: string | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

function ProjectDetailsWidget({
  project,
}: {
  project: NonNullable<ProjectsBoardActiveProject>
}) {
  // Owner opens their person sheet over this page (global SheetHost).
  const { open } = useSheetParams()
  const owner = project.owner
  const dateRange = formatProjectDateRange(project.starts_on, project.ends_on)

  return (
    <WidgetCard id='project-details' title='Details'>
      <div className='divide-y'>
        <DetailRow label='Name' value={project.name} />
        {project.slug && <DetailRow label='Slug' value={project.slug} mono />}
        <div className='flex items-center gap-3 px-4 py-2.5'>
          <span className='text-muted-foreground text-sm'>Status</span>
          <ProjectStatusBadge status={project.status} className='ml-auto' />
        </div>
        {project.client?.name && (
          <div className='flex items-center gap-3 px-4 py-2.5'>
            <span className='text-muted-foreground text-sm'>Client</span>
            <div className='ml-auto flex items-center gap-2'>
              {project.client.company_id ? (
                <Link
                  href={companySheetHref(project.client.company_id)}
                  className='text-sm font-medium underline-offset-4 hover:underline'
                >
                  {project.client.name}
                </Link>
              ) : (
                <span className='text-sm font-medium'>
                  {project.client.name}
                </span>
              )}
              {project.client.billing_type && (
                <BillingTypeBadge
                  billingType={
                    project.client.billing_type as 'prepaid' | 'net_30'
                  }
                />
              )}
            </div>
          </div>
        )}
        <div className='flex items-center gap-3 px-4 py-2.5'>
          <span className='text-muted-foreground text-sm'>Owner</span>
          <div className='ml-auto flex items-center gap-2'>
            {owner?.contact_id ? (
              <button
                type='button'
                className='group focus-visible:border-ring focus-visible:ring-ring/50 flex cursor-pointer items-center gap-2 rounded-md outline-none focus-visible:ring-[3px]'
                onPointerEnter={() =>
                  prefetchSheetInit('contact', owner.contact_id!)
                }
                onClick={() => open('contact', owner.contact_id!)}
              >
                <Avatar size='sm'>
                  {owner.avatar_url && (
                    <AvatarImage
                      src={`/api/storage/user-avatar/${owner.id}`}
                      alt={owner.full_name ?? 'Owner'}
                    />
                  )}
                  <AvatarFallback>
                    {getInitials(owner.full_name)}
                  </AvatarFallback>
                </Avatar>
                <span className='text-sm font-medium underline-offset-4 group-hover:underline'>
                  {owner.full_name ?? 'Unknown'}
                </span>
              </button>
            ) : (
              <span className='text-muted-foreground/60 text-sm'>—</span>
            )}
          </div>
        </div>
        {dateRange !== '—' && (
          <div className='flex items-center gap-3 px-4 py-2.5'>
            <span className='text-muted-foreground text-sm'>Dates</span>
            <div className='ml-auto flex items-center gap-1.5'>
              <Calendar className='text-muted-foreground h-3.5 w-3.5' />
              <span className='text-sm font-medium'>{dateRange}</span>
            </div>
          </div>
        )}
      </div>
    </WidgetCard>
  )
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className='flex items-center gap-3 px-4 py-2.5'>
      <span className='text-muted-foreground text-sm'>{label}</span>
      <span
        className={cn(
          'ml-auto text-sm font-medium',
          mono && 'font-mono text-xs'
        )}
      >
        {value}
      </span>
    </div>
  )
}
