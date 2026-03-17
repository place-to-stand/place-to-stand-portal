'use client'

import { useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { PaginationControls } from '@/components/ui/pagination-controls'

import { UserSheet } from '../users-sheet'
import {
  useUsersTableState,
  type UserAssignments,
} from '@/lib/settings/users/state/use-users-table-state'
import type { UserRow } from '@/lib/settings/users/state/types'
import type { PageInfo } from '@/lib/pagination/cursor'

import { UsersTableSection } from './users-table-section'

type UsersManagementTableProps = {
  users: UserRow[]
  currentUserId: string
  assignments: UserAssignments
  pageInfo: PageInfo
  mode: 'active' | 'archive'
}

const EMPTY_MESSAGES = {
  active: 'No users found. Use the Add user button to invite someone.',
  archive: 'No archived users. Archived accounts appear here once deleted.',
} as const

export function UsersManagementTable({
  users,
  currentUserId,
  assignments,
  pageInfo,
  mode,
}: UsersManagementTableProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const {
    rows,
    sheet,
    deleteDialog,
    destroyDialog,
    selfDeleteReason,
    isPending,
  } = useUsersTableState({ users, currentUserId, assignments })

  const filteredRows = useMemo(
    () =>
      mode === 'active'
        ? rows.filter(row => !row.user.deleted_at)
        : rows.filter(row => Boolean(row.user.deleted_at)),
    [rows, mode]
  )

  const emptyMessage = EMPTY_MESSAGES[mode]

  const handlePaginate = (direction: 'forward' | 'backward') => {
    const cursor =
      direction === 'forward' ? pageInfo.endCursor : pageInfo.startCursor

    if (!cursor) {
      return
    }

    const params = new URLSearchParams(searchParams.toString())
    params.set('cursor', cursor)
    params.set('dir', direction)
    const query = params.toString()
    router.push(query ? `${pathname}?${query}` : pathname)
  }

  const paginationState = useMemo(
    () => ({
      hasNextPage: pageInfo.hasNextPage,
      hasPreviousPage: pageInfo.hasPreviousPage,
    }),
    [pageInfo.hasNextPage, pageInfo.hasPreviousPage]
  )

  return (
    <div className='space-y-6'>
      <ConfirmDialog
        open={deleteDialog.open}
        title='Archive user?'
        description={deleteDialog.description}
        confirmLabel='Archive'
        confirmVariant='destructive'
        confirmDisabled={deleteDialog.confirmDisabled}
        onCancel={deleteDialog.onCancel}
        onConfirm={deleteDialog.onConfirm}
      />
      <ConfirmDialog
        open={destroyDialog.open}
        title='Permanently delete user?'
        description={destroyDialog.description}
        confirmLabel='Delete forever'
        confirmVariant='destructive'
        confirmDisabled={destroyDialog.confirmDisabled}
        onCancel={destroyDialog.onCancel}
        onConfirm={destroyDialog.onConfirm}
      />
      <UsersTableSection
        rows={filteredRows}
        mode={mode}
        emptyMessage={emptyMessage}
        selfDeleteReason={selfDeleteReason}
      />
      <PaginationControls
        hasNextPage={paginationState.hasNextPage}
        hasPreviousPage={paginationState.hasPreviousPage}
        onNext={() => handlePaginate('forward')}
        onPrevious={() => handlePaginate('backward')}
        disableAll={isPending}
      />
      <UserSheet
        open={sheet.open}
        onOpenChange={sheet.onOpenChange}
        onComplete={sheet.onComplete}
        user={sheet.selectedUser}
        currentUserId={currentUserId}
        assignments={assignments}
      />
    </div>
  )
}
