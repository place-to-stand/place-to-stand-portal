'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { UseFormReturn } from 'react-hook-form'

import type {
  DbUser,
  ProjectWithRelations,
  TaskWithRelations,
} from '@/lib/types'
import type { BoardColumnId } from '@/lib/projects/board/board-constants'
import { useUnsavedChangesWarning } from '@/lib/hooks/use-unsaved-changes-warning'
import { useSheetLifecycle } from '@/lib/sheets/use-sheet-lifecycle'
import { useToast } from '@/components/ui/use-toast'

import { removeTask, saveTask } from '@/app/(dashboard)/projects/actions'
import {
  ACCEPTED_TASK_ATTACHMENT_MIME_TYPES,
  MAX_TASK_ATTACHMENT_FILE_SIZE,
} from '@/lib/storage/task-attachment-constants'

import {
  TASK_STATUSES,
  UNASSIGNED_ASSIGNEE_VALUE,
} from './task-sheet-constants'
import {
  buildAssigneeItems,
  buildProjectItems,
  getDisabledReason,
  normalizeRichTextContent,
} from './task-sheet-utils'
import type { ProjectSelectionItems } from './task-sheet-utils'
import type { TaskSheetFormValues } from './task-sheet-schema'
import { useTaskSheetForm } from './hooks/use-task-sheet-form'
import {
  useTaskAttachments,
  type AttachmentItem,
} from './hooks/use-task-attachments'

export type { AttachmentItem } from './hooks/use-task-attachments'

export type UseTaskSheetStateArgs = {
  open: boolean
  onOpenChange: (open: boolean) => void
  task?: TaskWithRelations
  canManage: boolean
  admins: DbUser[]
  defaultStatus: BoardColumnId
  defaultDueOn: string | null
  projects: ProjectWithRelations[]
  projectSelectionProjects?: ProjectWithRelations[]
  defaultProjectId: string | null
  defaultAssigneeId: string | null
  defaultLeadId: string | null
  currentUserId: string
}

type UseTaskSheetStateReturn = {
  form: UseFormReturn<TaskSheetFormValues>
  isPending: boolean
  isDeleteDialogOpen: boolean
  assigneeItems: ReturnType<typeof buildAssigneeItems>
  projectItems: ProjectSelectionItems['items']
  projectGroups: ProjectSelectionItems['groups']
  sheetTitle: string
  projectName: string | null
  deleteDisabled: boolean
  deleteDisabledReason: string | null
  submitDisabled: boolean
  submitDisabledReason: string | null
  unsavedChangesDialog: ReturnType<typeof useUnsavedChangesWarning>['dialog']
  handleSheetOpenChange: (next: boolean) => void
  handleFormSubmit: (values: TaskSheetFormValues) => void
  handleRequestDelete: () => void
  handleCancelDelete: () => void
  handleConfirmDelete: () => void
  resolveDisabledReason: (disabled: boolean) => string | null
  editorKey: string
  taskStatuses: typeof TASK_STATUSES
  unassignedValue: typeof UNASSIGNED_ASSIGNEE_VALUE
  attachments: AttachmentItem[]
  handleAttachmentUpload: (files: FileList | File[]) => void
  handleAttachmentRemove: (key: string) => void
  handleAttachmentUndoRemove: (key: string) => void
  isUploadingAttachments: boolean
  acceptedAttachmentTypes: readonly string[]
  maxAttachmentSize: number
  attachmentsDisabledReason: string | null
}

