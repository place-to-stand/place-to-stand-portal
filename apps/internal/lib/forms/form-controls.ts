/**
 * Shared copy and labelling for form action chrome — the submit button and the
 * "why is this disabled" tooltip that every sheet, table row, and dialog
 * shows while a mutation is in flight.
 *
 * These lived as 15 separate declarations of the same sentence and 6 separate
 * implementations of the same label logic, which is how the wording drifted
 * ("...request to finish" vs "...action to complete") and how sheets ended up
 * announcing "Saving..." for work that wasn't a save.
 */

/** Tooltip for a control disabled only because a request is in flight. */
export const PENDING_REASON = 'Please wait for the current request to finish.'

export type SubmitLabelArgs = {
  /**
   * A save is genuinely in flight. Only ever pass the save/delete transition
   * here — a form reset or an open-time fetch is not a save, and a button
   * that says "Saving..." during one is lying about what it's doing.
   */
  isSaving: boolean
  isEditing: boolean
  /** Label for the create action, e.g. 'Create task'. */
  createLabel: string
  /** Label for the edit action. */
  updateLabel?: string
}

/**
 * The submit button's label. In-flight wording distinguishes creating from
 * saving, so the button describes the operation the user actually started.
 */
export const getSubmitLabel = ({
  isSaving,
  isEditing,
  createLabel,
  updateLabel = 'Save changes',
}: SubmitLabelArgs): string => {
  if (isSaving) {
    return isEditing ? 'Saving...' : 'Creating...'
  }

  return isEditing ? updateLabel : createLabel
}

/**
 * The reason a control is disabled, or null when it isn't. `pending` is
 * checked first: an in-flight request explains the disabled state no matter
 * what other restriction also applies.
 */
export const getDisabledReason = ({
  pending,
  restriction = null,
}: {
  pending: boolean
  /** A non-transient reason, e.g. 'You cannot delete your own account.' */
  restriction?: string | null
}): string | null => {
  if (pending) return PENDING_REASON
  return restriction
}
