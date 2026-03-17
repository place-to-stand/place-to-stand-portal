'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'

import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { PaginationControls } from '@/components/ui/pagination-controls'

import type {
  ClientRow,
  HourBlockWithClient,
} from '@/lib/settings/hour-blocks/hour-block-form'
import { useHourBlocksTableState } from '@/lib/settings/hour-blocks/use-hour-blocks-table-state'

import { HourBlockArchiveDialog } from './hour-block-archive-dialog'
import { HourBlocksTableSection } from './hour-blocks-table-section'
import { HourBlockSheet } from '../hour-block-sheet'

type HourBlocksManagementTableProps = {
  hourBlocks: HourBlockWithClient[]
  clients: ClientRow[]
  totalCount: number
  currentPage: number
  totalPages: number
  pageSize: number
  mode: 'active' | 'archive'
}

const EMPTY_MESSAGES = {
  active: 'No hour blocks recorded yet. Log a retainer or client block to monitor it here.',
  archive: 'Archive is empty. Archived hour blocks appear here after deletion.',
} as const

export function HourBlocksManagementTable({
  hourBlocks,
  clients,
  totalCount,
  currentPage,
  totalPages,
  pageSize,
  mode,
}: HourBlocksManagementTableProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const {
    sheetOpen,
    selectedBlock,
    sortedClients,
    pendingReason,
    openEdit,
    handleSheetOpenChange,
    handleComplete,
    deleteDialog,
    destroyDialog,
    isPending,
    pendingDeleteId,
    pendingRestoreId,
    pendingDestroyId,
    handleRequestDelete,
    handleRestore,
    handleRequestDestroy,
  } = useHourBlocksTableState({ clients })

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
      <HourBlockArchiveDialog
        open={deleteDialog.open}
        confirmDisabled={isPending}
        onCancel={deleteDialog.onCancel}
        onConfirm={deleteDialog.onConfirm}
      />
      <ConfirmDialog
        open={destroyDialog.open}
        title='Permanently delete hour block?'
        description='This action removes the hour block forever. Make sure no other records depend on it.'
        confirmLabel='Delete forever'
        confirmVariant='destructive'
        confirmDisabled={isPending}
        onCancel={destroyDialog.onCancel}
        onConfirm={destroyDialog.onConfirm}
      />
      <HourBlocksTableSection
        hourBlocks={hourBlocks}
        mode={mode}
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
      <HourBlockSheet
        open={sheetOpen}
        onOpenChange={handleSheetOpenChange}
        onComplete={handleComplete}
        hourBlock={selectedBlock}
        clients={sortedClients}
      />
    </div>
  )
}
