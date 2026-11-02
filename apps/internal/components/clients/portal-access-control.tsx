'use client'

import { Button } from '@pts/ui/button'
import { Switch } from '@pts/ui/switch'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { canHavePortalAccess } from '@/lib/settings/contacts/portal-eligibility'

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
 * The Portal access switch, the same on the company sheet's People cards and
 * the person sheet's company cards. Without a live Client sign-in it shows
 * off and locked (a stored "on" isn't cleared), with one muted line under
 * it and the way to fix it (`action`). A switch locked only while saving
 * explains itself with the usual tooltip.
 */
export function PortalAccessField({
  checked,
  canHaveAccess,
  onChange,
  ariaLabel,
  disabled = false,
  disabledReason = null,
  action,
}: {
  checked: boolean
  /** A live Client sign-in (`canHavePortalAccess`). */
  canHaveAccess: boolean
  onChange: (on: boolean) => void
  ariaLabel: string
  /** Locked for another reason (saving): the tooltip says why. */
  disabled?: boolean
  disabledReason?: string | null
  /** The way to a sign-in: "Set up sign-in", "Open person". */
  action?: { label: string; onClick: () => void } | null
}) {
  return (
    <div className='flex flex-col items-start gap-2'>
      <DisabledFieldTooltip
        disabled={disabled}
        reason={disabledReason}
        className='w-auto'
      >
        <Switch
          checked={checked && canHaveAccess}
          disabled={disabled || !canHaveAccess}
          aria-label={ariaLabel}
          onCheckedChange={onChange}
        />
      </DisabledFieldTooltip>
      {canHaveAccess ? null : (
        <p className='text-muted-foreground text-xs'>
          Needs a client sign-in.
          {action ? (
            <>
              {' '}
              <Button
                type='button'
                variant='link'
                className='h-auto p-0 text-xs'
                onClick={action.onClick}
              >
                {action.label}
              </Button>
            </>
          ) : null}
        </p>
      )}
    </div>
  )
}

/** One person's portal access on the company sheet's People cards. */
export function PortalAccessControl({
  person,
  hasAccess,
  disabled,
  disabledReason,
  onChange,
  onOpenPerson,
}: {
  person: PortalAccessPerson
  hasAccess: boolean
  disabled: boolean
  disabledReason: string | null
  onChange: (on: boolean) => void
  /** Opens their person sheet, where the sign-in is set up. */
  onOpenPerson?: () => void
}) {
  return (
    <PortalAccessField
      checked={hasAccess}
      canHaveAccess={canHavePortalAccess({
        exists: person.hasSignIn === true,
        enabled: !person.signInDisabled,
        role: person.signInRole,
      })}
      onChange={onChange}
      ariaLabel={`Portal access for ${person.name}`}
      disabled={disabled}
      disabledReason={disabledReason}
      action={
        onOpenPerson ? { label: 'Open person', onClick: onOpenPerson } : null
      }
    />
  )
}
