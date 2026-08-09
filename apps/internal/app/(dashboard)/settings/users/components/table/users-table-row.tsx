'use client'

import { format } from 'date-fns'
import { Archive, Pencil, RefreshCw, Trash2 } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@pts/ui/avatar'
import { TableCell, TableRow } from '@pts/ui/table'
import { Button } from '@pts/ui/button'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { Switch } from '@pts/ui/switch'
import { USER_ROLE_LABELS } from '@/lib/settings/users/filters'

import type { UserRowState } from '@/lib/settings/users/state/use-users-table-state'
import { ARCHIVED_ROW_CLASS } from '@/lib/table/archived-row'

type UsersTableRowProps = {
  row: UserRowState
  selfDeleteReason: string
  mode: 'active' | 'archive'
}

export function UsersTableRow({
  row,
  selfDeleteReason,
  mode,
}: UsersTableRowProps) {
  const { user } = row
  const deleteTitle =
    row.deleteDisabled && row.deleteDisabledReason === selfDeleteReason
      ? 'Cannot archive your own account'
      : 'Archive user'
  const showEdit = mode === 'active'
  const showSoftDelete = mode === 'active'
  const showRestore = mode === 'archive'
  const showDestroy = mode === 'archive'

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
    <TableRow className={user.deleted_at ? ARCHIVED_ROW_CLASS : undefined}>
      <TableCell>
        <div className='flex items-center gap-2'>
          <Avatar className='h-6 w-6'>
            {user.avatar_url && (
              <AvatarImage src={`/api/storage/user-avatar/${user.id}`} />
            )}
            <AvatarFallback className='text-[10px]'>{initials}</AvatarFallback>
          </Avatar>
          <span className='font-medium'>{displayName}</span>
        </div>
      </TableCell>
      <TableCell className='text-muted-foreground text-sm'>
        {user.email}
      </TableCell>
      <TableCell className='text-sm'>{USER_ROLE_LABELS[user.role]}</TableCell>
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
                className='data-[state=checked]:bg-emerald-500 dark:data-[state=checked]:bg-emerald-500'
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
      <TableCell className='text-muted-foreground text-sm'>
        {format(new Date(user.created_at), 'MMM d, yyyy')}
      </TableCell>
      <TableCell className='text-right'>
        <div className='flex justify-end gap-2'>
          {showEdit ? (
            <DisabledFieldTooltip
              disabled={row.editDisabled}
              reason={row.editDisabledReason}
            >
              <Button
                variant='outline'
                size='icon-sm'
                onClick={row.onEdit}
                title='Edit user'
                disabled={row.editDisabled}
              >
                <Pencil className='h-4 w-4' />
              </Button>
            </DisabledFieldTooltip>
          ) : null}
          {showRestore ? (
            <DisabledFieldTooltip
              disabled={row.restoreDisabled}
              reason={row.restoreDisabledReason}
            >
              <Button
                variant='secondary'
                size='icon-sm'
                onClick={row.onRestore}
                title='Restore user'
                aria-label='Restore user'
                disabled={row.restoreDisabled}
              >
                <RefreshCw className='h-4 w-4' />
                <span className='sr-only'>Restore</span>
              </Button>
            </DisabledFieldTooltip>
          ) : null}
          {showSoftDelete ? (
            <DisabledFieldTooltip
              disabled={row.deleteDisabled}
              reason={row.deleteDisabledReason}
              className='w-auto'
            >
              <Button
                variant='destructive'
                size='icon-sm'
                onClick={row.onRequestDelete}
                title={deleteTitle}
                aria-label='Archive user'
                disabled={row.deleteDisabled}
              >
                <Archive className='h-4 w-4' />
                <span className='sr-only'>Archive</span>
              </Button>
            </DisabledFieldTooltip>
          ) : null}
          {showDestroy ? (
            <DisabledFieldTooltip
              disabled={row.destroyDisabled}
              reason={row.destroyDisabledReason}
              className='w-auto'
            >
              <Button
                variant='destructive'
                size='icon-sm'
                onClick={row.onRequestDestroy}
                title='Permanently delete user'
                aria-label='Permanently delete user'
                disabled={row.destroyDisabled}
              >
                <Trash2 className='h-4 w-4' />
                <span className='sr-only'>Delete permanently</span>
              </Button>
            </DisabledFieldTooltip>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  )
}
