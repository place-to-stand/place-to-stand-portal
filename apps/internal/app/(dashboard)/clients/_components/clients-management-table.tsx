'use client'

import { useCallback } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { ConfirmDialog } from '@pts/ui/confirm-dialog'
import { DeepLinkNotFoundNotice } from '@/components/table/deep-link-not-found'
import { PaginationControls } from '@/components/ui/pagination-controls'

import type { ClientRow } from '@/lib/settings/clients/client-sheet-utils'
import { isClientBilling } from '@/lib/settings/clients/filters'
import {
  type ClientsTableClient,
  useClientsTableState,
} from '@/lib/settings/clients/use-clients-table-state'

import { ClientsTableSection } from './clients-table-section'
import { ClientSheet } from './clients-sheet'

type ClientsManagementTableProps = {
  clients: ClientsTableClient[]
  totalCount: number
  currentPage: number
  totalPages: number
  pageSize: number
  mode: 'active' | 'archive'
  /** Route the sort/filter params live on (PRD 004 §03). */
  basePath: string
  /**
   * Client resolved server-side from the `?client=` share link. May not be
   * in `clients` when it sits on another page or is filtered out.
   */
  deepLinkedClient?: ClientRow | null
  /** True when `?client=` points at a client that no longer exists. */
  clientNotFound?: boolean
}

const EMPTY_MESSAGES = {
  active: 'No clients yet.',
  archive: 'No archived clients.',
} as const

export function ClientsManagementTable({
  clients,
  totalCount,
  currentPage,
  totalPages,
  pageSize,
  mode,
  basePath,
  deepLinkedClient = null,
  clientNotFound = false,
}: ClientsManagementTableProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const {
    sheetOpen,
    selectedClient,
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
  } = useClientsTableState({ clients, deepLinkedClient })

  // Guard-validated active filters (R4): an empty list under a live `?q=` or
  // `?billing=` shows the filtered message, not the tab's default empty state.
  const hasActiveFilter =
    Boolean(searchParams.get('q')?.trim()) ||
    isClientBilling(searchParams.get('billing') ?? undefined)
  const emptyMessage = hasActiveFilter
    ? 'No clients match the current filters.'
    : EMPTY_MESSAGES[mode]

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
      {clientNotFound ? (
        <DeepLinkNotFoundNotice entity='client' onDismiss={clearSelection} />
      ) : null}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title='Archive client?'
        description={
          deleteTarget
            ? `Archiving ${deleteTarget.name} hides it from selectors and reporting. Existing projects stay linked.`
            : 'Archiving this client hides it from selectors and reporting. Existing projects stay linked.'
        }
        confirmLabel='Archive'
        confirmVariant='destructive'
        confirmDisabled={isPending}
        onCancel={handleCancelDelete}
        onConfirm={handleConfirmDelete}
      />
      <ConfirmDialog
        open={Boolean(destroyTarget)}
        title='Permanently delete client?'
        description={
          destroyTarget
            ? `Permanently deleting ${destroyTarget.name} removes this client and its memberships. This action cannot be undone.`
            : 'Permanently deleting this client removes it and its memberships. This action cannot be undone.'
        }
        confirmLabel='Delete forever'
        confirmVariant='destructive'
        confirmDisabled={isPending}
        onCancel={handleCancelDestroy}
        onConfirm={handleConfirmDestroy}
      />
      <ClientsTableSection
        clients={clients}
        basePath={basePath}
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
      <ClientSheet
        open={sheetOpen}
        onOpenChange={handleSheetOpenChange}
        onComplete={handleSheetComplete}
        client={selectedClient}
      />
    </div>
  )
}
