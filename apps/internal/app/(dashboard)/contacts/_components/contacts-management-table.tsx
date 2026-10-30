'use client'

import { useCallback, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { DeepLinkNotFoundNotice } from '@/components/table/deep-link-not-found'
import { ConfirmDialog } from '@pts/ui/confirm-dialog'
import { PaginationControls } from '@/components/ui/pagination-controls'

import {
  type ContactsTableContact,
  useContactsTableState,
} from '@/lib/settings/contacts/use-contacts-table-state'
import type { ContactSheetInput } from '@/lib/settings/contacts/use-contact-sheet-state'
import { openPortalPreview } from '@/lib/settings/contacts/portal-preview'

import { useCreatePortalUser } from '@/lib/settings/contacts/use-create-portal-user'
import { ContactsTableSection } from './contacts-table-section'
import { ContactsSheet } from './contacts-sheet'
import { PromoteToUserDialog } from './contact-sheet/promote-to-user-dialog'

type ContactsManagementTableProps = {
  contacts: ContactsTableContact[]
  totalCount: number
  currentPage: number
  totalPages: number
  pageSize: number
  mode: 'active' | 'archive'
  /** Route the sort/filter params live on (PRD 004 §03). */
  basePath: string
  /**
   * Contact resolved server-side from the `?contact=` share link. May not be
   * in `contacts` when it sits on another page or is filtered out.
   */
  deepLinkedContact?: ContactSheetInput | null
  /** True when `?contact=` points at a contact that no longer exists. */
  contactNotFound?: boolean
  /** Base URL of the client portal (e.g. https://clients.placetostandagency.com). */
  clientPortalUrl?: string
}

const EMPTY_MESSAGES = {
  active: 'No contacts yet.',
  archive: 'No archived contacts.',
} as const

export function ContactsManagementTable({
  contacts,
  totalCount,
  currentPage,
  totalPages,
  pageSize,
  mode,
  basePath,
  deepLinkedContact = null,
  contactNotFound = false,
  clientPortalUrl = '',
}: ContactsManagementTableProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [promoteTarget, setPromoteTarget] =
    useState<ContactsTableContact | null>(null)
  const { createPortalUser, isPending: isPromotePending } =
    useCreatePortalUser()

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
    clearSelection,
    handleSheetOpenChange,
    handleSheetComplete,
    handleRequestDelete,
    handleCancelDelete,
    handleConfirmDelete,
    handleRestore,
    handleRequestDestroy,
    handleCancelDestroy,
    handleConfirmDestroy,
  } = useContactsTableState({ contacts, deepLinkedContact })

  // Guard-validated active search (R4): an empty list under a live `?q=`
  // shows the filtered message, not the tab's default empty state.
  const hasActiveFilter = Boolean(searchParams.get('q')?.trim())
  const emptyMessage = hasActiveFilter
    ? 'No contacts match the current filters.'
    : EMPTY_MESSAGES[mode]

  const handleRequestPreview = useCallback(
    (contact: ContactsTableContact) =>
      openPortalPreview(clientPortalUrl, contact.id),
    [clientPortalUrl]
  )

  const handleRequestPromote = useCallback(
    (contact: ContactsTableContact) => {
      if (isPending || isPromotePending) return
      setPromoteTarget(contact)
    },
    [isPending, isPromotePending]
  )

  const handleConfirmPromote = useCallback(() => {
    if (!promoteTarget) return

    const contact = promoteTarget
    setPromoteTarget(null)

    createPortalUser(contact, { onSuccess: () => router.refresh() })
  }, [promoteTarget, createPortalUser, router])

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
    <div className='space-y-4'>
      {contactNotFound ? (
        <DeepLinkNotFoundNotice entity='contact' onDismiss={clearSelection} />
      ) : null}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title='Archive contact?'
        description={
          deleteTarget
            ? `Archiving ${deleteTarget.name || deleteTarget.email} hides it from active views but keeps the contact.`
            : 'Archiving this contact hides it from active views but keeps the contact.'
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
        basePath={basePath}
        mode={mode === 'archive' ? 'archive' : 'active'}
        onEdit={openEdit}
        onRequestDelete={handleRequestDelete}
        onRestore={handleRestore}
        onRequestDestroy={handleRequestDestroy}
        onRequestPromote={handleRequestPromote}
        onRequestPreview={handleRequestPreview}
        isPending={isPending || isPromotePending}
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
      <PromoteToUserDialog
        open={Boolean(promoteTarget)}
        onOpenChange={open => {
          if (!open) setPromoteTarget(null)
        }}
        contactName={promoteTarget?.name || promoteTarget?.email || ''}
        contactEmail={promoteTarget?.email || ''}
        isPending={isPromotePending}
        onConfirm={handleConfirmPromote}
      />
      <ContactsSheet
        open={sheetOpen}
        onOpenChange={handleSheetOpenChange}
        onComplete={handleSheetComplete}
        contact={selectedContact}
      />
    </div>
  )
}
