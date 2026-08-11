'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react'
import { useRouter } from 'next/navigation'
import type { UseFormReturn } from 'react-hook-form'

import type {
  DbUser,
  ProjectWithRelations,
  TaskWithRelations,
} from '@/lib/types'
import type { BoardColumnId } from '@/lib/projects/board/board-constants'
import { useUnsavedChangesWarning } from '@/lib/hooks/use-unsaved-changes-warning'
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
  feedback: string | null
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
  const [feedback, setFeedback] = useState<string | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
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
    resetAttachmentsState,
    buildSubmissionPayload,
  } = useTaskAttachments({
    task,
    canManage,
    toast,
  })

  const { requestConfirmation: confirmDiscard, dialog: unsavedChangesDialog } =
    useUnsavedChangesWarning({
      isDirty: form.formState.isDirty || attachmentsDirty,
    })

  const resetFormState = useCallback(
    (options?: { preservePending?: boolean }) => {
      form.reset(defaultValues)
      setFeedback(null)
      setIsDeleteDialogOpen(false)
      resetAttachmentsState(options)
    },
    [defaultValues, form, resetAttachmentsState]
  )

  // Consolidated re-baseline rule: the reset chain fires when the sheet
  // opens, or when `task?.id` CHANGES while open (create→edit arrival,
  // switching tasks) — never on same-id prop identity changes (e.g. the
  // router.refresh() a time-log save triggers), which would wipe unsaved
  // task-form edits. `undefined` marks "closed / not yet reset".
  const lastResetTaskIdRef = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    if (!open) {
      lastResetTaskIdRef.current = undefined
      return
    }

    const currentTaskId = task?.id ?? null

    if (
      lastResetTaskIdRef.current !== undefined &&
      lastResetTaskIdRef.current === currentTaskId
    ) {
      return
    }

    lastResetTaskIdRef.current = currentTaskId
    startTransition(() => {
      resetFormState()
    })
  }, [open, task?.id, resetFormState, startTransition])

  const handleSheetOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        confirmDiscard(() => {
          startTransition(() => {
            resetFormState()
          })
          onOpenChange(false)
        })
        return
      }

      onOpenChange(next)
    },
    [confirmDiscard, onOpenChange, resetFormState, startTransition]
  )

  const handleFormSubmit = useCallback(
    (values: TaskSheetFormValues) => {
      if (!canManage || submitLockRef.current) {
        return
      }

      submitLockRef.current = true

      startTransition(async () => {
        try {
          setFeedback(null)
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

          // Partial-failure contract: a create result carrying `taskId` means
          // the row exists — surface the failed sub-step via toast but still
          // close, so the create form can't be re-submitted into a duplicate.
          const createdTaskId = !task ? (result.taskId ?? null) : null

          if (result.error && !createdTaskId) {
            setFeedback(result.error)
            return
          }

          if (result.error) {
            toast({
              title: 'Task created with issues',
              description: result.error,
              variant: 'destructive',
            })
          } else {
            toast({
              title: task ? 'Task updated' : 'Task created',
              description: task
                ? 'Changes saved successfully.'
                : 'The task was added to the project board.',
            })
          }

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
    startTransition(async () => {
      setFeedback(null)
      const result = await removeTask({ taskId: task.id })

      if (result.error) {
        setFeedback(result.error)
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
  }, [canManage, isPending, onOpenChange, resetFormState, router, task, toast])

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
      buildAssigneeItems({
        admins,
        members: selectedProject?.members ?? [],
        currentAssigneeId: watchedAssigneeId,
      }),
    [admins, selectedProject, watchedAssigneeId]
  )
  const projectName = selectedProject?.name ?? null

  return {
    form,
    feedback,
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
    isUploadingAttachments: isUploading,
    acceptedAttachmentTypes: ACCEPTED_TASK_ATTACHMENT_MIME_TYPES,
    maxAttachmentSize: MAX_TASK_ATTACHMENT_FILE_SIZE,
    attachmentsDisabledReason,
  }
}
