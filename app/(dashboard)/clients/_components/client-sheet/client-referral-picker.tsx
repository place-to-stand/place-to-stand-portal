'use client'

import { ChevronsUpDown, LinkIcon, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

export type ReferralContactOption = {
  id: string
  name: string | null
  email: string
}

export type ClientReferralPickerProps = {
  selectedReferral: ReferralContactOption | null
  availableContacts: ReferralContactOption[]
  disabled: boolean
  disabledReason: string | null
  isPickerOpen: boolean
  isPending: boolean
  pendingReason: string
  onPickerOpenChange: (open: boolean) => void
  onSelect: (contact: ReferralContactOption) => void
  onClear: () => void
}

export function ClientReferralPicker({
  selectedReferral,
  availableContacts,
  disabled,
  disabledReason,
  isPickerOpen,
  isPending,
  pendingReason,
  onPickerOpenChange,
  onSelect,
  onClear,
}: ClientReferralPickerProps) {
  const hasNoAvailableContacts = availableContacts.length === 0 && !selectedReferral

  // When a referral is selected, show it inline with clear button
  if (selectedReferral) {
    return (
      <div className='space-y-2'>
        <div className='bg-muted/40 flex items-center gap-3 rounded-md border px-3 py-2'>
          <LinkIcon className='text-muted-foreground h-4 w-4 shrink-0' />
          <div className='flex min-w-0 flex-1 flex-col text-sm leading-tight'>
            {selectedReferral.name ? (
              <>
                <span className='truncate font-medium'>{selectedReferral.name}</span>
                <span className='text-muted-foreground truncate text-xs'>
                  {selectedReferral.email}
                </span>
              </>
            ) : (
              <span className='truncate font-medium'>{selectedReferral.email}</span>
            )}
          </div>
          <DisabledFieldTooltip
            disabled={isPending || disabled}
            reason={isPending ? pendingReason : disabledReason}
          >
            <Button
              type='button'
              variant='ghost'
              size='icon'
              className='text-muted-foreground hover:text-destructive h-8 w-8 shrink-0'
              onClick={onClear}
              disabled={isPending || disabled}
              aria-label={`Clear referral source ${selectedReferral.name ?? selectedReferral.email}`}
            >
              <X className='h-4 w-4' />
            </Button>
          </DisabledFieldTooltip>
        </div>
        <p className='text-muted-foreground text-xs'>
          Track who referred this client for commission payouts.
        </p>
      </div>
    )
  }

  // When no referral is selected, show the dropdown picker
  return (
    <div className='space-y-2'>
      <Popover open={isPickerOpen} onOpenChange={onPickerOpenChange}>
        <DisabledFieldTooltip
          disabled={disabled || hasNoAvailableContacts}
          reason={disabledReason ?? (hasNoAvailableContacts ? 'No contacts available' : null)}
        >
          <div className='w-full'>
            <PopoverTrigger asChild>
              <Button
                type='button'
                variant='outline'
                className='w-full justify-between'
                disabled={disabled || hasNoAvailableContacts}
              >
                <span className='flex items-center gap-2'>
                  <LinkIcon className='h-4 w-4' />
                  Select referral source
                </span>
                <ChevronsUpDown className='h-4 w-4 opacity-50' />
              </Button>
            </PopoverTrigger>
          </div>
        </DisabledFieldTooltip>
        <PopoverContent className='w-[320px] p-0' align='start'>
          <Command>
            <CommandInput placeholder='Search contacts...' />
            <CommandEmpty>No matching contacts.</CommandEmpty>
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
                      onSelect(contact)
                    }}
                  >
                    <div className='flex flex-col'>
                      {contact.name ? (
                        <>
                          <span className='font-medium'>{contact.name}</span>
                          <span className='text-muted-foreground text-xs'>
                            {contact.email}
                          </span>
                        </>
                      ) : (
                        <span className='font-medium'>{contact.email}</span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <p className='text-muted-foreground text-xs'>
        Track who referred this client for commission payouts.
      </p>
    </div>
  )
}
