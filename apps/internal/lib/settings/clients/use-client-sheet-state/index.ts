'use client'

import { useState, useTransition } from 'react'

import { useToast } from '@/components/ui/use-toast'

import { PENDING_REASON } from '../client-sheet-constants'

import { useClientDeletionState } from './delete-state'
import { useClientSheetFormState } from './form-state'
import type {
  UseClientSheetStateArgs,
  UseClientSheetStateReturn,
} from './types'

export const useClientSheetState = ({
  open,
  onOpenChange,
  onComplete,
  onArchived,
  client,
  allContacts,
  clientContacts,
}: UseClientSheetStateArgs): UseClientSheetStateReturn => {
  const isEditing = Boolean(client)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  const formState = useClientSheetFormState({
    open,
    onOpenChange,
    onComplete,
    client,
    allContacts,
    clientContacts,
    isEditing,
    isPending,
    startTransition,
    setFeedback,
    toast,
  })

  const deletionState = useClientDeletionState({
    client,
    isPending,
    startTransition,
    setFeedback,
    onOpenChange,
    onComplete,
    onArchived,
    toast,
  })

  const clientDisplayName = client?.name ?? 'this client'

  return {
    form: formState.form,
    isEditing,
    feedback,
    isPending,
    submitDisabled: formState.submitDisabled,
    submitDisabledReason: formState.submitDisabledReason,
    deleteDisabled: deletionState.deleteDisabled,
    deleteDisabledReason: deletionState.deleteDisabledReason,
    clientDisplayName,
    sheetTitle: isEditing ? 'Edit client' : 'Add client',
    sheetDescription: isEditing
      ? 'Adjust display details or delete the organization.'
      : 'Register a client so projects and reporting stay organized.',
    pendingReason: PENDING_REASON,
    isDeleteDialogOpen: deletionState.isDeleteDialogOpen,
    unsavedChangesDialog: formState.unsavedChangesDialog,
    handleSheetOpenChange: formState.handleSheetOpenChange,
    handleFormSubmit: formState.handleFormSubmit,
    handleRequestDelete: deletionState.handleRequestDelete,
    handleCancelDelete: deletionState.handleCancelDelete,
    handleConfirmDelete: deletionState.handleConfirmDelete,
    // Contacts
    availableContacts: formState.availableContacts,
    selectedContacts: formState.selectedContacts,
    isContactPickerOpen: formState.isContactPickerOpen,
    contactsAddButtonDisabled: formState.contactsAddButtonDisabled,
    contactsAddButtonDisabledReason: formState.contactsAddButtonDisabledReason,
    isLoadingContacts: formState.isLoadingContacts,
    handleContactPickerOpenChange: formState.handleContactPickerOpenChange,
    handleAddContact: formState.handleAddContact,
    handleRemoveContact: formState.handleRemoveContact,
    // Referral
    selectedReferral: formState.selectedReferral,
    availableReferralContacts: formState.availableReferralContacts,
    isReferralPickerOpen: formState.isReferralPickerOpen,
    referralPickerDisabled: formState.referralPickerDisabled,
    referralPickerDisabledReason: formState.referralPickerDisabledReason,
    handleReferralPickerOpenChange: formState.handleReferralPickerOpenChange,
    handleSelectReferral: formState.handleSelectReferral,
    handleClearReferral: formState.handleClearReferral,
  }
}

export type {
  UseClientSheetStateArgs,
  UseClientSheetStateReturn,
  ClientContactOption,
  ReferralContactOption,
} from './types'
