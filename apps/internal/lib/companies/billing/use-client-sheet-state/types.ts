import type { UseFormReturn } from 'react-hook-form'

import type { CompanyBillingFields } from '@/lib/companies/sheet-save-schema'

import type { ClientWithClosers } from '../client-sheet-utils'
import type { CloserKind } from '../closers'
import type { ClientSheetFormValues } from '../client-sheet-schema'

export type ClientContactOption = {
  id: string
  /** The contact's company, when known. */
  companyId?: string | null
  name: string | null
  email: string | null
  phone: string | null
  hasPortalAccess: boolean
  /** Login switched off on their person sheet: no access until it's back on. */
  signInDisabled?: boolean
  /** Their company's primary contact (set on the company). */
  isPrimary?: boolean
  /** They have a photo; the pickers show it, else initials. */
  hasPhoto?: boolean
}

/** A contact available as an external origination source (IC referrer). */
export type OriginationContactOption = {
  id: string
  name: string | null
  email: string | null
  /** They have a photo; the picker shows it, else initials. */
  hasPhoto?: boolean
}

/** An admin user available as an internal origination partner or closer. */
export type PartnerUserOption = {
  id: string
  fullName: string | null
  email: string
  /** Set when the admin can no longer sign in; resolvable for display, never offered. */
  disabledAt?: string | null
  /** Their person has a photo; the picker shows it, else initials. */
  hasPhoto?: boolean
}

/** An admin or contact the closer picker offers. */
export type CloserCandidate = {
  kind: CloserKind
  id: string
  name: string
  email: string | null
  /** They have a photo; the picker shows it, else initials. */
  hasPhoto?: boolean
}

/** A closer row being edited; the share stays text until save. */
export type CloserDraft = CloserCandidate & {
  shareText: string
}

export type UseClientBillingFormArgs = {
  /** The sheet is open: loads the pickers' people and resets on reopen. */
  open: boolean
  /** The company's live client; null for a blank form (start billing). */
  client: ClientWithClosers | null
  /** The company sheet is saving: pickers and fields lock. */
  isPending: boolean
}

/**
 * The billing section's form: billing type and state, origination and closers.
 * It never saves itself: the company sheet's Save reads it with
 * `collectFields` and writes it in the same transaction as the company.
 */
export type UseClientBillingFormReturn = {
  form: UseFormReturn<ClientSheetFormValues>
  /** Fields or commission differ from what was loaded. */
  hasUnsavedChanges: boolean
  isPending: boolean
  pendingReason: string
  /**
   * The fields for the save, or null (with the error shown in the form)
   * when the closer split doesn't add up.
   */
  collectFields: () => CompanyBillingFields | null
  handleCreateOriginationContact: (query: string) => void
  handleCreateCloserContact: (query: string) => void
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
