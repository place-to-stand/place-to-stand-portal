'use client'

import { useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { PaginationControls } from '@/components/ui/pagination-controls'

import type { PageInfo } from '@/lib/pagination/cursor'
import {
  type ContactsTableContact,
  useContactsTableState,
} from '@/lib/settings/contacts/use-contacts-table-state'
import type { ClientOption } from '@/lib/queries/contacts'

import { ContactsTableSection } from './contacts-table-section'
import { ContactsSheet } from './contacts-sheet'

type ContactsManagementTableProps = {
  contacts: ContactsTableContact[]
  pageInfo: PageInfo
  mode: 'active' | 'archive'
  allClients?: ClientOption[]
}

const EMPTY_MESSAGES = {
  active: 'No contacts yet. Add one to begin organizing client contacts.',
  archive: 'No archived contacts. Archived contacts appear here once deleted.',
} as const

export function ContactsManagementTable({
  contacts,
  pageInfo,
  mode,
  allClients = [],
}: ContactsManagementTableProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const {
    sheetOpen,
    selectedContact,
    deleteTarget,
    destroyTarget,
    isPending,
    pendingReason,
    pendingDeleteId,
    pendingRestoreId,
    pendingDestroyId,
    openEdit,
    handleSheetOpenChange,
    handleSheetComplete,
    handleRequestDelete,
    handleCancelDelete,
    handleConfirmDelete,
    handleRestore,
    handleRequestDestroy,
    handleCancelDestroy,
    handleConfirmDestroy,
  } = useContactsTableState()

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
        open={Boolean(deleteTarget)}
        title='Archive contact?'
        description={
          deleteTarget
            ? `Archiving ${deleteTarget.name || deleteTarget.email} hides it from active views but preserves the record.`
            : 'Archiving this contact hides it from active views but preserves the record.'
        }
        confirmLabel='Archive'
        confirmVariant='destructive'
        confirmDisabled={isPending}
        onCancel={handleCancelDelete}
        onConfirm={handleConfirmDelete}
      />
      <ConfirmDialog
        open={Boolean(destroyTarget)}
        title='Permanently delete contact?'
        description={
          destroyTarget
            ? `Permanently deleting ${destroyTarget.name || destroyTarget.email} removes this contact. This action cannot be undone.`
            : 'Permanently deleting this contact removes it. This action cannot be undone.'
        }
        confirmLabel='Delete forever'
        confirmVariant='destructive'
        confirmDisabled={isPending}
        onCancel={handleCancelDestroy}
        onConfirm={handleConfirmDestroy}
      />
      <ContactsTableSection
        contacts={contacts}
        mode={mode === 'archive' ? 'archive' : 'active'}
        onEdit={openEdit}
        onRequestDelete={handleRequestDelete}
        onRestore={handleRestore}
        onRequestDestroy={handleRequestDestroy}
        isPending={isPending}
        pendingReason={pendingReason}
        pendingDeleteId={pendingDeleteId}
        pendingRestoreId={pendingRestoreId}
        pendingDestroyId={pendingDestroyId}
        emptyMessage={emptyMessage}
      />
      <PaginationControls
        hasNextPage={paginationState.hasNextPage}
        hasPreviousPage={paginationState.hasPreviousPage}
        onNext={() => handlePaginate('forward')}
        onPrevious={() => handlePaginate('backward')}
        disableAll={isPending}
      />
      <ContactsSheet
        open={sheetOpen}
        onOpenChange={handleSheetOpenChange}
        onComplete={handleSheetComplete}
        contact={selectedContact}
        allClients={allClients}
      />
    </div>
  )
}
