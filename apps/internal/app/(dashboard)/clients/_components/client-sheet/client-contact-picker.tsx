'use client'

import { useState } from 'react'
import { Plus, Star, User, UserCheck, X } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { EmptyState } from '@pts/ui/empty-state'
import {
  SheetRecordList,
  SheetRecordRow,
} from '@/components/sheets/sheet-record-row'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@pts/ui/popover'
import { RowActionButton } from '@pts/ui/row-action-button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@pts/ui/tooltip'
import { cn } from '@/lib/utils'

type ClientContactOption = {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  hasPortalAccess: boolean
  companyId?: string | null
}

function PortalAccessMark() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span aria-label='Has portal access'>
          <UserCheck className='text-success h-3 w-3' />
        </span>
      </TooltipTrigger>
      <TooltipContent>Has portal access</TooltipContent>
    </Tooltip>
  )
}

export type ClientContactLinkButtonProps = {
  availableContacts: ClientContactOption[]
  /** The client's company: its people are listed first. */
  companyId: string | null
  disabled: boolean
  disabledReason: string | null
  isPickerOpen: boolean
  isPending: boolean
  onPickerOpenChange: (open: boolean) => void
  onAddContact: (contact: ClientContactOption) => void
}

/**
 * The "Add person" picker on the Portal access section: the company's people
 * first, then anyone else (an outside accountant, say). Adding someone here
 * doesn't add them to the company.
 */
export function ClientContactLinkButton({
  availableContacts,
  companyId,
  disabled,
  disabledReason,
  isPickerOpen,
  isPending,
  onPickerOpenChange,
  onAddContact,
}: ClientContactLinkButtonProps) {
  const [query, setQuery] = useState('')

  return (
    <Popover open={isPickerOpen} onOpenChange={onPickerOpenChange} modal>
      <DisabledFieldTooltip
        disabled={disabled}
        reason={disabledReason}
        className='w-auto'
      >
        <PopoverTrigger asChild>
          <Button type='button' variant='outline' size='xs' disabled={disabled}>
            <Plus />
            Add person
          </Button>
        </PopoverTrigger>
      </DisabledFieldTooltip>
      <PopoverContent className='w-72 p-0' align='end'>
        <Command>
          <CommandInput
            placeholder='Search people…'
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>No one found.</CommandEmpty>
            {[
              {
                heading: 'At this company',
                people: availableContacts.filter(
                  c => companyId && c.companyId === companyId
                ),
              },
              {
                heading: companyId ? 'Other people' : 'People',
                people: availableContacts.filter(
                  c => !companyId || c.companyId !== companyId
                ),
              },
            ]
              .filter(group => group.people.length > 0)
              .map(group => (
                <CommandGroup key={group.heading} heading={group.heading}>
                  {group.people.map(contact => (
                    <CommandItem
                      key={contact.id}
                      value={`${contact.name ?? ''} ${contact.email}`}
                      onSelect={() => {
                        if (isPending) {
                          return
                        }
                        onAddContact(contact)
                      }}
                    >
                      <div className='flex flex-col'>
                        <span className='flex items-center gap-1.5 font-medium'>
                          {contact.name ?? contact.email}
                          {contact.hasPortalAccess ? (
                            <PortalAccessMark />
                          ) : null}
                        </span>
                        {contact.name ? (
                          <span className='text-muted-foreground text-xs'>
                            {contact.email}
                          </span>
                        ) : null}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export type ClientContactListProps = {
  selectedContacts: ClientContactOption[]
  isPending: boolean
  pendingReason: string
  onRequestRemoval: (contact: ClientContactOption) => void
  primaryContactId: string | null
  onTogglePrimary: (contact: ClientContactOption) => void
  /** Empty state: opens the same picker as the header's "Add person". */
  onRequestLink: () => void
  linkDisabled: boolean
  linkDisabledReason: string | null
}

/**
 * The Portal access people, one row each, with the primary star and the unlink
 * control on the right.
 */
export function ClientContactList({
  selectedContacts,
  isPending,
  pendingReason,
  onRequestRemoval,
  primaryContactId,
  onTogglePrimary,
  onRequestLink,
  linkDisabled,
  linkDisabledReason,
}: ClientContactListProps) {
  if (selectedContacts.length === 0) {
    return (
      <DisabledFieldTooltip disabled={linkDisabled} reason={linkDisabledReason}>
        <EmptyState
          message='No one has portal access yet.'
          label='Add person'
          onClick={onRequestLink}
          disabled={linkDisabled}
        />
      </DisabledFieldTooltip>
    )
  }

  return (
    <SheetRecordList>
      {selectedContacts.map(contact => {
        const label = contact.name ?? contact.email
        const isPrimary = contact.id === primaryContactId
        return (
          <SheetRecordRow
            key={contact.id}
            icon={User}
            title={
              <span className='flex items-center gap-1.5'>
                {contact.name ?? contact.email}
                {contact.hasPortalAccess ? <PortalAccessMark /> : null}
              </span>
            }
            description={
              contact.name || contact.phone
                ? [contact.name ? contact.email : null, contact.phone]
                    .filter(Boolean)
                    .join(' · ')
                : null
            }
            actions={
              <>
                <RowActionButton
                  type='button'
                  label={
                    isPrimary ? 'Unset primary contact' : 'Make primary contact'
                  }
                  icon={<Star className={cn(isPrimary && 'fill-current')} />}
                  className={cn(
                    'text-muted-foreground',
                    isPrimary && 'text-warning hover:text-warning'
                  )}
                  onClick={() => onTogglePrimary(contact)}
                  disabled={isPending}
                  aria-pressed={isPrimary}
                />
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
                    onClick={() => onRequestRemoval(contact)}
                  />
                </DisabledFieldTooltip>
              </>
            }
          />
        )
      })}
    </SheetRecordList>
  )
}
