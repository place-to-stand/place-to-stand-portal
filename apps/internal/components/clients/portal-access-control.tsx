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
 * Only someone who can already sign in can be switched on: sign-ins are made
 * on the person sheet (Can sign in), never as a side effect here. The
 * disabled switch says why.
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
  // No sign-in yet (or not known yet: joining on Save): none is made here.
  const blocked = person.hasSignIn !== true && !hasAccess
  const reason = disabled
    ? disabledReason
    : blocked
      ? `${person.name} can’t sign in yet. Turn on Can sign in on their person sheet first.`
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
