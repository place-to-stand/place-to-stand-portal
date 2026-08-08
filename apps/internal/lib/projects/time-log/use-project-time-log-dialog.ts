'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'

import type { SearchableComboboxItem } from '@/components/ui/searchable-combobox'
import { useToast } from '@/components/ui/use-toast'

import {
  useProjectTimeLogMutation,
  type UseProjectTimeLogMutationOptions,
} from './use-project-time-log-mutation'
import { useTimeLogFormState } from './time-log-form-state'
import { useTimeLogOverage } from './time-log-overage'
import { useTimeLogTaskSelection } from './time-log-task-selection'
import type {
  ProjectTimeLogDialogParams,
  TimeLogEntry,
  TimeLogFormErrors,
} from './types'
import { TIME_LOGS_QUERY_KEY } from './types'

export type UseProjectTimeLogDialogOptions = ProjectTimeLogDialogParams & {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'edit'
  timeLogEntry: TimeLogEntry | null
  /**
   * Create-mode pre-link (task sheet): seeds the selection AND the dirty
   * baseline via a dedicated effect — Radix never fires `onOpenChange` for a
   * programmatic open, and seeding only the selection would make an untouched
   * dialog instantly dirty. Pre-linked ids also bypass the eligibility filter
   * (accepted tasks stay linkable from their own sheet).
   */
  initialLinkedTaskIds?: string[]
  /** Extra invalidation hook fired after any save or delete. */
  onMutationSuccess?: () => void
}

