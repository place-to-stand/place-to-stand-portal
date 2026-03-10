import type { InvoiceWithClient } from './invoice-form'
import type { ClientOption } from './invoice-options'

export type FieldState = {
  disabled: boolean
  reason: string | null
}

export type SubmitButtonState = {
  disabled: boolean
  reason: string | null
  label: string
}

export type DeleteButtonState = {
  disabled: boolean
  reason: string | null
}

export const PENDING_REASON = 'Please wait for the current request to finish.'
export const MISSING_CLIENT_REASON =
  'Create a client before creating invoices.'
export const NON_EDITABLE_REASON = 'This invoice cannot be edited.'

const EDITABLE_STATUSES = new Set(['DRAFT', 'SENT'])

const SUBMIT_LABELS = {
  creating: 'Create invoice',
  updating: 'Save changes',
  pending: 'Saving...',
} as const

// ---------------------------------------------------------------------------
// Invoice editability
// ---------------------------------------------------------------------------

export function isInvoiceEditable(status: string | null): boolean {
  if (!status) return true // new invoice
  return EDITABLE_STATUSES.has(status)
}

// ---------------------------------------------------------------------------
// Field states
// ---------------------------------------------------------------------------

export const deriveClientFieldState = (
  isPending: boolean,
  clientOptions: ClientOption[],
  status: string | null
): FieldState => {
  if (!isInvoiceEditable(status)) {
    return { disabled: true, reason: NON_EDITABLE_REASON }
  }

  const disabled = isPending || clientOptions.length === 0
  const reason = disabled
    ? isPending
      ? PENDING_REASON
      : clientOptions.length === 0
        ? MISSING_CLIENT_REASON
        : null
    : null

  return { disabled, reason }
}

export const deriveStandardFieldState = (
  isPending: boolean,
  status: string | null
): FieldState => {
  if (!isInvoiceEditable(status)) {
    return { disabled: true, reason: NON_EDITABLE_REASON }
  }

  return {
    disabled: isPending,
    reason: isPending ? PENDING_REASON : null,
  }
}

// ---------------------------------------------------------------------------
// Button states
// ---------------------------------------------------------------------------

export const deriveSubmitButtonState = (
  isPending: boolean,
  isEditing: boolean,
  clientOptions: ClientOption[],
  status: string | null
): SubmitButtonState => {
  if (!isInvoiceEditable(status)) {
    return {
      disabled: true,
      reason: NON_EDITABLE_REASON,
      label: SUBMIT_LABELS.updating,
    }
  }

  const hasClients = clientOptions.length > 0 || isEditing
  const disabled = isPending || !hasClients
  let reason: string | null = null

  if (disabled) {
    reason = isPending
      ? PENDING_REASON
      : hasClients
        ? null
        : MISSING_CLIENT_REASON
  }

  let label: string = SUBMIT_LABELS.creating
  if (isPending) {
    label = SUBMIT_LABELS.pending
  } else if (isEditing) {
    label = SUBMIT_LABELS.updating
  }

  return { disabled, reason, label }
}

export const deriveDeleteButtonState = (
  isEditing: boolean,
  isPending: boolean,
  invoice: InvoiceWithClient | null
): DeleteButtonState => {
  if (!isEditing) {
    return { disabled: true, reason: null }
  }

  const disabled = isPending || Boolean(invoice?.deleted_at)
  const reason = disabled
    ? isPending
      ? PENDING_REASON
      : invoice?.deleted_at
        ? 'This invoice is already deleted.'
        : null
    : null

  return { disabled, reason }
}
