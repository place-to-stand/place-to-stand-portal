'use client'

import { useState } from 'react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@pts/ui/dialog'
import { ConfirmDialog } from '@pts/ui/confirm-dialog'
import { cn } from '@pts/ui/cn'
import { ProjectTimeLogForm } from './project-time-log-form'
import { InfoPanelDivider } from '@/components/ui/info-panel'
import {
  TimeLogHoursSummary,
  type TimeLogInfoVariant,
} from './time-log-hours-summary'
import { useProjectTimeLogDialog } from '@/lib/projects/time-log/use-project-time-log-dialog'
import type {
  ProjectTimeLogDialogParams,
  TimeLogEntry,
} from '@/lib/projects/time-log/types'

export type ProjectTimeLogDialogProps = ProjectTimeLogDialogParams & {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'edit'
  timeLogEntry: TimeLogEntry | null
  initialLinkedTaskIds?: string[]
  onMutationSuccess?: () => void
}

export function ProjectTimeLogDialog(props: ProjectTimeLogDialogProps) {
  const {
    open,
    onOpenChange,
    mode,
    timeLogEntry,
    initialLinkedTaskIds,
    onMutationSuccess,
    ...rest
  } = props

  const state = useProjectTimeLogDialog({
    ...(rest as ProjectTimeLogDialogParams),
    open,
    onOpenChange,
    mode,
    timeLogEntry,
    initialLinkedTaskIds,
    onMutationSuccess,
  })

  // TEMPORARY comparison (local dev only): a Panel / Band switch under the
  // title shows the header band instead of the panel. Drop with its commit.
  const [infoVariant, setInfoVariant] = useState<TimeLogInfoVariant>('panel')

  const dialogTitle = state.isEditMode ? 'Edit time log' : 'Create time log'
  const submitLabel = state.isEditMode ? 'Save changes' : 'Log time'

  return (
    <>
      <Dialog open={open} onOpenChange={state.handleDialogOpenChange}>
        <DialogContent className='w-full max-w-xl'>
          <DialogHeader>
            <div className='flex items-center justify-between gap-3 pr-8'>
              <DialogTitle>{dialogTitle}</DialogTitle>
              {process.env.NODE_ENV === 'development' ? (
                <div
                  className='bg-muted flex rounded-md p-0.5 text-xs'
                  role='group'
                  aria-label='Compare time log context'
                >
                  {(['panel', 'band'] as const).map(variant => (
                    <button
                      key={variant}
                      type='button'
                      aria-pressed={infoVariant === variant}
                      onClick={() => setInfoVariant(variant)}
                      className={cn(
                        'cursor-pointer rounded px-2 py-0.5 capitalize',
                        infoVariant === variant
                          ? 'bg-background shadow-sm'
                          : 'text-muted-foreground'
                      )}
                    >
                      {variant}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            {/* The project shows in the box below; screen readers get it here. */}
            <DialogDescription className='sr-only'>
              {state.projectLabel}
            </DialogDescription>
          </DialogHeader>
          <TimeLogHoursSummary
            variant={infoVariant}
            projectId={rest.projectId}
            projectLabel={state.projectLabel}
            isClientProject={rest.projectType === 'CLIENT'}
          />
          {infoVariant === 'band' ? null : <InfoPanelDivider />}
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
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(state.taskRemovalCandidate)}
        title='Remove linked task?'
        description='The task will no longer be linked to this time log.'
        confirmLabel='Remove'
        confirmVariant='destructive'
        confirmDisabled={state.isMutating}
        onCancel={state.cancelTaskRemoval}
        onConfirm={state.confirmTaskRemoval}
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
      <ConfirmDialog
        open={state.deleteDialog.isOpen}
        title='Archive time log?'
        description='This removes the log from the project burndown.'
        confirmLabel='Archive'
        confirmVariant='destructive'
        confirmDisabled={state.deleteDialog.isDeleting}
        onCancel={state.deleteDialog.cancel}
        onConfirm={state.deleteDialog.confirm}
      />
    </>
  )
}
