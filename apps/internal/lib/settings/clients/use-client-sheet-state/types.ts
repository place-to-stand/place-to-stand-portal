import type { TransitionStartFunction } from 'react'
import type { UseFormReturn } from 'react-hook-form'

import type { useToast } from '@/components/ui/use-toast'
import type { useUnsavedChangesWarning } from '@/lib/hooks/use-unsaved-changes-warning'

import type { ClientRow } from '../client-sheet-utils'
import type { ClientSheetFormValues } from '../client-sheet-schema'

type ToastFn = ReturnType<typeof useToast>['toast']
type UnsavedChangesDialog = ReturnType<
  typeof useUnsavedChangesWarning
>['dialog']

export type ClientContactOption = {
  id: string
  name: string | null
  email: string
  phone: string | null
  hasPortalAccess: boolean
}

export type ReferralContactOption = {
  id: string
  name: string | null
  email: string
}

export type UseClientSheetStateArgs = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: () => void
  onArchived?: () => void
  client: ClientRow | null
  /** All available contacts for the contact picker (optional - will be fetched if not provided) */
  allContacts?: ClientContactOption[]
  /** Contacts linked to the client (optional - will be fetched if not provided) */
  clientContacts?: ClientContactOption[]
}

export type BaseFormState = {
  form: UseFormReturn<ClientSheetFormValues>
  submitDisabled: boolean
  submitDisabledReason: string | null
  unsavedChangesDialog: UnsavedChangesDialog
  handleSheetOpenChange: (open: boolean) => void
  handleFormSubmit: (values: ClientSheetFormValues) => void
  // Contacts
  availableContacts: ClientContactOption[]
  selectedContacts: ClientContactOption[]
  isContactPickerOpen: boolean
  contactsAddButtonDisabled: boolean
  contactsAddButtonDisabledReason: string | null
  isLoadingContacts: boolean
  handleContactPickerOpenChange: (open: boolean) => void
  handleAddContact: (contact: ClientContactOption) => void
  handleRemoveContact: (contact: ClientContactOption) => void
  // Referral
  selectedReferral: ReferralContactOption | null
  availableReferralContacts: ReferralContactOption[]
  isReferralPickerOpen: boolean
  referralPickerDisabled: boolean
  referralPickerDisabledReason: string | null
  handleReferralPickerOpenChange: (open: boolean) => void
  handleSelectReferral: (contact: ReferralContactOption) => void
  handleClearReferral: () => void
}

export type DeletionState = {
  isDeleteDialogOpen: boolean
  deleteDisabled: boolean
  deleteDisabledReason: string | null
  handleRequestDelete: () => void
  handleCancelDelete: () => void
  handleConfirmDelete: () => void
}

export type ClientSheetFormStateArgs = UseClientSheetStateArgs & {
  isEditing: boolean
  isPending: boolean
  startTransition: TransitionStartFunction
  setFeedback: (value: string | null) => void
  toast: ToastFn
  allContacts?: ClientContactOption[]
  clientContacts?: ClientContactOption[]
}

export type ClientDeletionStateArgs = {
  client: ClientRow | null
  isPending: boolean
  startTransition: TransitionStartFunction
  setFeedback: (value: string | null) => void
  onOpenChange: (open: boolean) => void
  onComplete: () => void
  onArchived?: () => void
  toast: ToastFn
}

export type UseClientSheetStateReturn = {
  form: UseFormReturn<ClientSheetFormValues>
  isEditing: boolean
  feedback: string | null
  isPending: boolean
  submitDisabled: boolean
  submitDisabledReason: string | null
  deleteDisabled: boolean
  deleteDisabledReason: string | null
  clientDisplayName: string
  sheetTitle: string
  sheetDescription: string
  pendingReason: string
  isDeleteDialogOpen: boolean
  unsavedChangesDialog: UnsavedChangesDialog
  handleSheetOpenChange: (open: boolean) => void
  handleFormSubmit: (values: ClientSheetFormValues) => void
  handleRequestDelete: () => void
  handleCancelDelete: () => void
  handleConfirmDelete: () => void
  // Contacts
  availableContacts: ClientContactOption[]
  selectedContacts: ClientContactOption[]
  isContactPickerOpen: boolean
  contactsAddButtonDisabled: boolean
  contactsAddButtonDisabledReason: string | null
  isLoadingContacts: boolean
  handleContactPickerOpenChange: (open: boolean) => void
  handleAddContact: (contact: ClientContactOption) => void
  handleRemoveContact: (contact: ClientContactOption) => void
  // Referral
  selectedReferral: ReferralContactOption | null
  availableReferralContacts: ReferralContactOption[]
  isReferralPickerOpen: boolean
  referralPickerDisabled: boolean
  referralPickerDisabledReason: string | null
  handleReferralPickerOpenChange: (open: boolean) => void
  handleSelectReferral: (contact: ReferralContactOption) => void
  handleClearReferral: () => void
}
