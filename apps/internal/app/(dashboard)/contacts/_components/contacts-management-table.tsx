'use client'

import { useCallback } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { PaginationControls } from '@/components/ui/pagination-controls'

import {
  type ContactsTableContact,
  useContactsTableState,
} from '@/lib/settings/contacts/use-contacts-table-state'
import type { ClientOption } from '@/lib/queries/contacts'

import { ContactsTableSection } from './contacts-table-section'
import { ContactsSheet } from './contacts-sheet'

type ContactsManagementTableProps = {
  contacts: ContactsTableContact[]
  totalCount: number
  currentPage: number
  totalPages: number
  pageSize: number
  mode: 'active' | 'archive'
  allClients?: ClientOption[]
}

const EMPTY_MESSAGES = {
  active: 'No contacts yet. Add one to begin organizing client contacts.',
  archive: 'No archived contacts. Archived contacts appear here once deleted.',
} as const

export function ContactsManagementTable({
  contacts,
  totalCount,
  currentPage,
  totalPages,
  pageSize,
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

  const handlePageChange = useCallback(
    (page: number) => {
      const params = new URLSearchParams(searchParams.toString())
      if (page <= 1) {
        params.delete('page')
      } else {
        params.set('page', String(page))
      }
      const query = params.toString()
      router.push(query ? `${pathname}?${query}` : pathname)
    },
    [pathname, router, searchParams]
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
        mode='paged'
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={totalCount}
        pageSize={pageSize}
        onPageChange={handlePageChange}
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
