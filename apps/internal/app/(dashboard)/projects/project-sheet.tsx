'use client'

import { Sheet, SheetContent } from '@/components/ui/sheet'
import { useViewerAccess } from '@/components/providers/viewer-access-provider'
import { SheetFormHeader } from '@/components/sheets/sheet-form-header'
import { SheetRecordMenu } from '@/components/sheets/sheet-record-menu'
import { SheetPresence } from '@/components/sheets/sheet-presence'
import { useMemo } from 'react'

import {
  useProjectSheetState,
  type ContractorUserSummary,
  type ProjectWithClient,
} from '@/lib/projects/sheet/use-project-sheet-state'
import type { ClientPickerRow } from '@/lib/projects/sheet/project-sheet-form'
import {
  buildOwnerOptions,
  type AdminUserForOwner,
} from '@/lib/projects/sheet/project-sheet-ui-state'

import { ProjectSheetForm } from './_components/project-sheet/project-sheet-form'
import { ProjectSheetDialogs } from './_components/project-sheet/project-sheet-dialogs'
import { createProjectSheetFieldState } from './_components/project-sheet/project-sheet-field-state'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: () => void
  project: ProjectWithClient | null
  /** Prefills the create sheet's client. */
  initialCompanyId?: string
  clients: ClientPickerRow[]
  adminUsers?: AdminUserForOwner[]
  contractorDirectory?: ContractorUserSummary[]
  projectContractors?: Record<string, ContractorUserSummary[]>
}

export function ProjectSheet(props: Props) {
  const { isAdmin } = useViewerAccess()
  const {
    form,
    isEditing,
    isPending,
    requiresClientSelection,
    clientOptions,
    submitButton,
    deleteButton,
    isDeleteDialogOpen,
    unsavedChangesDialog,
    saveConflict,
    hasUnsavedChanges,
    handleLoadTheirs,
    handleSheetOpenChange,
    handleSubmit,
    handleReposDirtyChange,
    handleRequestDelete,
    handleCancelDelete,
    handleConfirmDelete,
  } = useProjectSheetState(props)

  const fieldState = useMemo(
    () =>
      createProjectSheetFieldState({
        isPending,
        hasClients: clientOptions.length > 0,
        requiresClientSelection,
      }),
    [clientOptions, isPending, requiresClientSelection]
  )

  const currentOwnerId = form.watch('ownerId')
  const ownerOptions = useMemo(
    () =>
      // No "Unassigned" row in the sheet: the picker's clear button unassigns.
      buildOwnerOptions(props.adminUsers ?? [], currentOwnerId || null).filter(
        option => option.value !== ''
      ),
    [currentOwnerId, props.adminUsers]
  )

  return (
    <>
      <Sheet open={props.open} onOpenChange={handleSheetOpenChange}>
        <SheetContent
          hideCloseButton
          // Admins see the infrastructure column (GitHub, Vercel, Supabase).
          columns={isAdmin ? 2 : 1}
          className='flex w-full flex-col gap-0 overflow-hidden p-0'
        >
          <SheetFormHeader
            entity='project'
            presence={
              <SheetPresence
                entity='project'
                noun='project'
                recordId={props.project?.id ?? null}
                open={props.open}
                isDirty={hasUnsavedChanges}
                guard={saveConflict}
                onLoadTheirs={handleLoadTheirs}
              />
            }
            title={
              isEditing ? props.project?.name || 'Project' : 'Create project'
            }
            menu={
              isEditing ? (
                <SheetRecordMenu
                  noun='Project'
                  onRequestArchive={handleRequestDelete}
                  archiveDisabled={deleteButton.disabled}
                  archiveDisabledReason={deleteButton.reason}
                />
              ) : null
            }
          />
          <ProjectSheetForm
            form={form}
            fieldState={fieldState}
            isEditing={isEditing}
            isPending={isPending}
            clientOptions={clientOptions}
            ownerOptions={ownerOptions}
            submitButton={submitButton}
            onSubmit={handleSubmit}
            onReposDirtyChange={handleReposDirtyChange}
            isSheetOpen={props.open}
            historyKey={props.project?.id ?? 'project:new'}
            projectId={props.project?.id}
            saveConflict={saveConflict}
            onLoadTheirs={handleLoadTheirs}
          />
        </SheetContent>
      </Sheet>
      <ProjectSheetDialogs
        isDeleteDialogOpen={isDeleteDialogOpen}
        projectName={props.project?.name}
        isPending={isPending}
        unsavedChangesDialog={unsavedChangesDialog}
        onCancelDelete={handleCancelDelete}
        onConfirmDelete={handleConfirmDelete}
      />
    </>
  )
}
