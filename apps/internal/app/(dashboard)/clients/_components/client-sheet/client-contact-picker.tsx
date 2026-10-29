'use client'

import { Star, UserCheck, X } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { EmptyState } from '@pts/ui/empty-state'
import { RowActionButton } from '@pts/ui/row-action-button'
import { Switch } from '@pts/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@pts/ui/tooltip'
import { ContactRecordRow } from '@/components/sheets/entity-record-rows'
import { SheetRecordList } from '@/components/sheets/sheet-record-row'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { useSheetParams } from '@/lib/sheets/use-sheet-params'

type ClientContactOption = {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  /** Has a portal login (`contacts.user_id`). */
  hasPortalAccess: boolean
  /** Login switched off on the Users page: no access until it's back on. */
  signInDisabled?: boolean
  companyId?: string | null
  /** The company's primary contact (read-only here). */
  isPrimary?: boolean
}

function PortalLoginMark() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span aria-label='Has a portal user'>
          <UserCheck className='text-success h-3 w-3' />
        </span>
      </TooltipTrigger>
      <TooltipContent>Has a portal user</TooltipContent>
    </Tooltip>
  )
}

function PrimaryNote() {
  return (
    <span className='text-muted-foreground inline-flex items-center gap-1'>
      <Star className='text-warning size-3 fill-current' />
      Primary contact
    </span>
  )
}

export type ClientPortalAccessListProps = {
  /** The client's company; its people are the list. */
  companyId: string | null
  /** Everyone at the company (with or without access). */
  companyPeople: ClientContactOption[]
  /** Who has access now (staged until Save). */
  selectedContacts: ClientContactOption[]
  isPending: boolean
  pendingReason: string
  onGrant: (contact: ClientContactOption) => void
  onRevoke: (contact: ClientContactOption) => void
}

/**
 * Portal access: every person at the client's company, each with a switch.
 * People are added on the company; access is the client's own choice, since
 * not every company wants everyone in. Changes save with the sheet.
 * Access rows for anyone not at the company (older rows, or the client was
 * unlinked) are listed after, flagged, with remove only.
 */
export function ClientPortalAccessList({
  companyId,
  companyPeople,
  selectedContacts,
  isPending,
  pendingReason,
  onGrant,
  onRevoke,
}: ClientPortalAccessListProps) {
  const { open } = useSheetParams()
  const selectedIds = new Set(selectedContacts.map(contact => contact.id))
  const companyIds = new Set(companyPeople.map(contact => contact.id))
  const outsiders = selectedContacts.filter(
    contact => !companyIds.has(contact.id)
  )

  if (companyPeople.length === 0 && outsiders.length === 0) {
    return companyId ? (
      <EmptyState
        message='No contacts at this company yet. Add them on the company.'
        label='Open company'
        onClick={() => open('company', companyId)}
      />
    ) : (
      <EmptyState message='Link a company first: its contacts are listed here.' />
    )
  }

  return (
    <SheetRecordList>
      {companyPeople.map(contact => {
        const label = contact.name ?? contact.email ?? 'this contact'
        const hasAccess = selectedIds.has(contact.id)
        return (
          <ContactRecordRow
            key={contact.id}
            contact={contact}
            titleAddon={contact.hasPortalAccess ? <PortalLoginMark /> : null}
            note={
              contact.signInDisabled ? (
                <span className='text-warning'>
                  Sign-in off (Users page): no access until it&apos;s back on
                </span>
              ) : contact.isPrimary ? (
                <PrimaryNote />
              ) : contact.hasPortalAccess ? undefined : (
                'No portal user'
              )
            }
            actions={
              // Access needs a login; the contact sheet creates one.
              !contact.hasPortalAccess && !hasAccess ? (
                <Button
                  type='button'
                  variant='outline'
                  size='xs'
                  disabled={isPending}
                  onClick={() => open('contact', contact.id)}
                >
                  Create user
                </Button>
              ) : (
                <DisabledFieldTooltip
                  disabled={isPending}
                  reason={isPending ? pendingReason : null}
                  className='w-auto'
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className='inline-flex px-1.5'>
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
                    <TooltipContent>
                      {hasAccess ? 'Has portal access' : 'No portal access'}
                    </TooltipContent>
                  </Tooltip>
                </DisabledFieldTooltip>
              )
            }
          />
        )
      })}
      {outsiders.map(contact => {
        const label = contact.name ?? contact.email ?? 'this contact'
        return (
          <ContactRecordRow
            key={contact.id}
            contact={contact}
            titleAddon={contact.hasPortalAccess ? <PortalLoginMark /> : null}
            note={
              <span className='text-warning'>
                {companyId ? 'Not at this company' : 'No linked company'}
              </span>
            }
            actions={
              <DisabledFieldTooltip
                disabled={isPending}
                reason={isPending ? pendingReason : null}
                className='w-auto'
              >
                <RowActionButton
                  type='button'
                  label={`Remove ${label} from Portal access`}
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
