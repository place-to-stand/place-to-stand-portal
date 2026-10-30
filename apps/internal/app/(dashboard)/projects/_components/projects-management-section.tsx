'use client'

import { useCallback, useMemo, type ReactNode } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { PaginationControls } from '@/components/ui/pagination-controls'
import { useToast } from '@/components/ui/use-toast'
import type {
  ClientPickerRow,
  ProjectWithClient,
} from '@/lib/settings/projects/project-sheet-form'
import { sortClientsByName } from '@/lib/settings/projects/project-sheet-form'
import type { AdminUserForOwner } from '@/lib/settings/projects/project-sheet-ui-state'

import { ProjectSheet } from '@/app/(dashboard)/settings/projects/project-sheet'
import { ProjectLifecycleDialogs } from '@/components/settings/projects/table/project-lifecycle-dialogs'
import { ProjectsTableSection } from '@/components/settings/projects/table/projects-table-section'
import { type ContractorUserSummary } from '@/components/settings/projects/table/types'
import { useProjectsSettingsController } from '@/components/settings/projects/table/use-projects-settings-controller'
import { PENDING_REASON } from '@/lib/forms/form-controls'

type ProjectsManagementSectionProps = {
  mode: 'active' | 'archive'
  projects: ProjectWithClient[]
  clients: ClientPickerRow[]
  adminUsers: AdminUserForOwner[]
  contractorUsers: ContractorUserSummary[]
  membersByProject: Record<string, ContractorUserSummary[]>
  totalCount: number
  currentPage: number
  totalPages: number
  pageSize: number
  /** Toolbar row (FilterBar) rendered inside the card, above the table. */
  filters?: ReactNode
  /**
   * PRD 004 §01: pages converted to PageShell render tabs/count/action in the
   * shell toolbar; they pass false so the section renders only the table.
   */
}

export function ProjectsManagementSection({
  mode,
  projects,
  clients,
  adminUsers,
  contractorUsers,
  membersByProject,
  totalCount,
  currentPage,
  totalPages,
  pageSize,
  filters,
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

  const pendingReason = PENDING_REASON

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

  // Active `?q=` flips the empty state to the filtered message (R4).
  const hasActiveFilter = Boolean(searchParams.get('q')?.trim())
  const emptyMessage = hasActiveFilter
    ? 'No projects match the current filters.'
    : mode === 'active'
      ? 'No projects yet.'
      : 'No archived projects.'

  return (
    <div className='space-y-4'>
      {/* Main Container with Background */}
      <section className='bg-background space-y-4 rounded-xl border p-4 shadow-sm'>
        <ProjectLifecycleDialogs
          deleteTarget={deleteTarget}
          destroyTarget={destroyTarget}
          isPending={isPending}
          onCancelDelete={cancelDelete}
          onConfirmDelete={confirmDelete}
          onCancelDestroy={cancelDestroy}
          onConfirmDestroy={confirmDestroy}
        />
        {filters}
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
          mode='paged'
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalCount}
          pageSize={pageSize}
          onPageChange={handlePageChange}
        />
      </section>
      <ProjectSheet
        open={sheetOpen}
        onOpenChange={handleSheetOpenChange}
        onComplete={handleSheetComplete}
        project={selectedProject}
        clients={sortedClients}
        adminUsers={adminUsers}
        contractorDirectory={contractorUsers}
        projectContractors={membersByProject}
      />
    </div>
  )
}