export const useTaskSheetState = ({
  open,
  onOpenChange,
  task,
  canManage,
  admins,
  defaultStatus,
  defaultDueOn,
  projects,
  projectSelectionProjects,
  defaultProjectId,
  defaultAssigneeId,
  defaultLeadId,
  currentUserId,
}: UseTaskSheetStateArgs): UseTaskSheetStateReturn => {
  const router = useRouter()
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const { toast } = useToast()
  // Synchronous in-flight lock: `isPending` is render state, so two submits
  // in the same render window both observe it as false. This ref is checked
  // and set before the transition starts.
  const submitLockRef = useRef(false)

  const selectionProjects = projectSelectionProjects ?? projects

  const projectLookup = useMemo(() => {
    return new Map(selectionProjects.map(project => [project.id, project]))
  }, [selectionProjects])

  const { form, defaultValues, sheetTitle, editorKey } = useTaskSheetForm({
    task,
    defaultStatus,
    defaultDueOn,
    defaultProjectId,
    defaultAssigneeId,
    defaultLeadId,
  })
  const {
    attachmentItems,
    attachmentsDirty,
    isUploading,
    handleAttachmentUpload,
    handleAttachmentRemove,
    handleAttachmentUndoRemove,
    resetAttachmentsState,
    buildSubmissionPayload,
  } = useTaskAttachments({
    task,
    canManage,
    toast,
  })

  const resetFormState = useCallback(
    (options?: { preservePending?: boolean }) => {
      form.reset(defaultValues)
      setIsDeleteDialogOpen(false)
      resetAttachmentsState(options)
    },
    [defaultValues, form, resetAttachmentsState]
  )

  // `resetKey` carries the re-baseline rule: reset on open, and when the task
  // CHANGES while open (create→edit arrival, switching tasks) — never on a
  // same-id prop identity change (e.g. the router.refresh() a time-log save
  // triggers), which would wipe unsaved task-form edits.
  const {
    isSaving: isPending,
    startSave,
    handleSheetOpenChange,
    unsavedChangesDialog,
  } = useSheetLifecycle({
    open,
    onOpenChange,
    isDirty: form.formState.isDirty || attachmentsDirty,
    onReset: resetFormState,
    resetKey: task?.id ?? null,
  })

  const handleFormSubmit = useCallback(
    (values: TaskSheetFormValues) => {
      if (!canManage || submitLockRef.current) {
        return
      }

      submitLockRef.current = true

      startSave(async () => {
        try {
          const normalizedDescription = normalizeRichTextContent(
            values.description ?? null
          )
          const attachmentsPayload = buildSubmissionPayload()
          const result = await saveTask({
            id: task?.id,
            projectId: values.projectId,
            leadId: values.leadId ?? null,
            title: values.title.trim(),
            description: normalizedDescription,
            status: values.status,
            dueOn: values.dueOn ? values.dueOn : null,
            assigneeIds: values.assigneeId ? [values.assigneeId] : [],
            attachments: attachmentsPayload,
          })

          // All or nothing: an error means nothing was written, so the sheet
          // stays open with the user's edits for another try.
          if (result.error !== undefined) {
            toast({
              title: task ? 'Unable to save task' : 'Unable to create task',
              description: result.error,
              variant: 'destructive',
            })
            return
          }

          toast({
            title: task ? 'Task saved' : 'Task created',
            description: values.title.trim(),
          })

          resetFormState({ preservePending: true })
          onOpenChange(false)
          router.refresh()
        } finally {
          submitLockRef.current = false
        }
      })
    },
    [
      buildSubmissionPayload,
      canManage,
      onOpenChange,
      router,
      startSave,
      resetFormState,
      task,
      toast,
    ]
  )

  const handleRequestDelete = useCallback(() => {
    if (!task?.id || !canManage || isPending) {
      return
    }

    setIsDeleteDialogOpen(true)
  }, [canManage, isPending, task?.id])

  const handleCancelDelete = useCallback(() => {
    if (isPending) {
      return
    }

    setIsDeleteDialogOpen(false)
  }, [isPending])

  const handleConfirmDelete = useCallback(() => {
    if (!task?.id || !canManage || isPending) {
      return
    }

    setIsDeleteDialogOpen(false)
    startSave(async () => {
      const result = await removeTask({ taskId: task.id })

      if (result.error) {
        toast({
          title: 'Unable to delete task',
          description: result.error,
          variant: 'destructive',
        })
        return
      }

      toast({
        title: 'Task deleted',
        description: 'The task has been removed from the board.',
      })

      router.refresh()
      resetFormState()
      onOpenChange(false)
    })
  }, [
    canManage,
    isPending,
    onOpenChange,
    resetFormState,
    router,
    startSave,
    task,
    toast,
  ])

  const attachmentsDisabledReason = getDisabledReason(
    !canManage || isPending,
    canManage,
    isPending
  )

  const resolveDisabledReason = useCallback(
    (disabled: boolean) => getDisabledReason(disabled, canManage, isPending),
    [canManage, isPending]
  )

  const deleteDisabled = isPending || !canManage
  const deleteDisabledReason = resolveDisabledReason(deleteDisabled)
  const submitDisabled = isPending || !canManage || isUploading
  const submitDisabledReason = isUploading
    ? 'Please wait for uploads to finish.'
    : resolveDisabledReason(submitDisabled)

  const selectedProjectId = form.watch('projectId') ?? ''
  const selectedProject = selectedProjectId
    ? projectLookup.get(selectedProjectId)
    : null
  const { items: projectItems, groups: projectGroups } = useMemo(
    () => buildProjectItems({ projects: selectionProjects, currentUserId }),
    [currentUserId, selectionProjects]
  )
  const watchedAssigneeId = form.watch('assigneeId') ?? null
  const assigneeItems = useMemo(
    () =>
      // No "Unassigned" row: the picker's clear button unassigns.
      buildAssigneeItems({
        admins,
        members: selectedProject?.members ?? [],
        currentAssigneeId: watchedAssigneeId,
      }).filter(item => item.value !== UNASSIGNED_ASSIGNEE_VALUE),
    [admins, selectedProject, watchedAssigneeId]
  )
  const projectName = selectedProject?.name ?? null

  return {
    form,
    isPending,
    isDeleteDialogOpen,
    assigneeItems,
    projectItems,
    projectGroups,
    sheetTitle,
    projectName,
    deleteDisabled,
    deleteDisabledReason,
    submitDisabled,
    submitDisabledReason,
    unsavedChangesDialog,
    handleSheetOpenChange,
    handleFormSubmit,
    handleRequestDelete,
    handleCancelDelete,
    handleConfirmDelete,
    resolveDisabledReason,
    editorKey,
    taskStatuses: TASK_STATUSES,
    unassignedValue: UNASSIGNED_ASSIGNEE_VALUE,
    attachments: attachmentItems,
    handleAttachmentUpload,
    handleAttachmentRemove,
    handleAttachmentUndoRemove,
    isUploadingAttachments: isUploading,
    acceptedAttachmentTypes: ACCEPTED_TASK_ATTACHMENT_MIME_TYPES,
    maxAttachmentSize: MAX_TASK_ATTACHMENT_FILE_SIZE,
    attachmentsDisabledReason,
  }
}
