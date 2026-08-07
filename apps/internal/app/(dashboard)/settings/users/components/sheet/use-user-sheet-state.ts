import { useCallback, useEffect, useState, useTransition } from 'react'
import type { UseFormReturn } from 'react-hook-form'

import { useSetUserDisabledAction } from '@/lib/settings/users/state/user-mutation/use-set-user-disabled-action'

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
  accessEnabled: boolean
  accessToggleDisabled: boolean
  accessToggleDisabledReason: string | null
  handleToggleAccess: (enabled: boolean) => void
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

  // The sheet's `user` prop is a snapshot from when Edit was clicked, so the
  // toggle tracks access locally and re-syncs whenever the sheet (re)opens.
  const accessKey = `${user?.id ?? 'new'}:${open}`
  const [prevAccessKey, setPrevAccessKey] = useState(accessKey)
  const [accessEnabled, setAccessEnabled] = useState(!user?.disabled_at)

  if (prevAccessKey !== accessKey) {
    setPrevAccessKey(accessKey)
    setAccessEnabled(!user?.disabled_at)
  }

  const handleAccessChanged = useCallback(
    (_user: NonNullable<UserSheetProps['user']>, disabled: boolean) => {
      setAccessEnabled(!disabled)
    },
    []
  )
  const disableAction = useSetUserDisabledAction({
    onSuccess: handleAccessChanged,
  })

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

    startTransition(() => {
      resetFormState()
      setFeedback(null)
    })
  }, [open, resetFormState, startTransition])

  const handleSheetOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        requestConfirmation(() => {
          startTransition(() => {
            resetFormState()
            setFeedback(null)
          })
          onOpenChange(false)
        })
        return
      }

      onOpenChange(nextOpen)
    },
    [onOpenChange, requestConfirmation, resetFormState, startTransition]
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

  const handleToggleAccess = useCallback(
    (enabled: boolean) => {
      if (!user) {
        return
      }

      disableAction.setDisabled(user, !enabled)
    },
    [disableAction, user]
  )

  const isBusy = isPending || disableAction.isPending

  const emailDisabled = isBusy || isEditing
  const emailDisabledReason = getEmailDisabledReason(isBusy, isEditing)

  const roleDisabled = isBusy || editingSelf
  const roleDisabledReason = getRoleDisabledReason(isBusy, editingSelf)

  const submitDisabled = isBusy
  const submitDisabledReason = getSubmitDisabledReason(isBusy)

  const deleteDisabled = isBusy || user?.id === currentUserId
  const deleteDisabledReason = getDeleteDisabledReason(
    isBusy,
    deleteDisabled
  )

  const accessToggleDisabled = isBusy || editingSelf
  const accessToggleDisabledReason = accessToggleDisabled
    ? isBusy
      ? PENDING_REASON
      : SELF_DISABLE_RESTRICTION
    : null

  return {
    form,
    isEditing,
    isPending: isBusy,
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
    accessEnabled,
    accessToggleDisabled,
    accessToggleDisabledReason,
    handleToggleAccess,
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
