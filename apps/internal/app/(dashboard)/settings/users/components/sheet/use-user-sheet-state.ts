import { useCallback, useEffect, useState, useTransition } from 'react'
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
import { useUserSheetForm, type UseUserSheetFormReturn } from './use-user-sheet-form'
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
  unsavedChangesDialog: UseUserSheetFormReturn['unsavedChangesDialog']
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
  const [isPending, startTransition] = useTransition()
  // Second transition on purpose: `isPending` means "a save or delete is in
  // flight" (it drives the "Saving..." label and the disabled controls), so
  // re-baselining the form on open/close must not set it.
  const [, startResetTransition] = useTransition()

  const {
    form,
    resetFormState,
    avatarFieldKey,
    avatarInitials,
    avatarDisplayName,
    requestConfirmation,
    unsavedChangesDialog,
  } = useUserSheetForm({ user, isEditing })

  useEffect(() => {
    if (!open) {
      return
    }

    startResetTransition(() => {
      resetFormState()
      setFeedback(null)
    })
  }, [open, resetFormState, startResetTransition])

  const handleSheetOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        requestConfirmation(() => {
          startResetTransition(() => {
            resetFormState()
            setFeedback(null)
          })
          onOpenChange(false)
        })
        return
      }

      onOpenChange(nextOpen)
    },
    [onOpenChange, requestConfirmation, resetFormState, startResetTransition]
  )

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
        transition: startTransition,
      })

      submit(values)
    },
    [
      editingSelf,
      isEditing,
      onComplete,
      onOpenChange,
      resetFormState,
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
        transition: startTransition,
      })

      handler()
    },
    [
      currentUserId,
      isPending,
      onComplete,
      onOpenChange,
      setFeedback,
      startTransition,
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
        transition: startTransition,
      })

      handler()
    },
    [
      currentUserId,
      isPending,
      onComplete,
      onOpenChange,
      startTransition,
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
