'use client'

import { X } from 'lucide-react'

import { RowActionButton } from '@pts/ui/row-action-button'
import { Switch } from '@pts/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@pts/ui/tooltip'
import { ContactRecordRow } from '@/components/sheets/entity-record-rows'
import { SheetRecordList } from '@/components/sheets/sheet-record-row'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'

type ClientContactOption = {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  /** Has a portal user (`contacts.user_id`). */
  hasPortalAccess: boolean
  /** Portal user's sign-in switched off on their person sheet: no access until it's back on. */
  signInDisabled?: boolean
  companyId?: string | null
  /** The company's primary contact (read-only here). */
  isPrimary?: boolean
}



/**
 * Older portal access for people who aren't at the company (from before
 * access lived on the company's people). Remove only: add people on People.
 */
export function PortalAccessOutsiders({
  people,
  isPending,
  pendingReason,
  onRevoke,
}: {
  people: ClientContactOption[]
  isPending: boolean
  pendingReason: string
  onRevoke: (contact: ClientContactOption) => void
}) {
  return (
    <SheetRecordList>
      {people.map(contact => {
        const label = contact.name ?? contact.email ?? 'this person'
        return (
          <ContactRecordRow
            key={contact.id}
            contact={contact}
            note={<span className='text-warning'>Not at this company</span>}
            actions={
              <DisabledFieldTooltip
                disabled={isPending}
                reason={isPending ? pendingReason : null}
                className='w-auto'
              >
                <RowActionButton
                  type='button'
                  label={`Remove ${label}'s portal access`}
                  icon={<X />}
                  className='text-muted-foreground hover:text-destructive'
                  disabled={isPending}
                  onClick={() => onRevoke(contact)}
                />
              </DisabledFieldTooltip>
            }
          />
        )
      })}
    </SheetRecordList>
  )
}

/**
 * One person's portal access, for a row on the company's People list: a
 * switch, staged and saved with the sheet. It takes effect while they can
 * sign in (their sign-in is set on their own sheet).
 */
export function PortalAccessControl({
  contact,
  hasAccess,
  isPending,
  pendingReason,
  onGrant,
  onRevoke,
}: {
  contact: ClientContactOption
  hasAccess: boolean
  isPending: boolean
  pendingReason: string
  onGrant: (contact: ClientContactOption) => void
  onRevoke: (contact: ClientContactOption) => void
}) {
  const label = contact.name ?? contact.email ?? 'this person'
  const status = !contact.hasPortalAccess
    ? hasAccess
      ? 'Has portal access once they can sign in'
      : 'Can’t sign in yet'
    : contact.signInDisabled
      ? 'Their sign-in is off: no access until it’s back on'
      : hasAccess
        ? 'Can see this client in the portal'
        : 'Can’t see this client in the portal'

  return (
    <DisabledFieldTooltip
      disabled={isPending}
      reason={isPending ? pendingReason : null}
      className='w-auto'
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <span className='inline-flex items-center gap-1.5 px-1.5'>
            <span className='text-muted-foreground text-xs'>Portal</span>
            <Switch
              checked={hasAccess}
              disabled={isPending}
              aria-label={`Portal access for ${label}`}
              onCheckedChange={checked =>
                checked ? onGrant(contact) : onRevoke(contact)
              }
            />
          </span>
        </TooltipTrigger>
        <TooltipContent>{status}</TooltipContent>
      </Tooltip>
    </DisabledFieldTooltip>
  )
}
