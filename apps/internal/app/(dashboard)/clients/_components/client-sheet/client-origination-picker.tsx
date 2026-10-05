'use client'

import { useState } from 'react'
import { LinkIcon, User2, X } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@pts/ui/popover'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { CommandCreateRows } from '@/components/ui/command-create-rows'
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'

import type {
  OriginationContactOption,
  PartnerUserOption,
} from '@/lib/settings/clients/use-client-sheet-state'

export type ClientOriginationPickerProps = {
  selectedUser: PartnerUserOption | null
  selectedContact: OriginationContactOption | null
  availableUsers: PartnerUserOption[]
  availableContacts: OriginationContactOption[]
  disabled: boolean
  disabledReason: string | null
  isPickerOpen: boolean
  isPending: boolean
  pendingReason: string
  onPickerOpenChange: (open: boolean) => void
  onSelectUser: (user: PartnerUserOption) => void
  onSelectContact: (contact: OriginationContactOption) => void
  onClear: () => void
  /** Open the contact create sheet; the new contact becomes the originator. */
  onCreateContact: (query: string) => void
}

type OriginatorDisplay = {
  kind: 'user' | 'contact'
  name: string
  email: string | null
}

function userDisplay(user: PartnerUserOption): OriginatorDisplay {
  return {
    kind: 'user',
    name: user.fullName?.trim() || user.email,
    email: user.email,
  }
}

function contactDisplay(contact: OriginationContactOption): OriginatorDisplay {
  return {
    kind: 'contact',
    name: contact.name?.trim() || contact.email,
    email: contact.email,
  }
}

/**
 * The client's single originator — an admin or a contact, picked from one
 * list the same way closers are. The selection itself says which kind it is.
 */
export function ClientOriginationPicker({
  selectedUser,
  selectedContact,
  availableUsers,
  availableContacts,
  disabled,
  disabledReason,
  isPickerOpen,
  isPending,
  pendingReason,
  onPickerOpenChange,
  onSelectUser,
  onSelectContact,
  onClear,
  onCreateContact,
}: ClientOriginationPickerProps) {
  const [query, setQuery] = useState('')
  const selected = selectedUser
    ? userDisplay(selectedUser)
    : selectedContact
      ? contactDisplay(selectedContact)
      : null

  if (selected) {
    const locked = isPending || disabled
    return (
      <div className='bg-muted/40 flex items-center gap-3 rounded-md border px-3 py-2'>
        {selected.kind === 'user' ? (
          <User2 className='text-muted-foreground h-4 w-4 shrink-0' />
        ) : (
          <LinkIcon className='text-muted-foreground h-4 w-4 shrink-0' />
        )}
        <div className='flex min-w-0 flex-1 flex-col text-sm leading-tight'>
          <span className='truncate font-medium'>{selected.name}</span>
          {selected.email && selected.email !== selected.name ? (
            <span className='text-muted-foreground truncate text-xs'>
              {selected.email}
            </span>
          ) : null}
        </div>
        <DisabledFieldTooltip
          disabled={locked}
          reason={isPending ? pendingReason : disabledReason}
        >
          <Button
            type='button'
            variant='ghost'
            size='icon-sm'
            className='text-muted-foreground hover:text-destructive shrink-0'
            onClick={onClear}
            disabled={locked}
            aria-label={`Remove originator ${selected.name}`}
          >
            <X className='h-4 w-4' />
          </Button>
        </DisabledFieldTooltip>
      </div>
    )
  }

  return (
    <Popover open={isPickerOpen} onOpenChange={onPickerOpenChange} modal>
      {/* Never disabled for an empty list: the create row is the escape hatch. */}
      <DisabledFieldTooltip disabled={disabled} reason={disabledReason}>
        <div className='w-full'>
          <PopoverTrigger asChild>
            <Button
              type='button'
              variant='outline'
              className='w-full justify-start'
              disabled={disabled}
            >
              <User2 className='h-4 w-4' />
              No originator
            </Button>
          </PopoverTrigger>
        </div>
      </DisabledFieldTooltip>
      <PopoverContent className='w-80 p-0'>
        <Command>
          <CommandInput
            placeholder='Search admins and contacts...'
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {availableUsers.length > 0 ? (
              <CommandGroup heading='Admin users'>
                {availableUsers.map(user => (
                  <CandidateItem
                    key={`user:${user.id}`}
                    display={userDisplay(user)}
                    onSelect={() => {
                      if (isPending) return
                      onSelectUser(user)
                    }}
                  />
                ))}
              </CommandGroup>
            ) : null}
            {availableContacts.length > 0 ? (
              <CommandGroup heading='Contacts'>
                {availableContacts.map(contact => (
                  <CandidateItem
                    key={`contact:${contact.id}`}
                    display={contactDisplay(contact)}
                    onSelect={() => {
                      if (isPending) return
                      onSelectContact(contact)
                    }}
                  />
                ))}
              </CommandGroup>
            ) : null}
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

function CandidateItem({
  display,
  onSelect,
}: {
  display: OriginatorDisplay
  onSelect: () => void
}) {
  return (
    <CommandItem
      value={`${display.kind} ${display.name} ${display.email ?? ''}`}
      onSelect={onSelect}
    >
      <User2 className='text-muted-foreground h-4 w-4' />
      <div className='flex min-w-0 flex-col'>
        <span className='truncate font-medium'>{display.name}</span>
        {display.email && display.email !== display.name ? (
          <span className='text-muted-foreground truncate text-xs'>
            {display.email}
          </span>
        ) : null}
      </div>
    </CommandItem>
  )
}