export type ProjectTimeLogDialogState = {
  projectLabel: string
  isEditMode: boolean
  isMutating: boolean
  disableSubmit: boolean
  formErrors: TimeLogFormErrors
  fieldErrorIds: {
    hours?: string
    loggedOn?: string
    user?: string
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
  handleDialogOpenChange: (open: boolean) => void
  availableTasks: ProjectTimeLogDialogParams['tasks']
  selectedTasks: ProjectTimeLogDialogParams['tasks']
  onAddTask: (taskId: string) => void
  onTaskPickerOpenChange: (open: boolean) => void
  isTaskPickerOpen: boolean
  taskPickerButtonDisabled: boolean
  taskPickerReason: string | null
  requestTaskRemoval: (
    task: ProjectTimeLogDialogParams['tasks'][number]
  ) => void
  taskRemovalCandidate: ProjectTimeLogDialogParams['tasks'][number] | null
  confirmTaskRemoval: () => void
  cancelTaskRemoval: () => void
  overageDialog: {
    isOpen: boolean
    description: string
    confirm: () => void
    cancel: () => void
  }
  discardDialog: {
    isOpen: boolean
    confirm: () => void
    cancel: () => void
  }
  deleteDialog: {
    isOpen: boolean
    request: () => void
    confirm: () => void
    cancel: () => void
    isDeleting: boolean
  }
}

export function useProjectTimeLogDialog(
  options: UseProjectTimeLogDialogOptions
): ProjectTimeLogDialogState {
  const {
    open,
    onOpenChange,
    projectId,
    projectName,
    projectType,
    clientId,
    clientName,
    clientBillingType,
    clientRemainingHours,
    tasks,
    currentUserId,
    projectMembers,
    admins,
    mode,
    timeLogEntry,
    initialLinkedTaskIds,
    onMutationSuccess,
  } = options

  const isEditMode = mode === 'edit' && Boolean(timeLogEntry)

  const router = useRouter()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const getToday = useCallback(() => format(new Date(), 'yyyy-MM-dd'), [])
  const normalizeLoggedOnValue = useCallback(
    (value: string | null | undefined) => {
      if (!value) {
        return getToday()
      }
      return value.includes('T') ? (value.split('T')[0] ?? getToday()) : value
    },
    [getToday]
  )

  const {
    hoursInput,
    onHoursChange,
    loggedOnInput,
    onLoggedOnChange,
    noteInput,
    onNoteChange,
    selectedUserId,
    onSelectUser,
    formErrors,
    setFormErrors,
    fieldErrorIds,
    userComboboxItems,
    prepareForOpen,
    resetForClose,
    setFormValues,
  } = useTimeLogFormState({
    currentUserId,
    admins,
    projectMembers,
    getToday,
  })

  const {
    selectedTaskIds,
    availableTasks,
    selectedTasks,
    isTaskPickerOpen,
    onTaskPickerOpenChange,
    onAddTask,
    requestTaskRemoval: rawRequestTaskRemoval,
    confirmTaskRemoval,
    cancelTaskRemoval: rawCancelTaskRemoval,
    taskRemovalCandidate,
    initializeSelection,
    resetSelection,
  } = useTimeLogTaskSelection(tasks, { pinnedTaskIds: initialLinkedTaskIds })

  // Skip overage check for internal/personal projects (no prepaid hours)
  // and for net_30 billing type clients
  const isNonClientProject =
    projectType === 'INTERNAL' || projectType === 'PERSONAL'
  const shouldEnforceOverageCheck =
    !isNonClientProject && clientBillingType !== 'net_30'

  const {
    requestConfirmation,
    reset: resetOverage,
    overageDialog,
  } = useTimeLogOverage({
    clientRemainingHours,
    enforceOverageCheck: shouldEnforceOverageCheck,
  })

  const [showDiscardDialog, setShowDiscardDialog] = useState(false)
  const [pendingClose, setPendingClose] = useState(false)
  const [baselineState, setBaselineState] = useState(() => ({
    hours: '',
    note: '',
    loggedOn: getToday(),
    taskIds: [] as string[],
  }))

  const baseQueryKey = useMemo(
    () => [TIME_LOGS_QUERY_KEY, projectId] as const,
    [projectId]
  )

  const handleSuccessReset = useCallback(() => {
    resetForClose(currentUserId)
    resetSelection()
    resetOverage()
  }, [currentUserId, resetForClose, resetOverage, resetSelection])

  const handleClose = useCallback(() => {
    onOpenChange(false)
  }, [onOpenChange])

  const projectLabel = useMemo(() => {
    return clientName ? `${projectName} · ${clientName}` : projectName
  }, [clientName, projectName])

  const successToast = isEditMode
    ? {
        title: 'Time log updated',
        description: 'The entry now reflects your changes.',
      }
    : undefined

  const existingEntryHours = timeLogEntry?.hours ?? null

  const editTaskIds = useMemo(() => {
    if (!timeLogEntry?.linked_tasks) {
      return []
    }

    return timeLogEntry.linked_tasks
      .map(link => link?.task?.id ?? null)
      .filter((taskId): taskId is string => Boolean(taskId))
  }, [timeLogEntry])

  // Create-mode pre-link seeding (C5). A dedicated effect because Radix only
  // fires onOpenChange for user interaction, never a programmatic `open` —
  // handleDialogOpenChange(true) never runs for a parent-opened dialog. Seeds
  // BOTH the selection and the baseline so an untouched dialog stays clean
  // (no discard confirm on plain close).
  useEffect(() => {
    if (!open || isEditMode) {
      return
    }

    const seedTaskIds = initialLinkedTaskIds ?? []

    if (!seedTaskIds.length) {
      return
    }

    initializeSelection(seedTaskIds)

    const nextBaselineState = {
      hours: '',
      note: '',
      loggedOn: getToday(),
      taskIds: seedTaskIds,
    }
    let cancelled = false
    const scheduleBaselineUpdate =
      typeof queueMicrotask === 'function'
        ? queueMicrotask
        : (callback: () => void) => {
            Promise.resolve().then(callback)
          }

    scheduleBaselineUpdate(() => {
      if (!cancelled) {
        setBaselineState(nextBaselineState)
      }
    })

    return () => {
      cancelled = true
    }
  }, [getToday, initialLinkedTaskIds, initializeSelection, isEditMode, open])

  useEffect(() => {
    if (!isEditMode || !timeLogEntry) {
      return
    }

    const loggedOnValue = normalizeLoggedOnValue(timeLogEntry.logged_on)
    setFormValues({
      hoursInput: String(timeLogEntry.hours ?? ''),
      loggedOnInput: loggedOnValue,
      noteInput: timeLogEntry.note ?? '',
      selectedUserId: timeLogEntry.user_id,
    })
    initializeSelection(editTaskIds)
    const nextBaselineState = {
      hours: String(timeLogEntry.hours ?? ''),
      note: timeLogEntry.note ?? '',
      loggedOn: loggedOnValue,
      taskIds: editTaskIds,
    }
    let cancelled = false
    const scheduleBaselineUpdate =
      typeof queueMicrotask === 'function'
        ? queueMicrotask
        : (callback: () => void) => {
            Promise.resolve().then(callback)
          }

    scheduleBaselineUpdate(() => {
      if (!cancelled) {
        setBaselineState(nextBaselineState)
      }
    })

    return () => {
      cancelled = true
    }
  }, [
    editTaskIds,
    initializeSelection,
    isEditMode,
    normalizeLoggedOnValue,
    setBaselineState,
    setFormValues,
    timeLogEntry,
  ])

  const mutationOptions: UseProjectTimeLogMutationOptions = {
    queryClient,
    router,
    toast,
    baseQueryKey,
    project: {
      id: projectId,
      name: projectName,
      clientId,
    },
    formValues: {
      hoursInput,
      loggedOnInput,
      noteInput,
      selectedUserId,
    },
    selectedTaskIds,
    onSuccessReset: handleSuccessReset,
    onClose: handleClose,
    setFormErrors,
    mode,
    timeLogId: timeLogEntry?.id ?? null,
    successToast,
    onMutationSuccess,
  }

  const timeLogMutation = useProjectTimeLogMutation(mutationOptions)

  // Edit-mode delete (W5): confirm-guarded, reusing the existing DELETE
  // endpoint + activity event (same flow as the Time Logs tab's list delete).
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!timeLogEntry?.id) {
        throw new Error('Missing time log identifier for delete.')
      }

      const response = await fetch(
        `/api/projects/${projectId}/time-logs/${timeLogEntry.id}`,
        { method: 'DELETE' }
      )

      let payload: unknown = null
      try {
        payload = await response.json()
      } catch {
        payload = null
      }

      if (!response.ok) {
        const message =
          typeof payload === 'object' && payload && 'error' in payload
            ? String((payload as { error?: unknown }).error ?? '').trim()
            : ''

        throw new Error(message || 'Unable to delete time log.')
      }

      // PRD 002 section 05: closed-month warning riding the API response.
      const warning =
        typeof payload === 'object' && payload && 'warning' in payload
          ? String((payload as { warning?: unknown }).warning ?? '').trim()
          : ''

      return { warning: warning || null }
    },
    onSuccess: async data => {
      await queryClient.invalidateQueries({ queryKey: baseQueryKey })
      onMutationSuccess?.()
      setIsDeleteConfirmOpen(false)
      handleSuccessReset()
      handleClose()
      toast({
        title: 'Time entry removed',
        description: 'The log no longer counts toward the burndown total.',
      })
      if (data?.warning) {
        toast({
          title: 'Closed month',
          description: data.warning,
          variant: 'destructive',
        })
      }
      router.refresh()
    },
    onError: error => {
      console.error('Failed to delete time log', error)
      setIsDeleteConfirmOpen(false)
      toast({
        title: 'Could not delete time log',
        description: 'Please try again. If the issue persists contact support.',
        variant: 'destructive',
      })
    },
  })

  const isMutating = timeLogMutation.isPending || deleteMutation.isPending

  const disableSubmit =
    isMutating ||
    !hoursInput.trim() ||
    !loggedOnInput.trim() ||
    !selectedUserId

  const taskPickerButtonDisabled = isMutating || availableTasks.length === 0

  const taskPickerReason = isMutating
    ? 'Saving time log...'
    : availableTasks.length === 0
      ? 'All eligible tasks are already linked.'
      : null

  const requestTaskRemoval = useCallback(
    (task: ProjectTimeLogDialogParams['tasks'][number]) => {
      if (isMutating) {
        return
      }
      rawRequestTaskRemoval(task)
    },
    [isMutating, rawRequestTaskRemoval]
  )

  const cancelTaskRemoval = useCallback(() => {
    if (isMutating) {
      return
    }
    rawCancelTaskRemoval()
  }, [isMutating, rawCancelTaskRemoval])

  const runMutation = useCallback(() => {
    timeLogMutation.mutate()
  }, [timeLogMutation])

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (isMutating) {
        return
      }

      const nextErrors: TimeLogFormErrors = {}
      const trimmedHours = hoursInput.trim()
      let parsedHours = Number.NaN

      if (!trimmedHours) {
        nextErrors.hours = 'Enter the number of hours worked.'
      } else {
        parsedHours = Number.parseFloat(trimmedHours)
        if (!Number.isFinite(parsedHours) || parsedHours <= 0) {
          nextErrors.hours = 'Enter a valid number of hours greater than zero.'
        }
      }

      if (!loggedOnInput.trim()) {
        nextErrors.loggedOn = 'Select the date these hours were worked.'
      }

      if (!selectedUserId) {
        nextErrors.user = 'Pick a teammate before logging time.'
      }

      if (Object.keys(nextErrors).length > 0) {
        setFormErrors(nextErrors)
        return
      }

      setFormErrors({})

      const previousHours =
        isEditMode && typeof existingEntryHours === 'number'
          ? existingEntryHours
          : 0

      if (
        requestConfirmation({
          nextHours: parsedHours,
          previousHours,
          action: runMutation,
        })
      ) {
        return
      }

      runMutation()
    },
    [
      hoursInput,
      isMutating,
      loggedOnInput,
      isEditMode,
      requestConfirmation,
      runMutation,
      selectedUserId,
      setFormErrors,
      existingEntryHours,
    ]
  )

  const isFormDirty = useMemo(() => {
    const trimmedHours = hoursInput.trim()
    const trimmedNote = noteInput.trim()
    const baselineHours = baselineState.hours.trim()
    const baselineNote = baselineState.note.trim()
    const tasksChanged =
      baselineState.taskIds.length !== selectedTaskIds.length ||
      baselineState.taskIds.some(
        (taskId, index) => taskId !== selectedTaskIds[index]
      )

    return (
      trimmedHours !== baselineHours ||
      trimmedNote !== baselineNote ||
      loggedOnInput !== baselineState.loggedOn ||
      tasksChanged
    )
  }, [baselineState, hoursInput, loggedOnInput, noteInput, selectedTaskIds])

  const handleDiscardConfirm = useCallback(() => {
    setShowDiscardDialog(false)
    if (pendingClose) {
      resetForClose(currentUserId)
      resetSelection()
      resetOverage()
      onOpenChange(false)
      setPendingClose(false)
    }
  }, [
    currentUserId,
    onOpenChange,
    pendingClose,
    resetForClose,
    resetOverage,
    resetSelection,
  ])

  const handleDiscardCancel = useCallback(() => {
    setShowDiscardDialog(false)
    setPendingClose(false)
  }, [])

  const handleDialogOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        const initialUserId =
          isEditMode && timeLogEntry?.user_id
            ? timeLogEntry.user_id
            : currentUserId
        prepareForOpen(initialUserId)
        if (isEditMode && timeLogEntry) {
          const loggedOnValue = normalizeLoggedOnValue(timeLogEntry.logged_on)
          setFormValues({
            hoursInput: String(timeLogEntry.hours ?? ''),
            loggedOnInput: loggedOnValue,
            noteInput: timeLogEntry.note ?? '',
            selectedUserId: timeLogEntry.user_id,
          })
          initializeSelection(editTaskIds)
          setBaselineState({
            hours: String(timeLogEntry.hours ?? ''),
            note: timeLogEntry.note ?? '',
            loggedOn: loggedOnValue,
            taskIds: editTaskIds,
          })
        } else {
          initializeSelection()
          setBaselineState({
            hours: '',
            note: '',
            loggedOn: getToday(),
            taskIds: [],
          })
        }
        resetOverage()
        setShowDiscardDialog(false)
        setPendingClose(false)
        onOpenChange(true)
      } else {
        if (isFormDirty && !isMutating) {
          setPendingClose(true)
          setShowDiscardDialog(true)
          return
        }
        resetForClose(currentUserId)
        resetSelection()
        resetOverage()
        setBaselineState({
          hours: '',
          note: '',
          loggedOn: getToday(),
          taskIds: [],
        })
        onOpenChange(false)
      }
    },
    [
      currentUserId,
      editTaskIds,
      getToday,
      initializeSelection,
      isEditMode,
      isFormDirty,
      isMutating,
      onOpenChange,
      prepareForOpen,
      resetForClose,
      resetOverage,
      resetSelection,
      normalizeLoggedOnValue,
      setBaselineState,
      setFormValues,
      timeLogEntry,
    ]
  )

  const guardedOverageDialog = useMemo(() => {
    return {
      isOpen: overageDialog.isOpen,
      description: overageDialog.description,
      confirm: () => {
        if (isMutating) {
          return
        }
        overageDialog.confirm()
      },
      cancel: () => {
        if (isMutating) {
          return
        }
        overageDialog.cancel()
      },
    }
  }, [isMutating, overageDialog])

  const discardDialog = useMemo(() => {
    return {
      isOpen: showDiscardDialog,
      confirm: handleDiscardConfirm,
      cancel: handleDiscardCancel,
    }
  }, [showDiscardDialog, handleDiscardConfirm, handleDiscardCancel])

  const requestDelete = useCallback(() => {
    if (deleteMutation.isPending) {
      return
    }
    setIsDeleteConfirmOpen(true)
  }, [deleteMutation.isPending])

  const cancelDelete = useCallback(() => {
    if (deleteMutation.isPending) {
      return
    }
    setIsDeleteConfirmOpen(false)
  }, [deleteMutation.isPending])

  const confirmDelete = useCallback(() => {
    if (deleteMutation.isPending || !timeLogEntry?.id) {
      return
    }
    deleteMutation.mutate()
  }, [deleteMutation, timeLogEntry?.id])

  const deleteDialog = useMemo(() => {
    return {
      isOpen: isDeleteConfirmOpen,
      request: requestDelete,
      confirm: confirmDelete,
      cancel: cancelDelete,
      isDeleting: deleteMutation.isPending,
    }
  }, [
    cancelDelete,
    confirmDelete,
    deleteMutation.isPending,
    isDeleteConfirmOpen,
    requestDelete,
  ])

  return {
    projectLabel,
    isEditMode,
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
    handleDialogOpenChange,
    availableTasks,
    selectedTasks,
    onAddTask,
    onTaskPickerOpenChange,
    isTaskPickerOpen,
    taskPickerButtonDisabled,
    taskPickerReason,
    requestTaskRemoval,
    taskRemovalCandidate,
    confirmTaskRemoval,
    cancelTaskRemoval,
    overageDialog: guardedOverageDialog,
    discardDialog,
    deleteDialog,
  }
}
