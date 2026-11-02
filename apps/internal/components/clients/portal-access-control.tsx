'use client'

import { Switch } from '@pts/ui/switch'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import {
  canHavePortalAccess,
  portalAccessLockedReason,
} from '@/lib/settings/contacts/portal-eligibility'

/** A person on the company's People list, as the Portal switch needs them. */
export type PortalAccessPerson = {
  id: string
  name: string
  email: string | null
  /** Has a sign-in; null when not known yet (someone joining on Save). */
  hasSignIn: boolean | null
  /** Their sign-in is switched off: no access until it's back on. */
  signInDisabled?: boolean
  /** Their sign-in's role: only a Client sign-in has portal access. */
  signInRole?: 'ADMIN' | 'SALES' | 'CLIENT' | null
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
  // The one rule (canHavePortalAccess): a live Client sign-in. Without one
  // the switch shows off and locked; a stored "on" isn't cleared.
  const blocked = !canHavePortalAccess({
    exists: person.hasSignIn === true,
    enabled: !person.signInDisabled,
    role: person.signInRole,
  })
  const reason = disabled
    ? disabledReason
    : blocked
      ? portalAccessLockedReason(person.name)
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
          checked={hasAccess && !blocked}
          disabled={disabled || blocked}
          aria-label={`Portal access for ${person.name}`}
          onCheckedChange={onChange}
        />
      </span>
    </DisabledFieldTooltip>
  )
}
