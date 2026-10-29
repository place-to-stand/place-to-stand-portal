'use client'

import { TableCell, TableRow } from '@pts/ui/table'
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

import {
  RecordRowAction,
  RecordRowActions,
} from '@/components/table/record-row-action'
import { EmptyValue } from '@/components/table/empty-value'
import { UserAssignmentsCell } from './user-assignments-cell'
import { UserAvatar } from '@/components/ui/user-avatar'

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
  mode: 'active' | 'archive'
  clientPortalUrl: string
}

export function UsersTableRow({
  row,
  assignment,
  mode,
  clientPortalUrl,
}: UsersTableRowProps) {
  const { user } = row
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
  return (
    <TableRow
      {...getClickableRowProps(row.onEdit)}
      className={cn(CLICKABLE_ROW_CLASS, user.deleted_at && ARCHIVED_ROW_CLASS)}
    >
      <TableCell>
        <div className='flex min-w-0 items-center gap-2'>
          <UserAvatar
            userId={user.id}
            name={displayName}
            hasPhoto={Boolean(user.avatar_url)}
            alt=''
          />
          <span className='truncate font-medium' title={displayName}>
            {displayName}
          </span>
        </div>
      </TableCell>
      <TableCell
        className='text-muted-foreground truncate text-sm'
        title={user.email}
      >
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
      <TableCell label='Access'>
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
          <EmptyValue />
        )}
      </TableCell>
      <TableCell label='Clients'>
        <UserAssignmentsCell assignment={assignment} role={user.role} />
      </TableCell>
      {/* Relative text can tick over a minute between SSR and hydration. */}
      <TableCell
        label='Last sign-in'
        suppressHydrationWarning
        className='text-muted-foreground truncate text-sm'
        title={
          formatCalendarDate(user.last_sign_in_at, SIGN_IN_TITLE_STYLE) ??
          undefined
        }
      >
        {formatRelativeTime(user.last_sign_in_at) ?? 'Never'}
      </TableCell>
      <TableCell label='Joined' className='text-muted-foreground text-sm'>
        {formatCalendarDate(user.created_at)}
      </TableCell>
      <TableCell className='text-right max-md:ml-auto'>
        <RecordRowActions>
          {showPreview ? (
            <RecordRowAction
              kind='preview'
              disabled={!previewContactId}
              disabledReason='No linked contact. Create a portal user from their contact to link one.'
              onClick={() => {
                if (previewContactId) {
                  openPortalPreview(clientPortalUrl, previewContactId)
                }
              }}
            />
          ) : null}
          {showRestore ? (
            <RecordRowAction
              kind='restore'
              entity='user'
              onClick={row.onRestore}
              disabled={row.restoreDisabled}
              disabledReason={row.restoreDisabledReason}
            />
          ) : null}
          {showSoftDelete ? (
            <RecordRowAction
              kind='archive'
              entity='user'
              onClick={row.onRequestDelete}
              disabled={row.deleteDisabled}
              disabledReason={row.deleteDisabledReason}
            />
          ) : null}
          {showDestroy ? (
            <RecordRowAction
              kind='destroy'
              entity='user'
              onClick={row.onRequestDestroy}
              disabled={row.destroyDisabled}
              disabledReason={row.destroyDisabledReason}
            />
          ) : null}
        </RecordRowActions>
      </TableCell>
    </TableRow>
  )
}
