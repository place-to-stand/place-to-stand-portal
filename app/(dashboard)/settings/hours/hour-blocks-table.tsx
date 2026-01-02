'use client'

import dynamic from 'next/dynamic'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type {
  ClientRow,
  HourBlockWithClient,
} from '@/lib/settings/hour-blocks/hour-block-form'
import { useHourBlocksTableState } from '@/lib/settings/hour-blocks/use-hour-blocks-table-state'
import type { PageInfo } from '@/lib/pagination/cursor'
import type { TimeLogsAdminResult } from '@/lib/queries/time-logs/admin'

import { HourBlockArchiveDialog } from './_components/hour-block-archive-dialog'
import { HourBlocksTableSection } from './_components/hour-blocks-table-section'
import { HoursLoggedTableSection } from './_components/hours-logged-table-section'
import { HourBlockSheet } from './hour-block-sheet'

type HoursTab = 'hour-blocks' | 'hours-logged' | 'archive' | 'activity'

type Props = {
  hourBlocks: HourBlockWithClient[]
  clients: ClientRow[]
  tab: HoursTab
  pageInfo: PageInfo
  totalCount: number
  hoursLoggedData: TimeLogsAdminResult | null
  sortBy: 'user' | 'project' | 'date' | 'hours'
  sortDir: 'asc' | 'desc'
}

const HourBlocksActivityFeed = dynamic(
  () =>
    import('@/components/activity/activity-feed').then(
      module => module.ActivityFeed
    ),
  {
    ssr: false,
    loading: () => (
      <div className='text-muted-foreground text-sm'>
        Loading recent activity…
      </div>
    ),
  }
)

