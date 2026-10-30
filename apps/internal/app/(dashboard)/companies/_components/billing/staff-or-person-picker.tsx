'use client'

import { useState, type ReactElement } from 'react'

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
import { ENTITY_ICONS } from '@/lib/entity-accents'

/** Someone a commission can go to: a staff sign-in or a person. */
export type StaffOrPersonCandidate = {
  kind: 'user' | 'contact'
  id: string
  name: string
  email: string | null
}

type StaffOrPersonPickerProps<T extends StaffOrPersonCandidate> = {
  staff: T[]
  people: T[]
  onSelect: (candidate: T) => void
  /** The button that opens the list. */
  trigger: ReactElement
  /** Classes for the trigger's wrapper (e.g. `w-full`). */
  triggerClassName?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  disabled: boolean
  disabledReason: string | null
  /** While saving, picks are ignored. */
  isPending: boolean
  /** Open the person create sheet with what was typed. */
  onCreatePerson: (query: string) => void
}

/**
 * One searchable list of staff, then people, with a pinned "Create person"
 * row: the origination picker and the closers editor both pick from it.
 */
export function StaffOrPersonPicker<T extends StaffOrPersonCandidate>({
  staff,
  people,
  onSelect,
  trigger,
  triggerClassName,
  open,
  onOpenChange,
  disabled,
  disabledReason,
  isPending,
  onCreatePerson,
}: StaffOrPersonPickerProps<T>) {
  const [query, setQuery] = useState('')
  const pick = (candidate: T) => {
    if (isPending) return
    onSelect(candidate)
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange} modal>
      {/* Never disabled for an empty list: the create row is the escape hatch. */}
      <DisabledFieldTooltip disabled={disabled} reason={disabledReason}>
        <div className={triggerClassName}>
          <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        </div>
      </DisabledFieldTooltip>
      <PopoverContent className='w-80 p-0'>
        <Command>
          <CommandInput
            placeholder='Search people…'
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {(
              [
                ['Staff', staff],
                ['People', people],
              ] as const
            ).map(([heading, candidates]) =>
              candidates.length > 0 ? (
                <CommandGroup key={heading} heading={heading}>
                  {candidates.map(candidate => (
                    <CandidateItem
                      key={`${candidate.kind}:${candidate.id}`}
                      candidate={candidate}
                      onSelect={() => pick(candidate)}
                    />
                  ))}
                </CommandGroup>
              ) : null
            )}
            <CommandCreateRows
              query={query}
              entityLabel='person'
              onCreate={onCreatePerson}
            />
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function CandidateItem({
  candidate,
  onSelect,
}: {
  candidate: StaffOrPersonCandidate
  onSelect: () => void
}) {
  return (
    <CommandItem
      value={`${candidate.kind} ${candidate.name} ${candidate.email ?? ''}`}
      onSelect={onSelect}
    >
      <ENTITY_ICONS.contact className='text-muted-foreground h-4 w-4' />
      <div className='flex min-w-0 flex-col'>
        <span className='truncate font-medium'>{candidate.name}</span>
        {candidate.email && candidate.email !== candidate.name ? (
          <span className='text-muted-foreground truncate text-xs'>
            {candidate.email}
          </span>
        ) : null}
      </div>
    </CommandItem>
  )
}
