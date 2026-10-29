'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@pts/ui/dialog'
import { ConfirmDialog } from '@pts/ui/confirm-dialog'
import { ProjectTimeLogForm } from './project-time-log-form'
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
  /** The project's hour totals, shown above the form (board only). */
  hoursSummary?: TimeLogHoursSummary
}

export type TimeLogHoursSummary = {
  projectLabel: string
  projectHours: number
  /** Hours left on the client's prepaid blocks; null when not prepaid. */
  clientRemaining: number | null
}

const HOURS = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })

export function ProjectTimeLogDialog(props: ProjectTimeLogDialogProps) {
  const {
    open,
    onOpenChange,
    mode,
    timeLogEntry,
    initialLinkedTaskIds,
    onMutationSuccess,
    hoursSummary,
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

  const dialogTitle = state.isEditMode ? 'Edit time log' : 'Add time log'
  const dialogDescription = state.isEditMode
    ? `Changes update ${state.projectLabel}’s hour totals right away.`
    : `Hours logged here count toward ${state.projectLabel} right away.`
  const submitLabel = state.isEditMode ? 'Save changes' : 'Log time'

  return (
    <>
      <Dialog open={open} onOpenChange={state.handleDialogOpenChange}>
        <DialogContent className='w-full max-w-xl'>
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>{dialogDescription}</DialogDescription>
          </DialogHeader>
          {hoursSummary ? (
            <dl className='bg-muted/40 grid grid-cols-2 gap-3 rounded-lg border px-4 py-3'>
              <div>
                <dt className='text-muted-foreground text-xs'>
                  {hoursSummary.projectLabel}
                </dt>
                <dd className='text-sm font-semibold tabular-nums'>
                  {HOURS.format(hoursSummary.projectHours)} hrs
                </dd>
              </div>
              {hoursSummary.clientRemaining !== null ? (
                <div>
                  <dt className='text-muted-foreground text-xs'>
                    Client hours remaining
                  </dt>
                  <dd
                    className={
                      hoursSummary.clientRemaining < 0
                        ? 'text-destructive text-sm font-semibold tabular-nums'
                        : 'text-sm font-semibold tabular-nums'
                    }
                  >
                    {HOURS.format(hoursSummary.clientRemaining)} hrs
                  </dd>
                </div>
              ) : null}
            </dl>
          ) : null}
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
        description='The task will no longer be associated with this log entry.'
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
        title='Archive time entry?'
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