export function HourBlocksSettingsTable({
  hourBlocks,
  clients,
  tab,
  pageInfo,
  totalCount,
  hoursLoggedData,
  sortBy,
  sortDir,
}: Props) {
  const {
    sheetOpen,
    selectedBlock,
    sortedClients,
    createDisabled,
    createDisabledReason,
    pendingReason,
    openCreate,
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
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const showListViews = tab !== 'activity'

  const handleTabSelect = (value: HoursTab) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value === 'hour-blocks') {
      params.delete('tab')
    } else {
      params.set('tab', value)
    }
    params.delete('cursor')
    params.delete('dir')
    params.delete('sortBy')
    params.delete('sortDir')
    const query = params.toString()
    router.push(query ? `${pathname}?${query}` : pathname)
  }

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

  const handleHoursLoggedSort = (
    column: 'user' | 'project' | 'date' | 'hours',
  ) => {
    const params = new URLSearchParams(searchParams.toString())

    // Toggle direction if same column, otherwise use default
    if (sortBy === column) {
      const newDir = sortDir === 'asc' ? 'desc' : 'asc'
      params.set('sortDir', newDir)
    } else {
      params.set('sortBy', column)
      params.set(
        'sortDir',
        column === 'date' || column === 'hours' ? 'desc' : 'asc',
      )
    }

    // Reset pagination when sorting changes
    params.delete('cursor')
    params.delete('dir')

    const query = params.toString()
    router.push(query ? `${pathname}?${query}` : pathname)
  }

  const handleHoursLoggedPaginate = (direction: 'forward' | 'backward') => {
    if (!hoursLoggedData) {
      return
    }

    const cursor =
      direction === 'forward'
        ? hoursLoggedData.pageInfo.endCursor
        : hoursLoggedData.pageInfo.startCursor

    if (!cursor) {
      return
    }

    const params = new URLSearchParams(searchParams.toString())
    params.set('cursor', cursor)
    params.set('dir', direction)
    const query = params.toString()
    router.push(query ? `${pathname}?${query}` : pathname)
  }

  const paginationDisabled = !showListViews
  const hasNextPage = pageInfo.hasNextPage && !paginationDisabled
  const hasPreviousPage = pageInfo.hasPreviousPage && !paginationDisabled

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
      <Tabs
        value={tab}
        onValueChange={value => handleTabSelect(value as HoursTab)}
        className='space-y-6'
      >
        <div className='flex flex-wrap items-center gap-4'>
          <TabsList>
            <TabsTrigger value='hour-blocks'>Hour Blocks</TabsTrigger>
            <TabsTrigger value='hours-logged'>Hours Logged</TabsTrigger>
            <TabsTrigger value='archive'>Archive</TabsTrigger>
            <TabsTrigger value='activity'>Activity</TabsTrigger>
          </TabsList>
          {tab === 'hour-blocks' ? (
            <DisabledFieldTooltip
              disabled={createDisabled}
              reason={createDisabledReason}
            >
              <Button
                onClick={openCreate}
                disabled={createDisabled}
                className='ml-auto'
              >
                <Plus className='h-4 w-4' /> Add hour block
              </Button>
            </DisabledFieldTooltip>
          ) : null}
        </div>
        <TabsContent value='hour-blocks' className='space-y-6'>
          {tab === 'hour-blocks' ? (
            <>
              <HourBlocksTableSection
                hourBlocks={hourBlocks}
                mode='active'
                onEdit={openEdit}
                onRequestDelete={handleRequestDelete}
                onRestore={handleRestore}
                onRequestDestroy={handleRequestDestroy}
                isPending={isPending}
                pendingReason={pendingReason}
                pendingDeleteId={pendingDeleteId}
                pendingRestoreId={pendingRestoreId}
                pendingDestroyId={pendingDestroyId}
                emptyMessage='No hour blocks recorded yet. Log a retainer or client block to monitor it here.'
              />
              <PaginationControls
                hasNextPage={hasNextPage}
                hasPreviousPage={hasPreviousPage}
                onNext={() => handlePaginate('forward')}
                onPrevious={() => handlePaginate('backward')}
                disableAll={isPending}
              />
            </>
          ) : null}
        </TabsContent>
        <TabsContent value='hours-logged' className='space-y-6'>
          {tab === 'hours-logged' && hoursLoggedData ? (
            <HoursLoggedTableSection
              timeLogs={hoursLoggedData.items}
              pageInfo={hoursLoggedData.pageInfo}
              totalCount={hoursLoggedData.totalCount}
              sortBy={sortBy}
              sortDir={sortDir}
              onSort={handleHoursLoggedSort}
              onPaginate={handleHoursLoggedPaginate}
            />
          ) : null}
        </TabsContent>
        <TabsContent value='archive' className='space-y-6'>
          {tab === 'archive' ? (
            <>
              <HourBlocksTableSection
                hourBlocks={hourBlocks}
                mode='archive'
                onEdit={openEdit}
                onRequestDelete={handleRequestDelete}
                onRestore={handleRestore}
                onRequestDestroy={handleRequestDestroy}
                isPending={isPending}
                pendingReason={pendingReason}
                pendingDeleteId={pendingDeleteId}
                pendingRestoreId={pendingRestoreId}
                pendingDestroyId={pendingDestroyId}
                emptyMessage='Archive is empty. Archived hour blocks appear here after deletion.'
              />
              <PaginationControls
                hasNextPage={hasNextPage}
                hasPreviousPage={hasPreviousPage}
                onNext={() => handlePaginate('forward')}
                onPrevious={() => handlePaginate('backward')}
                disableAll={isPending}
              />
            </>
          ) : null}
        </TabsContent>
        <TabsContent value='activity' className='space-y-3'>
          <div className='space-y-3 p-1'>
            <div>
              <h3 className='text-lg font-semibold'>Recent activity</h3>
              <p className='text-muted-foreground text-sm'>
                Audit hour block creation, edits, archives, and deletions in one
                place.
              </p>
            </div>
            <HourBlocksActivityFeed
              targetType='HOUR_BLOCK'
              pageSize={20}
              emptyState='No recent hour block activity.'
              requireContext={false}
            />
          </div>
        </TabsContent>
      </Tabs>
      {showListViews ? (
        <div className='flex w-full justify-end'>
          <span className='text-muted-foreground text-right text-sm'>
            Total hour blocks: {totalCount}
          </span>
        </div>
      ) : null}
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

type PaginationControlsProps = {
  hasNextPage: boolean
  hasPreviousPage: boolean
  onNext: () => void
  onPrevious: () => void
  disableAll?: boolean
}

function PaginationControls({
  hasNextPage,
  hasPreviousPage,
  onNext,
  onPrevious,
  disableAll = false,
}: PaginationControlsProps) {
  const isPrevDisabled = disableAll || !hasPreviousPage
  const isNextDisabled = disableAll || !hasNextPage

  if (!hasNextPage && !hasPreviousPage) {
    return null
  }

  return (
    <div className='flex justify-end gap-2'>
      <Button
        type='button'
        variant='outline'
        onClick={onPrevious}
        disabled={isPrevDisabled}
      >
        Previous
      </Button>
      <Button type='button' onClick={onNext} disabled={isNextDisabled}>
        Next
      </Button>
    </div>
  )
}
