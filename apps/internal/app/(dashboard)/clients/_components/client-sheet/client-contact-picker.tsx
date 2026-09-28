'use client'

import { useState } from 'react'
import { Plus, Star, UserCheck, X } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { CommandCreateRows } from '@/components/ui/command-create-rows'
import { EmptyState } from '@pts/ui/empty-state'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import {
  Command,
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
  email: string
  phone: string | null
  hasPortalAccess: boolean
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
  disabled: boolean
  disabledReason: string | null
  isPickerOpen: boolean
  isPending: boolean
  onPickerOpenChange: (open: boolean) => void
  onAddContact: (contact: ClientContactOption) => void
  /** Open the contact create sheet, prefilled with the typed query. */
  onCreateContact: (query: string) => void
}

/** The "Link contact" popover trigger — sits on the Contacts section title row. */
export function ClientContactLinkButton({
  availableContacts,
  disabled,
  disabledReason,
  isPickerOpen,
  isPending,
  onPickerOpenChange,
  onAddContact,
  onCreateContact,
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
            Link contact
          </Button>
        </PopoverTrigger>
      </DisabledFieldTooltip>
      <PopoverContent className='w-72 p-0' align='end'>
        <Command>
          <CommandInput
            placeholder='Search contacts...'
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandGroup heading='Contacts'>
              {availableContacts.map(contact => (
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
                      {contact.hasPortalAccess ? <PortalAccessMark /> : null}
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
            <CommandCreateRows
              query={query}
              entityLabel='contact'
              onCreate={onCreateContact}
            />
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
  /** Empty state: opens the same picker as the header's "Link contact". */
  onRequestLink: () => void
  linkDisabled: boolean
  linkDisabledReason: string | null
}

/**
 * The linked contacts, one row each, with the primary star and the unlink
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
          message='No contacts linked yet.'
          label='Link contact'
          onClick={onRequestLink}
          disabled={linkDisabled}
        />
      </DisabledFieldTooltip>
    )
  }

  return (
    <div className='flex flex-col gap-2'>
      {selectedContacts.map(contact => {
        const label = contact.name ?? contact.email
        const isPrimary = contact.id === primaryContactId
        return (
          <div
            key={contact.id}
            className='bg-muted/40 flex items-center justify-between gap-3 rounded-md border py-1.5 pr-1.5 pl-3'
          >
            <div className='flex min-w-0 flex-col text-sm leading-tight'>
              <span className='flex items-center gap-1.5 font-medium'>
                {contact.name ?? contact.email}
                {contact.hasPortalAccess ? <PortalAccessMark /> : null}
              </span>
              {contact.name || contact.phone ? (
                <span className='text-muted-foreground truncate text-xs'>
                  {[contact.name ? contact.email : null, contact.phone]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              ) : null}
            </div>
            <div className='flex shrink-0 items-center'>
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
                <Button
                  type='button'
                  variant='ghost'
                  size='icon-sm'
                  className='text-muted-foreground hover:text-destructive'
                  onClick={() => onRequestRemoval(contact)}
                  disabled={isPending}
                  aria-label={`Unlink ${label}`}
                >
                  <X className='h-4 w-4' />
                </Button>
              </DisabledFieldTooltip>
            </div>
          </div>
        )
      })}
    </div>
  )
}
