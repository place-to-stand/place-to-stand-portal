'use client'

import { Switch } from '@pts/ui/switch'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'

/** A person on the company's People list, as the Portal switch needs them. */
export type PortalAccessPerson = {
  id: string
  name: string
  email: string | null
  /** Has a sign-in; null when not known yet (someone joining on Save). */
  hasSignIn: boolean | null
  /** Their sign-in is switched off: no access until it's back on. */
  signInDisabled?: boolean
}

/**
 * One person's portal access, for a row on the company's People list or the
 * person sheet's companies: a switch, staged and saved with the sheet. The
 * "Portal" label and the switch's state say it all (no status tooltip).
 * Turning it on for someone with no sign-in gives them one on Save (their
 * email is the sign-in), so a person without an email can't be switched on;
 * the disabled switch says why.
 */
export function PortalAccessControl({
  person,
  hasAccess,
  disabled,
  disabledReason,
  onChange,
  showLabel = true,
}: {
  person: PortalAccessPerson
  hasAccess: boolean
  disabled: boolean
  disabledReason: string | null
  onChange: (on: boolean) => void
  /** Off where the row labels it already ("Portal" beside the field). */
  showLabel?: boolean
}) {
  const noEmail = !person.email?.trim() && person.hasSignIn !== true
  const blocked = noEmail && !hasAccess
  const reason = disabled
    ? disabledReason
    : blocked
      ? `Add an email to ${person.name} first: it is how they sign in.`
      : null

  return (
    <DisabledFieldTooltip
      disabled={disabled || blocked}
      reason={reason}
      className='w-auto'
    >
      <span className='inline-flex items-center gap-1.5'>
        {showLabel ? (
          <span className='text-muted-foreground text-xs'>Portal</span>
        ) : null}
        <Switch
          checked={hasAccess}
          disabled={disabled || blocked}
          aria-label={`Portal access for ${person.name}`}
          onCheckedChange={onChange}
        />
      </span>
    </DisabledFieldTooltip>
  )
}
