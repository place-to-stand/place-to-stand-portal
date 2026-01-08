'use client'

import { useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { PaginationControls } from '@/components/ui/pagination-controls'
import { useToast } from '@/components/ui/use-toast'
import type { PageInfo } from '@/lib/pagination/cursor'
import type {
  ClientRow,
  ProjectWithClient,
} from '@/lib/settings/projects/project-sheet-form'
import { sortClientsByName } from '@/lib/settings/projects/project-sheet-form'

import { ProjectSheet } from '@/app/(dashboard)/settings/projects/project-sheet'
import { ProjectLifecycleDialogs } from '@/components/settings/projects/table/project-lifecycle-dialogs'
import { ProjectsTableSection } from '@/components/settings/projects/table/projects-table-section'
import {
  type ContractorUserSummary,
  type ProjectsTab,
} from '@/components/settings/projects/table/types'
import { useProjectsSettingsController } from '@/components/settings/projects/table/use-projects-settings-controller'

import { ProjectsTabsNav } from './projects-tabs-nav'

type ProjectsManagementSectionProps = {
  tab: ProjectsTab
  mode: 'active' | 'archive'
  projects: ProjectWithClient[]
  clients: ClientRow[]
  contractorUsers: ContractorUserSummary[]
  membersByProject: Record<string, ContractorUserSummary[]>
  pageInfo: PageInfo
  listTotalCount: number
}

export function ProjectsManagementSection({
  tab,
  mode,
  projects,
  clients,
  contractorUsers,
  membersByProject,
  pageInfo,
  listTotalCount,
}: ProjectsManagementSectionProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const sortedClients = useMemo(() => sortClientsByName(clients), [clients])

  const controller = useProjectsSettingsController({
    toast,
    onRefresh: () => router.refresh(),
  })

  const {
    sheetOpen,
    selectedProject,
    deleteTarget,
    destroyTarget,
    pendingDeleteId,
    pendingRestoreId,
    pendingDestroyId,
    isPending,
    openCreate,
    openEdit,
    handleSheetOpenChange,
    handleSheetComplete,
    requestDelete,
    cancelDelete,
    confirmDelete,
    restoreProject,
    requestDestroy,
    cancelDestroy,
    confirmDestroy,
  } = controller

  const createDisabled = sortedClients.length === 0
  const createDisabledReason = createDisabled
    ? 'Add a client before creating a project.'
    : null
  const pendingReason = 'Please wait for the current request to finish.'

  const handlePaginate = (direction: 'forward' | 'backward') => {
    const cursorValue =
      direction === 'forward' ? pageInfo.endCursor : pageInfo.startCursor

    if (!cursorValue) {
      return
    }

    const params = new URLSearchParams(searchParams.toString())
    params.set('cursor', cursorValue)
    params.set('dir', direction)
    const query = params.toString()
    router.push(query ? `${pathname}?${query}` : pathname)
  }

  const hasNextPage = pageInfo.hasNextPage
  const hasPreviousPage = pageInfo.hasPreviousPage

  const emptyMessage =
    mode === 'active'
      ? 'No projects yet. Create one to begin tracking work.'
      : 'No archived projects. Archived projects appear here after deletion.'

  return (
    <div className='space-y-4'>
      {/* Tabs Row - Above the main container */}
      <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
        <ProjectsTabsNav activeTab={tab} className='flex-1 sm:flex-none' />
        <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-6'>
          <span className='text-muted-foreground text-sm whitespace-nowrap'>
            Total projects: {listTotalCount}
          </span>
          <DisabledFieldTooltip
            disabled={createDisabled}
            reason={createDisabledReason}
          >
            <Button
              type='button'
              size='sm'
              onClick={openCreate}
              disabled={createDisabled}
              className='gap-2'
            >
              <Plus className='h-4 w-4' />
              Add project
            </Button>
          </DisabledFieldTooltip>
        </div>
      </div>
      {/* Main Container with Background */}
      <section className='bg-background rounded-xl border p-6 shadow-sm space-y-4'>
        <ProjectLifecycleDialogs
          deleteTarget={deleteTarget}
          destroyTarget={destroyTarget}
          isPending={isPending}
          onCancelDelete={cancelDelete}
          onConfirmDelete={confirmDelete}
          onCancelDestroy={cancelDestroy}
          onConfirmDestroy={confirmDestroy}
        />
        <ProjectsTableSection
          projects={projects}
          mode={mode}
          onEdit={openEdit}
          onRequestDelete={requestDelete}
          onRestore={restoreProject}
          onRequestDestroy={requestDestroy}
          isPending={isPending}
          pendingReason={pendingReason}
          pendingDeleteId={pendingDeleteId}
          pendingRestoreId={pendingRestoreId}
          pendingDestroyId={pendingDestroyId}
          emptyMessage={emptyMessage}
        />
        <PaginationControls
          hasNextPage={hasNextPage}
          hasPreviousPage={hasPreviousPage}
          onNext={() => handlePaginate('forward')}
          onPrevious={() => handlePaginate('backward')}
          disableAll={isPending}
        />
      </section>
      <ProjectSheet
        open={sheetOpen}
        onOpenChange={handleSheetOpenChange}
        onComplete={handleSheetComplete}
        project={selectedProject}
        clients={sortedClients}
        contractorDirectory={contractorUsers}
        projectContractors={membersByProject}
      />
    </div>
  )
}

