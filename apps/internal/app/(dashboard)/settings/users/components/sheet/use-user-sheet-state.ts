import { useCallback, useState } from 'react'
import type { UseFormReturn } from 'react-hook-form'

import { PENDING_REASON, SELF_DISABLE_RESTRICTION } from './constants'
import type { UserFormValues } from './form-schema'
import {
  createDeleteCancelHandler,
  createDeleteConfirmHandler,
  createDeleteRequestHandler,
  createSubmitHandler,
  getDeleteDisabledReason,
  getEmailDisabledReason,
  getRoleDisabledReason,
  getSubmitDisabledReason,
} from './user-sheet-mutations'
import { useUserSheetForm } from './use-user-sheet-form'
import {
  useSheetLifecycle,
  type SheetLifecycle,
} from '@/lib/sheets/use-sheet-lifecycle'
import type { UserSheetProps } from './types'

export type UseUserSheetStateReturn = {
  form: UseFormReturn<UserFormValues>
  isEditing: boolean
  isPending: boolean
  feedback: string | null
  avatarFieldKey: number
  avatarInitials: string
  avatarDisplayName: string | null
  emailDisabled: boolean
  emailDisabledReason: string | null
  roleDisabled: boolean
  roleDisabledReason: string | null
  submitDisabled: boolean
  submitDisabledReason: string | null
  deleteDisabled: boolean
  deleteDisabledReason: string | null
  accessToggleDisabled: boolean
  accessToggleDisabledReason: string | null
  isDeleteDialogOpen: boolean
  pendingReason: string
  unsavedChangesDialog: SheetLifecycle['unsavedChangesDialog']
  handleSheetOpenChange: (open: boolean) => void
  handleFormSubmit: (values: UserFormValues) => void
  handleRequestDelete: () => void
  handleCancelDelete: () => void
  handleConfirmDelete: () => void
}

export const useUserSheetState = ({
  open,
  onOpenChange,
  onComplete,
  user,
  currentUserId,
}: UserSheetProps): UseUserSheetStateReturn => {
  const isEditing = Boolean(user)
  const editingSelf = isEditing && user?.id === currentUserId

  const [feedback, setFeedback] = useState<string | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const {
    form,
    resetFormState,
    avatarFieldKey,
    avatarInitials,
    avatarDisplayName,
  } = useUserSheetForm({ user, isEditing })

  const resetSheetState = useCallback(() => {
    resetFormState()
    setFeedback(null)
  }, [resetFormState])

  const {
    isSaving: isPending,
    startSave,
    handleSheetOpenChange,
    unsavedChangesDialog,
  } = useSheetLifecycle({
    open,
    onOpenChange,
    isDirty: form.formState.isDirty,
    onReset: resetSheetState,
    resetKey: user?.id ?? null,
  })

  const handleFormSubmit = useCallback(
    (values: UserFormValues) => {
      const submit = createSubmitHandler({
        isEditing,
        editingSelf,
        user,
        onComplete,
        onClose: onOpenChange,
        resetFormState,
        setFeedback,
        transition: startSave,
      })

      submit(values)
    },
    [
      editingSelf,
      isEditing,
      onComplete,
      onOpenChange,
      resetFormState,
      startSave,
      user,
    ]
  )

  const handleRequestDelete = useCallback(
    () => {
      const handler = createDeleteRequestHandler({
        user,
        currentUserId,
        isPending,
        setFeedback,
        setIsDeleteDialogOpen,
        onClose: onOpenChange,
        onComplete,
        transition: startSave,
      })

      handler()
    },
    [
      currentUserId,
      isPending,
      onComplete,
      onOpenChange,
      setFeedback,
      startSave,
      user,
    ]
  )

  const handleCancelDelete = useCallback(
    () => {
      const handler = createDeleteCancelHandler({
        isPending,
        setIsDeleteDialogOpen,
      })

      handler()
    },
    [isPending]
  )

  const handleConfirmDelete = useCallback(
    () => {
      const handler = createDeleteConfirmHandler({
        user,
        currentUserId,
        isPending,
        setFeedback,
        setIsDeleteDialogOpen,
        onClose: onOpenChange,
        onComplete,
        transition: startSave,
      })

      handler()
    },
    [
      currentUserId,
      isPending,
      onComplete,
      onOpenChange,
      startSave,
      user,
    ]
  )

  const emailDisabled = isPending || isEditing
  const emailDisabledReason = getEmailDisabledReason(isPending, isEditing)

  const roleDisabled = isPending || editingSelf
  const roleDisabledReason = getRoleDisabledReason(isPending, editingSelf)

  const submitDisabled = isPending
  const submitDisabledReason = getSubmitDisabledReason(isPending)

  const deleteDisabled = isPending || user?.id === currentUserId
  const deleteDisabledReason = getDeleteDisabledReason(
    isPending,
    deleteDisabled
  )

  const accessToggleDisabled = isPending || editingSelf
  const accessToggleDisabledReason = accessToggleDisabled
    ? isPending
      ? PENDING_REASON
      : SELF_DISABLE_RESTRICTION
    : null

  return {
    form,
    isEditing,
    isPending,
    feedback,
    avatarFieldKey,
    avatarInitials,
    avatarDisplayName,
    emailDisabled,
    emailDisabledReason,
    roleDisabled,
    roleDisabledReason,
    submitDisabled,
    submitDisabledReason,
    deleteDisabled,
    deleteDisabledReason,
    accessToggleDisabled,
    accessToggleDisabledReason,
    isDeleteDialogOpen,
    pendingReason: PENDING_REASON,
    unsavedChangesDialog,
    handleSheetOpenChange,
    handleFormSubmit,
    handleRequestDelete,
    handleCancelDelete,
    handleConfirmDelete,
  }
}
