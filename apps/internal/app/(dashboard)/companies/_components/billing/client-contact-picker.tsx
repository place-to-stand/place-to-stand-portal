'use client'

import { Switch } from '@pts/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@pts/ui/tooltip'
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
 * One person's portal access, for a row on the company's People list: a
 * switch, staged and saved with the sheet. Turning it on for someone with no
 * sign-in gives them one on Save (their email is the sign-in), so a person
 * without an email can't be switched on.
 */
export function PortalAccessControl({
  person,
  hasAccess,
  disabled,
  disabledReason,
  onChange,
}: {
  person: PortalAccessPerson
  hasAccess: boolean
  disabled: boolean
  disabledReason: string | null
  onChange: (on: boolean) => void
}) {
  const noEmail = !person.email?.trim() && person.hasSignIn !== true
  const blocked = noEmail && !hasAccess
  const status = blocked
    ? `Add an email to ${person.name} first: it is how they sign in.`
    : person.hasSignIn === false
      ? hasAccess
        ? 'Gets a sign-in on save and sees this client in the portal'
        : 'Switch on to give them a sign-in on save'
      : person.signInDisabled
        ? 'Their sign-in is off: no access until it’s back on'
        : hasAccess
          ? person.hasSignIn === null
            ? 'Sees this client in the portal after save'
            : 'Can see this client in the portal'
          : 'Can’t see this client in the portal'

  return (
    <DisabledFieldTooltip
      disabled={disabled}
      reason={disabled ? disabledReason : null}
      className='w-auto'
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <span className='inline-flex items-center gap-1.5 px-1.5'>
            <span className='text-muted-foreground text-xs'>Portal</span>
            <Switch
              checked={hasAccess}
              disabled={disabled || blocked}
              aria-label={`Portal access for ${person.name}`}
              onCheckedChange={onChange}
            />
          </span>
        </TooltipTrigger>
        <TooltipContent>{status}</TooltipContent>
      </Tooltip>
    </DisabledFieldTooltip>
  )
}
