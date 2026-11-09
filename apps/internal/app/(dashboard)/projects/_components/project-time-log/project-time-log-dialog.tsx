'use client'

import { useEffect, useRef, type RefObject } from 'react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@pts/ui/dialog'
import { ConfirmDialog } from '@pts/ui/confirm-dialog'
import { ArchiveConfirmDialog } from '@/components/sheets/archive-confirm-dialog'
import { ProjectTimeLogForm } from './project-time-log-form'
import { InfoPanelDivider } from '@/components/ui/info-panel'
import { TimeLogHoursSummary } from './time-log-hours-summary'
import { TimeLogDialogSkeleton } from './time-log-dialog-skeleton'
import { useProjectTimeLogDialog } from '@/lib/projects/time-log/use-project-time-log-dialog'
import type {
  ProjectTimeLogDialogParams,
  TimeLogEntry,
} from '@/lib/projects/time-log/types'

type TimeLogDialogOptions = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'edit'
  timeLogEntry: TimeLogEntry | null
  initialLinkedTaskIds?: string[]
  onMutationSuccess?: () => void
}

export type ProjectTimeLogDialogProps = ProjectTimeLogDialogParams &
  TimeLogDialogOptions

/** The Log time dialog, for callers that already hold the project's data. */
export function ProjectTimeLogDialog(props: ProjectTimeLogDialogProps) {
  const {
    open,
    onOpenChange,
    mode,
    timeLogEntry,
    initialLinkedTaskIds,
    onMutationSuccess,
    ...params
  } = props

  return (
    <TimeLogDialog
      params={params}
      open={open}
      onOpenChange={onOpenChange}
      mode={mode}
      timeLogEntry={timeLogEntry}
      initialLinkedTaskIds={initialLinkedTaskIds}
      onMutationSuccess={onMutationSuccess}
    />
  )
}

type GuardRef = RefObject<((open: boolean) => void) | null>

/**
 * The Log time dialog. It opens at once, like a sheet: while `params` (and,
 * to edit, `timeLogEntry`) load, it shows the same frame with placeholders,
 * then the form; a failed load shows `loadError` in place of the form.
 */
export function TimeLogDialog({
  params,
  loadError = null,
  ...options
}: TimeLogDialogOptions & {
  /** The project's data; null while it loads. */
  params: ProjectTimeLogDialogParams | null
  loadError?: string | null
}) {
  const { open, onOpenChange, mode, timeLogEntry } = options
  // Once the form is up, closing goes through its unsaved-changes check.
  const guardRef: GuardRef = useRef(null)
  const ready = params !== null && (mode === 'create' || timeLogEntry !== null)
  const dialogTitle = mode === 'edit' ? 'Edit time log' : 'Create time log'

  return (
    <Dialog
      open={open}
      onOpenChange={next => (guardRef.current ?? onOpenChange)(next)}
    >
      <DialogContent className='w-full max-w-xl'>
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          {ready ? null : (
            <DialogDescription className='sr-only'>
              {loadError ?? 'Loading the time log…'}
            </DialogDescription>
          )}
        </DialogHeader>
        {ready ? (
          <TimeLogDialogBody params={params} guardRef={guardRef} {...options} />
        ) : loadError ? (
          <p className='text-destructive text-sm' role='alert'>
            {loadError}
          </p>
        ) : (
          <TimeLogDialogSkeleton />
        )}
      </DialogContent>
    </Dialog>
  )
}

function TimeLogDialogBody({
  params,
  guardRef,
  ...options
}: TimeLogDialogOptions & {
  params: ProjectTimeLogDialogParams
  guardRef: GuardRef
}) {
  const state = useProjectTimeLogDialog({ ...params, ...options })
  const submitLabel = state.isEditMode ? 'Save changes' : 'Log time'

  useEffect(() => {
    guardRef.current = state.handleDialogOpenChange
    return () => {
      guardRef.current = null
    }
  }, [guardRef, state.handleDialogOpenChange])

  return (
    <>
      {/* The project shows in the box below; screen readers get it here. */}
      <DialogDescription className='sr-only'>
        {state.projectLabel}
      </DialogDescription>
      <TimeLogHoursSummary
        projectId={params.projectId}
        projectLabel={state.projectLabel}
        isClientProject={params.projectType === 'CLIENT'}
      />
      <InfoPanelDivider />
      <ProjectTimeLogForm
        isMutating={state.isMutating}
        disableSubmit={state.disableSubmit}
        formErrors={state.formErrors}
        fieldErrorIds={state.fieldErrorIds}
        hoursInput={state.hoursInput}
        onHoursChange={state.onHoursChange}
        loggedOnInput={state.loggedOnInput}
        onLoggedOnChange={state.onLoggedOnChange}
        noteInput={state.noteInput}
        onNoteChange={state.onNoteChange}
        selectedUserId={state.selectedUserId}
        onSelectUser={state.onSelectUser}
        userComboboxItems={state.userComboboxItems}
        getToday={state.getToday}
        handleSubmit={state.handleSubmit}
        availableTasks={state.availableTasks}
        selectedTasks={state.selectedTasks}
        onAddTask={state.onAddTask}
        isTaskPickerOpen={state.isTaskPickerOpen}
        onTaskPickerOpenChange={state.onTaskPickerOpenChange}
        taskPickerButtonDisabled={state.taskPickerButtonDisabled}
        taskPickerReason={state.taskPickerReason}
        requestTaskRemoval={state.requestTaskRemoval}
        submitLabel={submitLabel}
        isEditMode={state.isEditMode}
        onRequestDelete={
          state.isEditMode ? state.deleteDialog.request : undefined
        }
      />
      <ConfirmDialog
        open={state.overageDialog.isOpen}
        title='Hours exceed client balance'
        description={state.overageDialog.description}
        confirmLabel='Log anyway'
        confirmVariant='destructive'
        confirmDisabled={state.isMutating}
        onCancel={state.overageDialog.cancel}
        onConfirm={state.overageDialog.confirm}
      />
      <ConfirmDialog
        open={state.discardDialog.isOpen}
        title='Discard time log?'
        description='You have unsaved changes. Are you sure you want to discard them?'
        confirmLabel='Discard'
        confirmVariant='destructive'
        confirmDisabled={state.isMutating}
        onCancel={state.discardDialog.cancel}
        onConfirm={state.discardDialog.confirm}
      />
      <ArchiveConfirmDialog
        open={state.deleteDialog.isOpen}
        entity='time log'
        name='this time log'
        list='time logs'
        extra="It no longer counts toward the project's hours."
        pending={state.deleteDialog.isDeleting}
        onCancel={state.deleteDialog.cancel}
        onConfirm={state.deleteDialog.confirm}
      />
    </>
  )
}
