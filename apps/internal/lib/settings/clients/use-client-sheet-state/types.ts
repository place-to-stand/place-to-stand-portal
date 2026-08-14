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

// Imported from the shared origination module so the client and lead sheets
// consume ONE definition of these shapes (PRD 005 C13), and re-exported because
// existing client-side call sites import them from here.
import type {
  OriginationContactOption,
  OriginationMode,
  PartnerUserOption,
} from '@/components/origination/types'

export type {
  OriginationContactOption,
  OriginationMode,
  PartnerUserOption,
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
  /** All admin users for origination + closer pickers (optional - will be fetched if not provided) */
  allAdminUsers?: PartnerUserOption[]
}

export type BaseFormState = {
  form: UseFormReturn<ClientSheetFormValues>
  /** A save is in flight — the only flag allowed to render as "Saving...". */
  isSaving: boolean
  /** The save transition, shared with the deletion state. */
  startSave: TransitionStartFunction
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
  // Origination
  originationMode: OriginationMode
  selectedOriginationUser: PartnerUserOption | null
  selectedOriginationContact: OriginationContactOption | null
  availableOriginationUsers: PartnerUserOption[]
  availableOriginationContacts: OriginationContactOption[]
  isOriginationUserPickerOpen: boolean
  isOriginationContactPickerOpen: boolean
  originationPickerDisabled: boolean
  originationPickerDisabledReason: string | null
  originationError: string | null
  handleOriginationModeChange: (mode: OriginationMode) => void
  handleOriginationUserPickerOpenChange: (open: boolean) => void
  handleOriginationContactPickerOpenChange: (open: boolean) => void
  handleSelectOriginationUser: (user: PartnerUserOption) => void
  handleSelectOriginationContact: (contact: OriginationContactOption) => void
  handleClearOrigination: () => void
  // Closer
  selectedCloser: PartnerUserOption | null
  availableClosers: PartnerUserOption[]
  isCloserPickerOpen: boolean
  closerPickerDisabled: boolean
  closerPickerDisabledReason: string | null
  closerError: string | null
  handleCloserPickerOpenChange: (open: boolean) => void
  handleSelectCloser: (user: PartnerUserOption) => void
  handleClearCloser: () => void
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
  setFeedback: (value: string | null) => void
  toast: ToastFn
  allContacts?: ClientContactOption[]
  clientContacts?: ClientContactOption[]
  allAdminUsers?: PartnerUserOption[]
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
  // Origination
  originationMode: OriginationMode
  selectedOriginationUser: PartnerUserOption | null
  selectedOriginationContact: OriginationContactOption | null
  availableOriginationUsers: PartnerUserOption[]
  availableOriginationContacts: OriginationContactOption[]
  isOriginationUserPickerOpen: boolean
  isOriginationContactPickerOpen: boolean
  originationPickerDisabled: boolean
  originationPickerDisabledReason: string | null
  originationError: string | null
  handleOriginationModeChange: (mode: OriginationMode) => void
  handleOriginationUserPickerOpenChange: (open: boolean) => void
  handleOriginationContactPickerOpenChange: (open: boolean) => void
  handleSelectOriginationUser: (user: PartnerUserOption) => void
  handleSelectOriginationContact: (contact: OriginationContactOption) => void
  handleClearOrigination: () => void
  // Closer
  selectedCloser: PartnerUserOption | null
  availableClosers: PartnerUserOption[]
  isCloserPickerOpen: boolean
  closerPickerDisabled: boolean
  closerPickerDisabledReason: string | null
  closerError: string | null
  handleCloserPickerOpenChange: (open: boolean) => void
  handleSelectCloser: (user: PartnerUserOption) => void
  handleClearCloser: () => void
}
