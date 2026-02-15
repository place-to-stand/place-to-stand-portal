'use client'

import { useCallback, useMemo } from 'react'
import type { UseFormReturn } from 'react-hook-form'

import { Form } from '@/components/ui/form'
import type { TaskSheetFormValues } from '@/lib/projects/task-sheet/task-sheet-schema'
import type { AttachmentItem } from '@/lib/projects/task-sheet/use-task-sheet-state'
import type {
  SearchableComboboxGroup,
  SearchableComboboxItem,
} from '@/components/ui/searchable-combobox'

import { TaskSheetFormFields, type TaskSheetFormFieldsProps } from './task-sheet-form-fields'

export const TASK_FORM_ID = 'task-form'

type TaskSheetFormProps = {
  form: UseFormReturn<TaskSheetFormValues>
  onSubmit: (values: TaskSheetFormValues) => void
  feedback: string | null
  isPending: boolean
  canManage: boolean
  assigneeItems: SearchableComboboxItem[]
  projectItems: SearchableComboboxItem[]
  projectGroups: SearchableComboboxGroup[]
  resolveDisabledReason: (disabled: boolean) => string | null
  taskStatuses: TaskSheetFormFieldsProps['taskStatuses']
  unassignedValue: string
  editorKey: string
  isSheetOpen: boolean
  attachments: AttachmentItem[]
  onAttachmentUpload: (files: FileList | File[]) => void
  onAttachmentRemove: (key: string) => void
  isUploadingAttachments: boolean
  acceptedAttachmentTypes: readonly string[]
  maxAttachmentSize: number
  attachmentsDisabledReason: string | null
  isDragActive: boolean
}

export function TaskSheetForm(props: TaskSheetFormProps) {
  const {
    form,
    onSubmit,
    feedback,
    isPending,
    canManage,
    assigneeItems,
    projectItems,
    projectGroups,
    resolveDisabledReason,
    taskStatuses,
    unassignedValue,
    editorKey,
    isSheetOpen,
    attachments,
    onAttachmentUpload,
    onAttachmentRemove,
    isUploadingAttachments,
    acceptedAttachmentTypes,
    maxAttachmentSize,
    attachmentsDisabledReason,
    isDragActive,
  } = props

  const attachmentsDisabled = isPending || !canManage

  const handleFileDialogSelect = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) {
        return
      }
      onAttachmentUpload(fileList)
    },
    [onAttachmentUpload]
  )

  const submitHandler = useMemo(
    () => form.handleSubmit(onSubmit),
    [form, onSubmit]
  )

  return (
    <Form {...form}>
      <form
        id={TASK_FORM_ID}
        onSubmit={submitHandler}
        className='flex flex-1 flex-col gap-6 px-6 pb-4'
      >
        <TaskSheetFormFields
          form={form}
          isPending={isPending}
          canManage={canManage}
          resolveDisabledReason={resolveDisabledReason}
          taskStatuses={taskStatuses}
          assigneeItems={[...assigneeItems]}
          projectItems={projectItems}
          projectGroups={projectGroups}
          unassignedValue={unassignedValue}
          editorKey={editorKey}
          attachments={attachments}
          onSelectFiles={handleFileDialogSelect}
          onAttachmentRemove={onAttachmentRemove}
          attachmentsDisabled={attachmentsDisabled}
          attachmentsDisabledReason={attachmentsDisabledReason}
          isUploadingAttachments={isUploadingAttachments}
          isDragActive={isDragActive}
          acceptedAttachmentTypes={acceptedAttachmentTypes}
          maxAttachmentSize={maxAttachmentSize}
          feedback={feedback}
          isSheetOpen={isSheetOpen}
        />
      </form>
    </Form>
  )
}
