import { Archive, Loader2, PlusCircle, Pencil } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { Input } from '@pts/ui/input'
import { type SearchableComboboxItem } from '@/components/ui/searchable-combobox'
import { Textarea } from '@pts/ui/textarea'
import type { TaskWithRelations } from '@/lib/types'
import type { TimeLogFormErrors } from '@/lib/projects/time-log/types'

import { SelectedTaskList } from './selected-task-list'
import { SheetSection } from '@/components/sheets/sheet-section'
import { EmptyState } from '@pts/ui/empty-state'
import { ENTITY_ICONS } from '@/lib/entity-accents'
import { TaskSelector } from './task-selector'
import { UserSelectField } from './user-select-field'

export type ProjectTimeLogFormProps = {
  isMutating: boolean
  disableSubmit: boolean
  formErrors: TimeLogFormErrors
  fieldErrorIds: {
    hours?: string
    loggedOn?: string
    user?: string
    note?: string
    general?: string
  }
  hoursInput: string
  onHoursChange: (value: string) => void
  loggedOnInput: string
  onLoggedOnChange: (value: string) => void
  noteInput: string
  onNoteChange: (value: string) => void
  selectedUserId: string
  onSelectUser: (value: string) => void
  userComboboxItems: SearchableComboboxItem[]
  getToday: () => string
  handleSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  availableTasks: TaskWithRelations[]
  selectedTasks: TaskWithRelations[]
  onAddTask: (taskId: string) => void
  isTaskPickerOpen: boolean
  onTaskPickerOpenChange: (open: boolean) => void
  taskPickerButtonDisabled: boolean
  taskPickerReason: string | null
  requestTaskRemoval: (task: TaskWithRelations) => void
  submitLabel: string
  isEditMode: boolean
  onRequestDelete?: () => void
}

export function ProjectTimeLogForm(props: ProjectTimeLogFormProps) {
  const {
    isMutating,
    disableSubmit,
    formErrors,
    fieldErrorIds,
    hoursInput,
    onHoursChange,
    loggedOnInput,
    onLoggedOnChange,
    noteInput,
    onNoteChange,
    selectedUserId,
    onSelectUser,
    userComboboxItems,
    getToday,
    handleSubmit,
    availableTasks,
    selectedTasks,
    onAddTask,
    isTaskPickerOpen,
    onTaskPickerOpenChange,
    taskPickerButtonDisabled,
    taskPickerReason,
    requestTaskRemoval,
    submitLabel,
    isEditMode,
    onRequestDelete,
  } = props

  const submitTooltipReason = disableSubmit
    ? 'Complete the form before submitting.'
    : null

  const SubmitIcon = isEditMode ? Pencil : PlusCircle

  return (
    <form
      onSubmit={handleSubmit}
      className='grid grid-cols-1 gap-4 sm:grid-cols-2'
    >
      <div className='space-y-2'>
        <label htmlFor='time-log-hours' className='text-sm font-medium'>
          Hours
        </label>
        <Input
          id='time-log-hours'
          type='number'
          step='0.25'
          min='0'
          inputMode='decimal'
          value={hoursInput}
          onChange={event => onHoursChange(event.currentTarget.value)}
          placeholder='e.g. 1.5'
          disabled={isMutating}
          aria-invalid={Boolean(formErrors.hours)}
          aria-describedby={fieldErrorIds.hours}
          required
        />
        {formErrors.hours ? (
          <p
            id={fieldErrorIds.hours}
            className='text-destructive text-xs'
            role='alert'
          >
            {formErrors.hours}
          </p>
        ) : null}
      </div>
      <div className='space-y-2'>
        <label htmlFor='time-log-date' className='text-sm font-medium'>
          Date
        </label>
        <DatePicker
          id='time-log-date'
          value={loggedOnInput}
          max={getToday()}
          onChange={onLoggedOnChange}
          clearable={false}
          disabled={isMutating}
          aria-invalid={Boolean(formErrors.loggedOn)}
          aria-describedby={fieldErrorIds.loggedOn}
        />
        {formErrors.loggedOn ? (
          <p
            id={fieldErrorIds.loggedOn}
            className='text-destructive text-xs'
            role='alert'
          >
            {formErrors.loggedOn}
          </p>
        ) : null}
      </div>
      <UserSelectField
        selectedUserId={selectedUserId}
        onSelectUser={onSelectUser}
        items={userComboboxItems}
        disabled={isMutating}
        fieldErrorId={fieldErrorIds.user}
        errorMessage={formErrors.user}
      />
      {/* Like the task sheet's Time logs: a heading with the +, the linked
          tasks, and an empty box that does what the + does. */}
      <SheetSection
        title='Linked tasks'
        icon={ENTITY_ICONS.task}
        className='gap-3 sm:col-span-2'
        action={
          <TaskSelector
            availableTasks={availableTasks}
            onAddTask={onAddTask}
            isOpen={isTaskPickerOpen}
            onOpenChange={onTaskPickerOpenChange}
            disabled={taskPickerButtonDisabled}
            disabledReason={taskPickerReason}
          />
        }
      >
        {selectedTasks.length === 0 ? (
          <EmptyState
            message='Hours apply to project if left empty'
            label={taskPickerButtonDisabled ? undefined : 'Link task'}
            onClick={
              taskPickerButtonDisabled
                ? undefined
                : () => onTaskPickerOpenChange(true)
            }
          />
        ) : (
          <SelectedTaskList
            tasks={selectedTasks}
            isActionDisabled={isMutating}
            disabledReason={isMutating ? 'Logging time…' : null}
            onRemove={requestTaskRemoval}
          />
        )}
      </SheetSection>
      <div className='space-y-2 sm:col-span-2'>
        <label htmlFor='time-log-note' className='text-sm font-medium'>
          Notes
        </label>
        <Textarea
          id='time-log-note'
          value={noteInput}
          onChange={event => onNoteChange(event.target.value)}
          rows={3}
          placeholder='Capture any context, like what was accomplished.'
          disabled={isMutating}
          aria-invalid={Boolean(formErrors.note)}
          aria-describedby={fieldErrorIds.note}
        />
        {formErrors.note ? (
          <p
            id={fieldErrorIds.note}
            className='text-destructive text-xs'
            role='alert'
          >
            {formErrors.note}
          </p>
        ) : null}
      </div>
      <div className='flex items-center justify-end gap-3 sm:col-span-2'>
        {isEditMode && onRequestDelete ? (
          <Button
            type='button'
            variant='destructive'
            disabled={isMutating}
            onClick={onRequestDelete}
            className='mr-auto inline-flex items-center gap-2'
          >
            <Archive className='size-4' />
            Archive
          </Button>
        ) : null}
        <DisabledFieldTooltip
          disabled={disableSubmit}
          reason={submitTooltipReason}
        >
          <Button
            type='submit'
            disabled={disableSubmit}
            className='inline-flex items-center gap-2'
          >
            {isMutating ? (
              <Loader2 className='size-4 animate-spin' />
            ) : (
              <SubmitIcon className='size-4' />
            )}
            {submitLabel}
          </Button>
        </DisabledFieldTooltip>
      </div>
    </form>
  )
}
