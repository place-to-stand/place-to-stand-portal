'use client'

import { useState } from 'react'
import { Plus, Star, UserCheck, X } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { EmptyState } from '@pts/ui/empty-state'
import { ContactRecordRow } from '@/components/sheets/entity-record-rows'
import { SheetRecordList } from '@/components/sheets/sheet-record-row'
import { useSheetParams } from '@/lib/sheets/use-sheet-params'
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
  /** The client's company: only its people can be added. */
  companyId: string | null
  /** Someone at the company already has access (for the empty message). */
  hasCompanyPeopleWithAccess: boolean
  disabled: boolean
  disabledReason: string | null
  isPickerOpen: boolean
  isPending: boolean
  onPickerOpenChange: (open: boolean) => void
  onAddContact: (contact: ClientContactOption) => void
}

/**
 * The "Add person" picker on the Portal access section: only people at the
 * client's company (the server enforces it). Add others to the company first.
 */
export function ClientContactLinkButton({
  availableContacts,
  companyId,
  hasCompanyPeopleWithAccess,
  disabled,
  disabledReason,
  isPickerOpen,
  isPending,
  onPickerOpenChange,
  onAddContact,
}: ClientContactLinkButtonProps) {
  const [query, setQuery] = useState('')
  const { open } = useSheetParams()

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
            placeholder='Search company people…'
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty
              action={
                companyId
                  ? {
                      label: 'Add people to the company',
                      icon: <Plus className='text-muted-foreground size-4' />,
                      onSelect: () => {
                        onPickerOpenChange(false)
                        open('company', companyId)
                      },
                    }
                  : undefined
              }
            >
              {!companyId
                ? 'Link a company first.'
                : hasCompanyPeopleWithAccess
                  ? 'Everyone at this company has access.'
                  : 'No people at this company yet.'}
            </CommandEmpty>
            <CommandGroup>
              {availableContacts
                .filter(c => companyId && c.companyId === companyId)
                .map(contact => (
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
  /** The client's company: anyone else is flagged, with remove only. */
  companyId: string | null
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
  companyId,
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
        // Older access rows can point outside the company: show them so
        // they can be removed, but no star.
        const outsider = Boolean(
          companyId &&
          contact.companyId !== undefined &&
          contact.companyId !== companyId
        )
        return (
          <ContactRecordRow
            key={contact.id}
            contact={contact}
            titleAddon={contact.hasPortalAccess ? <PortalAccessMark /> : null}
            note={
              outsider ? (
                <span className='text-warning'>Not at this company</span>
              ) : undefined
            }
            actions={
              <>
                {outsider ? null : (
                  <RowActionButton
                    type='button'
                    label={
                      isPrimary
                        ? 'Unset primary contact'
                        : 'Make primary contact'
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
                )}
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
