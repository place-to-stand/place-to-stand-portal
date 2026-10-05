import type { TransitionStartFunction } from 'react'
import type { UseFormReturn } from 'react-hook-form'

import type { useToast } from '@/components/ui/use-toast'
import type { useUnsavedChangesWarning } from '@/lib/hooks/use-unsaved-changes-warning'

import type { ClientRow } from '../client-sheet-utils'
import type { CloserKind } from '../closers'
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
  /** Set on linked contacts only: the client's primary contact. */
  isPrimary?: boolean
}

/** A contact available as an external origination source (IC referrer). */
export type OriginationContactOption = {
  id: string
  name: string | null
  email: string
}

/** An admin user available as an internal origination partner or closer. */
export type PartnerUserOption = {
  id: string
  fullName: string | null
  email: string
  /** Set when the admin can no longer sign in; resolvable for display, never offered. */
  disabledAt?: string | null
}

/** An admin or contact the closer picker offers. */
export type CloserCandidate = {
  kind: CloserKind
  id: string
  name: string
  email: string | null
}

/** A closer row being edited; the share stays text until save. */
export type CloserDraft = CloserCandidate & {
  shareText: string
}

export type UseClientSheetStateArgs = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: () => void
  onArchived?: () => void
  /** Name prefill for the create sheet (create-from-picker). */
  initialName?: string
  /** Fires once with the new client after a successful create (not on edit). */
  onCreated?: (client: { id: string; name: string; slug: string }) => void
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
  /** Open the contact create sheet on top, prefilled with the typed query. */
  handleCreateContact: (query: string) => void
  handleCreateOriginationContact: (query: string) => void
  handleCreateCloserContact: (query: string) => void
  handleRemoveContact: (contact: ClientContactOption) => void
  /** Linked contact addressed by default on invoice emails; at most one. */
  primaryContactId: string | null
  /** Make this contact primary, or clear it if it already is. */
  handleTogglePrimaryContact: (contact: ClientContactOption) => void
  // Origination
  selectedOriginationUser: PartnerUserOption | null
  selectedOriginationContact: OriginationContactOption | null
  availableOriginationUsers: PartnerUserOption[]
  availableOriginationContacts: OriginationContactOption[]
  isOriginationPickerOpen: boolean
  originationPickerDisabled: boolean
  originationPickerDisabledReason: string | null
  handleOriginationPickerOpenChange: (open: boolean) => void
  handleSelectOriginationUser: (user: PartnerUserOption) => void
  handleSelectOriginationContact: (contact: OriginationContactOption) => void
  handleClearOrigination: () => void
  // Closers
  closers: CloserDraft[]
  availableCloserUsers: CloserCandidate[]
  availableCloserContacts: CloserCandidate[]
  /** Sum of the typed shares; null while one isn't a number. */
  closerShareTotal: number | null
  isCloserPickerOpen: boolean
  closerPickerDisabled: boolean
  closerPickerDisabledReason: string | null
  closerError: string | null
  /** True when closers or origination differ from the saved assignment. */
  commissionDirty: boolean
  handleCloserPickerOpenChange: (open: boolean) => void
  handleAddCloser: (candidate: CloserCandidate) => void
  handleRemoveCloser: (key: string) => void
  handleCloserShareChange: (key: string, shareText: string) => void
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
  /** Open the contact create sheet on top, prefilled with the typed query. */
  handleCreateContact: (query: string) => void
  handleCreateOriginationContact: (query: string) => void
  handleCreateCloserContact: (query: string) => void
  handleRemoveContact: (contact: ClientContactOption) => void
  /** Linked contact addressed by default on invoice emails; at most one. */
  primaryContactId: string | null
  /** Make this contact primary, or clear it if it already is. */
  handleTogglePrimaryContact: (contact: ClientContactOption) => void
  // Origination
  selectedOriginationUser: PartnerUserOption | null
  selectedOriginationContact: OriginationContactOption | null
  availableOriginationUsers: PartnerUserOption[]
  availableOriginationContacts: OriginationContactOption[]
  isOriginationPickerOpen: boolean
  originationPickerDisabled: boolean
  originationPickerDisabledReason: string | null
  handleOriginationPickerOpenChange: (open: boolean) => void
  handleSelectOriginationUser: (user: PartnerUserOption) => void
  handleSelectOriginationContact: (contact: OriginationContactOption) => void
  handleClearOrigination: () => void
  // Closers
  closers: CloserDraft[]
  availableCloserUsers: CloserCandidate[]
  availableCloserContacts: CloserCandidate[]
  /** Sum of the typed shares; null while one isn't a number. */
  closerShareTotal: number | null
  isCloserPickerOpen: boolean
  closerPickerDisabled: boolean
  closerPickerDisabledReason: string | null
  closerError: string | null
  /** True when closers or origination differ from the saved assignment. */
  commissionDirty: boolean
  handleCloserPickerOpenChange: (open: boolean) => void
  handleAddCloser: (candidate: CloserCandidate) => void
  handleRemoveCloser: (key: string) => void
  handleCloserShareChange: (key: string, shareText: string) => void
}
