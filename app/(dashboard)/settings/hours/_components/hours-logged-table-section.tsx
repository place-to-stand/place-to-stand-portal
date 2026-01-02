import { format } from 'date-fns'
import { useMemo } from 'react'
import {
  Building2,
  FolderKanban,
  StickyNote,
  User,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { TimeLogForAdmin } from '@/lib/queries/time-logs/admin'
import type { PageInfo } from '@/lib/pagination/cursor'
import { cn } from '@/lib/utils'

type UserGroup = {
  user: {
    id: string
    name: string
    email: string
    isDeleted: boolean
  }
  logs: TimeLogForAdmin[]
  totalHours: number
}

export type HoursLoggedTableSectionProps = {
  timeLogs: TimeLogForAdmin[]
  pageInfo: PageInfo
  totalCount: number
  sortBy: 'user' | 'project' | 'date' | 'hours'
  sortDir: 'asc' | 'desc'
  onSort: (column: 'user' | 'project' | 'date' | 'hours') => void
  onPaginate: (direction: 'forward' | 'backward') => void
}

const formatDate = (value: string) => {
  try {
    return format(new Date(value), 'MMM d, yyyy')
  } catch (error) {
    console.warn('Unable to format date', { value, error })
    return '—'
  }
}

const formatHours = (value: string) => {
  try {
    const num = parseFloat(value)
    return num.toFixed(2)
  } catch (error) {
    console.warn('Unable to format hours', { value, error })
    return '—'
  }
}

export function HoursLoggedTableSection({
  timeLogs,
  pageInfo,
  totalCount,
  sortBy,
  sortDir,
  onSort,
  onPaginate,
}: HoursLoggedTableSectionProps) {
  const isPrevDisabled = !pageInfo.hasPreviousPage
  const isNextDisabled = !pageInfo.hasNextPage

  // Group logs by user
  const userGroups = useMemo(() => {
    const groups = new Map<string, UserGroup>()

    timeLogs.forEach(log => {
      const user = log.user
      const userId = user?.id ?? 'unknown'
      const userName = user?.fullName ?? user?.email ?? 'Unknown User'
      const userEmail = user?.email ?? ''
      const isDeleted = Boolean(user?.deletedAt)

      const existing = groups.get(userId)
      const hours = parseFloat(log.hours) || 0

      if (existing) {
        existing.logs.push(log)
        existing.totalHours += hours
      } else {
        groups.set(userId, {
          user: {
            id: userId,
            name: userName,
            email: userEmail,
            isDeleted,
          },
          logs: [log],
          totalHours: hours,
        })
      }
    })

    // Sort logs within each group by date (newest first)
    groups.forEach(group => {
      group.logs.sort(
        (a, b) =>
          new Date(b.loggedOn).getTime() - new Date(a.loggedOn).getTime(),
      )
    })

    // Convert to array and sort groups by user name
    return Array.from(groups.values()).sort((a, b) =>
      a.user.name.localeCompare(b.user.name),
    )
  }, [timeLogs])

  const renderUserSeparatorRow = (group: UserGroup) => (
    <TableRow
      key={`user-${group.user.id}`}
      className='border-t-muted hover:bg-transparent'
    >
      <TableCell
        colSpan={5}
        className='bg-emerald-100 py-3 align-middle dark:bg-emerald-500/8'
      >
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <User className='h-4 w-4 shrink-0 text-emerald-500/80' />
            <span
              className={cn(
                'text-sm font-semibold',
                group.user.isDeleted && 'text-muted-foreground line-through',
              )}
            >
              {group.user.name}
            </span>
          </div>
          <span className='text-muted-foreground text-sm font-medium'>
            {group.totalHours.toFixed(2)} hours
          </span>
        </div>
      </TableCell>
    </TableRow>
  )

  const renderLogRow = (log: TimeLogForAdmin, options?: { isLast?: boolean }) => {
    const project = log.project
    const client = log.client
    const projectDisplay = project?.name ?? 'Unknown'
    const clientDisplay = client?.name ?? '—'
    const noteDisplay =
      log.note && log.note.trim().length > 0 ? log.note : '—'

    const isDeleted = Boolean(log.deletedAt)
    const isProjectDeleted = Boolean(project?.deletedAt)
    const isClientDeleted = Boolean(client?.deletedAt)

    const treeLine = options?.isLast ? '└' : '├'

    return (
      <TableRow key={log.id} className={isDeleted ? 'opacity-60' : undefined}>
        <TableCell>
          <div className='flex items-center gap-2'>
            <span className='text-muted-foreground/30 w-4 shrink-0 text-center font-mono'>
              {treeLine}
            </span>
            <span className='text-sm'>{formatDate(log.loggedOn)}</span>
          </div>
        </TableCell>
        <TableCell className='text-sm font-medium'>
          {formatHours(log.hours)}
        </TableCell>
        <TableCell>
          <div className='flex items-center gap-2 text-sm'>
            <FolderKanban className='text-muted-foreground h-4 w-4' />
            <span
              className={cn(
                isProjectDeleted && 'text-muted-foreground line-through',
              )}
            >
              {projectDisplay}
            </span>
          </div>
        </TableCell>
        <TableCell>
          <div className='flex items-center gap-2 text-sm'>
            <Building2 className='text-muted-foreground h-4 w-4' />
            <span
              className={cn(
                'text-muted-foreground',
                isClientDeleted && 'line-through',
              )}
            >
              {clientDisplay}
            </span>
          </div>
        </TableCell>
        <TableCell className='max-w-xs'>
          <div className='flex items-start gap-2 text-sm'>
            <StickyNote className='text-muted-foreground mt-0.5 h-4 w-4 shrink-0' />
            <span className='text-muted-foreground line-clamp-2'>
              {noteDisplay}
            </span>
          </div>
        </TableCell>
      </TableRow>
    )
  }

  const tableColumnWidths = {
    date: 'w-[15%]',
    hours: 'w-[10%]',
    project: 'w-[25%]',
    client: 'w-[20%]',
    notes: 'w-[30%]',
  }

  return (
    <div className='space-y-4'>
      <div className='overflow-hidden rounded-xl border'>
        <Table className='table-fixed'>
          <TableHeader>
            <TableRow className='bg-muted/40'>
              <TableHead className={tableColumnWidths.date}>Date</TableHead>
              <TableHead className={tableColumnWidths.hours}>Hours</TableHead>
              <TableHead className={tableColumnWidths.project}>
                Project
              </TableHead>
              <TableHead className={tableColumnWidths.client}>Client</TableHead>
              <TableHead className={tableColumnWidths.notes}>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {userGroups.length > 0 ? (
              userGroups.flatMap(group => [
                renderUserSeparatorRow(group),
                ...group.logs.map((log, index) =>
                  renderLogRow(log, { isLast: index === group.logs.length - 1 }),
                ),
              ])
            ) : (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className='text-muted-foreground py-10 text-center text-sm'
                >
                  No time logs found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className='flex items-center justify-between'>
        <p className='text-muted-foreground text-sm'>
          {totalCount === 0
            ? 'No time logs'
            : totalCount === 1
              ? '1 time log'
              : `${totalCount.toLocaleString()} time logs`}
        </p>
        <div className='flex items-center gap-2'>
          <Button
            variant='outline'
            onClick={() => onPaginate('backward')}
            disabled={isPrevDisabled}
          >
            Previous
          </Button>
          <Button
            variant='default'
            onClick={() => onPaginate('forward')}
            disabled={isNextDisabled}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
