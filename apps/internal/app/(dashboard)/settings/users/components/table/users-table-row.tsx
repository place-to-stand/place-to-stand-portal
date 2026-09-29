'use client'

import { Archive, Eye, RefreshCw, Trash2 } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@pts/ui/avatar'
import { TableCell, TableRow } from '@pts/ui/table'
import { RowActionButton } from '@pts/ui/row-action-button'
import { Badge } from '@pts/ui/badge'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { Switch } from '@pts/ui/switch'
import type { UserAssignmentSummary } from '@/lib/queries/users/assignments'
import {
  USER_ROLE_BADGE_CLASSES,
  USER_ROLE_LABELS,
} from '@/lib/settings/users/filters'

import type { UserRowState } from '@/lib/settings/users/state/use-users-table-state'
import { openPortalPreview } from '@/lib/settings/contacts/portal-preview'
import { cn } from '@/lib/utils'
import { formatCalendarDate, formatRelativeTime } from '@pts/ui/dates'
import { ARCHIVED_ROW_CLASS } from '@/lib/table/archived-row'
import {
  CLICKABLE_ROW_CLASS,
  getClickableRowProps,
} from '@/lib/table/clickable-row'

import { UserAssignmentsCell } from './user-assignments-cell'

const SIGN_IN_TITLE_STYLE = {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
} as const

type UsersTableRowProps = {
  row: UserRowState
  assignment: UserAssignmentSummary | undefined
  selfDeleteReason: string
  mode: 'active' | 'archive'
  clientPortalUrl: string
}

export function UsersTableRow({
  row,
  assignment,
  selfDeleteReason,
  mode,
  clientPortalUrl,
}: UsersTableRowProps) {
  const { user } = row
  const deleteTitle =
    row.deleteDisabled && row.deleteDisabledReason === selfDeleteReason
      ? 'Cannot archive your own account'
      : 'Archive user'
  const showSoftDelete = mode === 'active'
  const showRestore = mode === 'archive'
  const showDestroy = mode === 'archive'
  // Admins have no portal of their own to preview, so the action is
  // portal-user only. It previews through the linked contact; a portal user
  // created straight from this page has none, so it stays visible but
  // explains why it's off rather than vanishing from that one row.
  const showPreview = mode === 'active' && user.role === 'CLIENT'
  const previewContactId = assignment?.contact?.id ?? null

  const displayName = user.full_name ?? user.email
  const initials = user.full_name
    ? user.full_name
        .split(' ')
        .map(segment => segment[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : user.email.slice(0, 2).toUpperCase()

  return (
    <TableRow
      {...getClickableRowProps(row.onEdit)}
      className={cn(CLICKABLE_ROW_CLASS, user.deleted_at && ARCHIVED_ROW_CLASS)}
    >
      <TableCell>
        <div className='flex min-w-0 items-center gap-2'>
          <Avatar size='sm'>
            {user.avatar_url && (
              <AvatarImage src={`/api/storage/user-avatar/${user.id}`} />
            )}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <span className='truncate font-medium'>{displayName}</span>
        </div>
      </TableCell>
      <TableCell className='text-muted-foreground truncate text-sm'>
        {user.email}
      </TableCell>
      <TableCell>
        <Badge
          variant='outline'
          className={cn('text-xs', USER_ROLE_BADGE_CLASSES[user.role])}
        >
          {USER_ROLE_LABELS[user.role]}
        </Badge>
      </TableCell>
      <TableCell>
        {mode === 'active' ? (
          <DisabledFieldTooltip
            disabled={row.accessToggleDisabled}
            reason={row.accessToggleDisabledReason}
            className='w-auto'
          >
            <div className='flex items-center gap-2'>
              <Switch
                checked={row.accessEnabled}
                onCheckedChange={row.onToggleAccess}
                disabled={row.accessToggleDisabled}
                aria-label={
                  row.accessEnabled
                    ? `Disable sign-in for ${displayName}`
                    : `Enable sign-in for ${displayName}`
                }
              />
              <span className='text-muted-foreground text-xs'>
                {row.accessEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </DisabledFieldTooltip>
        ) : (
          <span className='text-muted-foreground text-xs'>—</span>
        )}
      </TableCell>
      <TableCell>
        <UserAssignmentsCell assignment={assignment} role={user.role} />
      </TableCell>
      {/* Relative text can tick over a minute between SSR and hydration. */}
      <TableCell
        suppressHydrationWarning
        className='text-muted-foreground truncate text-sm'
        title={
          formatCalendarDate(user.last_sign_in_at, SIGN_IN_TITLE_STYLE) ??
          undefined
        }
      >
        {formatRelativeTime(user.last_sign_in_at) ?? 'Never'}
      </TableCell>
      <TableCell className='text-muted-foreground text-sm'>
        {formatCalendarDate(user.created_at)}
      </TableCell>
      <TableCell className='text-right'>
        <div className='flex justify-end gap-2'>
          {showPreview ? (
            <DisabledFieldTooltip
              disabled={!previewContactId}
              reason='No linked contact. Create a portal account from their contact to link one.'
              className='w-auto'
            >
              <RowActionButton
                variant='outline'
                label='Preview in client portal'
                icon={<Eye />}
                disabled={!previewContactId}
                onClick={event => {
                  event.stopPropagation()
                  if (previewContactId) {
                    openPortalPreview(clientPortalUrl, previewContactId)
                  }
                }}
              />
            </DisabledFieldTooltip>
          ) : null}
          {showRestore ? (
            <DisabledFieldTooltip
              disabled={row.restoreDisabled}
              reason={row.restoreDisabledReason}
            >
              <RowActionButton
                variant='outline'
                onClick={row.onRestore}
                label='Restore user'
                icon={<RefreshCw />}
                disabled={row.restoreDisabled}
              />
            </DisabledFieldTooltip>
          ) : null}
          {showSoftDelete ? (
            <DisabledFieldTooltip
              disabled={row.deleteDisabled}
              reason={row.deleteDisabledReason}
              className='w-auto'
            >
              <RowActionButton
                variant='destructive'
                onClick={row.onRequestDelete}
                label={deleteTitle}
                icon={<Archive />}
                disabled={row.deleteDisabled}
              />
            </DisabledFieldTooltip>
          ) : null}
          {showDestroy ? (
            <DisabledFieldTooltip
              disabled={row.destroyDisabled}
              reason={row.destroyDisabledReason}
              className='w-auto'
            >
              <RowActionButton
                variant='destructive'
                onClick={row.onRequestDestroy}
                label='Permanently delete user'
                icon={<Trash2 />}
                disabled={row.destroyDisabled}
              />
            </DisabledFieldTooltip>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  )
}
