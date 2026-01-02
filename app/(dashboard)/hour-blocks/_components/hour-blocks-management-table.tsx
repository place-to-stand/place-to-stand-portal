'use client'

import { useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { PaginationControls } from '@/components/ui/pagination-controls'

import type { PageInfo } from '@/lib/pagination/cursor'
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
  pageInfo: PageInfo
  mode: 'active' | 'archive'
}

const EMPTY_MESSAGES = {
  active: 'No hour blocks recorded yet. Log a retainer or client block to monitor it here.',
  archive: 'Archive is empty. Archived hour blocks appear here after deletion.',
} as const

export function HourBlocksManagementTable({
  hourBlocks,
  clients,
  pageInfo,
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
        hasNextPage={paginationState.hasNextPage}
        hasPreviousPage={paginationState.hasPreviousPage}
        onNext={() => handlePaginate('forward')}
        onPrevious={() => handlePaginate('backward')}
        disableAll={isPending}
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
