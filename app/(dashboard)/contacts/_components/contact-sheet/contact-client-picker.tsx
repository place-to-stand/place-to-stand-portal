'use client'

import { Building2, ChevronsUpDown, X } from 'lucide-react'

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

export type ContactClientOption = {
  id: string
  name: string
  slug: string
}

const assignedContainerClass =
  'bg-muted/40 flex items-center justify-between rounded-md border px-3 py-2'

const iconButtonClass = 'text-muted-foreground hover:text-destructive'

export type ContactClientPickerProps = {
  selectedClients: ContactClientOption[]
  availableClients: ContactClientOption[]
  addButtonDisabled: boolean
  addButtonDisabledReason: string | null
  isPickerOpen: boolean
  isPending: boolean
  pendingReason: string
  onPickerOpenChange: (open: boolean) => void
  onAddClient: (client: ContactClientOption) => void
  onRequestRemoval: (client: ContactClientOption) => void
}

export function ContactClientPicker({
  selectedClients,
  availableClients,
  addButtonDisabled,
  addButtonDisabledReason,
  isPickerOpen,
  isPending,
  pendingReason,
  onPickerOpenChange,
  onAddClient,
  onRequestRemoval,
}: ContactClientPickerProps) {
  return (
    <div className='space-y-2'>
      <Popover open={isPickerOpen} onOpenChange={onPickerOpenChange}>
        <DisabledFieldTooltip
          disabled={addButtonDisabled}
          reason={addButtonDisabledReason}
        >
          <div className='w-full'>
            <PopoverTrigger asChild>
              <Button
                type='button'
                variant='outline'
                className='w-full justify-between'
                disabled={addButtonDisabled}
              >
                <span className='flex items-center gap-2'>
                  <Building2 className='h-4 w-4' />
                  {availableClients.length > 0
                    ? 'Link client'
                    : 'All clients linked'}
                </span>
                <ChevronsUpDown className='h-4 w-4 opacity-50' />
              </Button>
            </PopoverTrigger>
          </div>
        </DisabledFieldTooltip>
        <PopoverContent className='w-[320px] p-0' align='start'>
          <Command>
            <CommandInput placeholder='Search clients...' />
            <CommandEmpty>No matching clients.</CommandEmpty>
            <CommandList>
              <CommandGroup heading='Clients'>
                {availableClients.map(client => (
                  <CommandItem
                    key={client.id}
                    value={client.name}
                    onSelect={() => {
                      if (isPending) {
                        return
                      }
                      onAddClient(client)
                    }}
                  >
                    <div className='flex items-center gap-2'>
                      <Building2 className='text-muted-foreground h-4 w-4' />
                      <span className='font-medium'>{client.name}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <p className='text-muted-foreground text-xs'>
        Link this contact to one or more clients.
      </p>
      <div className='space-y-2'>
        {selectedClients.length === 0 ? (
          <p className='text-muted-foreground text-sm'>
            No clients linked yet.
          </p>
        ) : (
          selectedClients.map(client => (
            <div key={client.id} className={assignedContainerClass}>
              <div className='flex items-center gap-2 text-sm leading-tight'>
                <Building2 className='text-muted-foreground h-4 w-4 shrink-0' />
                <span className='font-medium'>{client.name}</span>
              </div>
              <DisabledFieldTooltip
                disabled={isPending}
                reason={isPending ? pendingReason : null}
              >
                <Button
                  type='button'
                  variant='ghost'
                  size='icon'
                  className={iconButtonClass}
                  onClick={() => onRequestRemoval(client)}
                  disabled={isPending}
                  aria-label={`Unlink ${client.name}`}
                >
                  <X className='h-4 w-4' />
                </Button>
              </DisabledFieldTooltip>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
