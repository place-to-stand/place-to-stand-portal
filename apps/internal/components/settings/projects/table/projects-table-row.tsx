import { Building2, FolderKanban, User, Users } from 'lucide-react'

import {
  RecordRowAction,
  RecordRowActions,
} from '@/components/table/record-row-action'
import { TableCell, TableRow } from '@pts/ui/table'
import { formatProjectDateRange } from '@/lib/settings/projects/project-formatters'
import { cn } from '@/lib/utils'

import type { ProjectWithClient, ProjectsTableMode } from './types'
import type { LucideIcon } from 'lucide-react'
import { ARCHIVED_ROW_CLASS } from '@/lib/table/archived-row'
import {
  CLICKABLE_ROW_CLASS,
  getClickableRowProps,
} from '@/lib/table/clickable-row'

type ProjectsTableRowProps = {
  project: ProjectWithClient
  mode: ProjectsTableMode
  isPending: boolean
  pendingReason: string
  pendingDeleteId: string | null
  pendingRestoreId: string | null
  pendingDestroyId: string | null
  onEdit: (project: ProjectWithClient) => void
  onRequestDelete: (project: ProjectWithClient) => void
  onRestore: (project: ProjectWithClient) => void
  onRequestDestroy: (project: ProjectWithClient) => void
}

export function ProjectsTableRow({
  project,
  mode,
  isPending,
  pendingReason,
  pendingDeleteId,
  pendingRestoreId,
  pendingDestroyId,
  onEdit,
  onRequestDelete,
  onRestore,
  onRequestDestroy,
}: ProjectsTableRowProps) {
  const ownerDisplay = resolveProjectOwnerDisplay(project)
  const isDeleting = isPending && pendingDeleteId === project.id
  const isRestoring = isPending && pendingRestoreId === project.id
  const isDestroying = isPending && pendingDestroyId === project.id

  const deleteDisabled =
    isDeleting || isRestoring || isDestroying || Boolean(project.deleted_at)
  const deleteDisabledReason = deleteDisabled
    ? project.deleted_at
      ? 'Project already archived.'
      : pendingReason
    : null

  const restoreDisabled =
    isRestoring || isDeleting || isDestroying || !project.deleted_at
  const restoreDisabledReason = restoreDisabled ? pendingReason : null

  const destroyDisabled =
    isDestroying || isDeleting || isRestoring || !project.deleted_at
  const destroyDisabledReason = destroyDisabled
    ? !project.deleted_at
      ? 'Archive the project before permanently deleting.'
      : pendingReason
    : null

  const showArchive = mode === 'active'
  const showRestore = mode === 'archive'
  const showDestroy = mode === 'archive'

  const isArchived = Boolean(project.deleted_at)

  return (
    <TableRow
      {...getClickableRowProps(() => onEdit(project))}
      className={cn(CLICKABLE_ROW_CLASS, isArchived && ARCHIVED_ROW_CLASS)}
    >
      <TableCell>
        <div className='flex min-w-0 items-center gap-2'>
          <FolderKanban className='h-4 w-4 shrink-0 text-emerald-500' />
          <span className='truncate font-medium' title={project.name}>
            {project.name}
          </span>
        </div>
      </TableCell>
      <TableCell label='Owner'>
        <div className='flex min-w-0 items-center gap-2 text-sm'>
          <ownerDisplay.Icon className='text-muted-foreground h-4 w-4 shrink-0' />
          <span className='truncate'>{ownerDisplay.label}</span>
        </div>
        {ownerDisplay.message ? (
          <p
            className={cn(
              'text-xs',
              ownerDisplay.messageTone === 'destructive'
                ? 'text-destructive'
                : 'text-muted-foreground'
            )}
          >
            {ownerDisplay.message}
          </p>
        ) : null}
      </TableCell>
      <TableCell label='Timeline' className='text-muted-foreground text-sm'>
        {formatProjectDateRange(project.starts_on, project.ends_on)}
      </TableCell>
      <TableCell className='text-right max-md:ml-auto'>
        <RecordRowActions>
          {showRestore ? (
            <RecordRowAction
              kind='restore'
              entity='project'
              onClick={() => onRestore(project)}
              disabled={restoreDisabled}
              disabledReason={restoreDisabledReason}
            />
          ) : null}
          {showArchive ? (
            <RecordRowAction
              kind='archive'
              entity='project'
              onClick={() => onRequestDelete(project)}
              disabled={deleteDisabled}
              disabledReason={deleteDisabledReason}
            />
          ) : null}
          {showDestroy ? (
            <RecordRowAction
              kind='destroy'
              entity='project'
              onClick={() => onRequestDestroy(project)}
              disabled={destroyDisabled}
              disabledReason={destroyDisabledReason}
            />
          ) : null}
        </RecordRowActions>
      </TableCell>
    </TableRow>
  )
}

type OwnerDisplay = {
  Icon: LucideIcon
  label: string
  message?: string
  messageTone?: 'muted' | 'destructive'
}

function resolveProjectOwnerDisplay(project: ProjectWithClient): OwnerDisplay {
  if (project.type === 'PERSONAL') {
    const ownerFirstName = extractOwnerFirstName(project.owner)
    return ownerFirstName
      ? {
          Icon: User,
          label: `${ownerFirstName}'s personal project`,
        }
      : {
          Icon: User,
          label: 'Personal project (owner missing)',
          message: undefined,
          messageTone: undefined,
        }
  }

  if (project.type === 'INTERNAL') {
    return { Icon: Users, label: 'Internal project' }
  }

  const client = project.client

  if (client) {
    return {
      Icon: Building2,
      label: client.name,
      message: client.deleted_at ? 'Client archived' : undefined,
      messageTone: client.deleted_at ? 'destructive' : undefined,
    }
  }

  return {
    Icon: Building2,
    label: 'Client missing',
    message: 'Reassign this project to a client.',
    messageTone: 'destructive',
  }
}

function extractOwnerFirstName(
  owner: ProjectWithClient['owner']
): string | null {
  if (!owner) {
    return null
  }

  const fullName = owner.fullName?.trim()
  if (fullName) {
    const firstName = fullName.split(/\s+/)[0]
    if (firstName) {
      return firstName
    }
  }

  const email = owner.email?.trim()
  if (email) {
    const [localPart] = email.split('@')
    if (localPart) {
      const sanitized = localPart.split(/[._-]+/)[0] ?? localPart
      if (sanitized) {
        return sanitized.charAt(0).toUpperCase() + sanitized.slice(1)
      }
    }
  }

  return null
}
