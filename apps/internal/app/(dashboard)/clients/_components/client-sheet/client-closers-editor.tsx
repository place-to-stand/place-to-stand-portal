'use client'

import { useState } from 'react'
import { Handshake, LinkIcon, Plus, User2, X } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { Input } from '@pts/ui/input'
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
import { cn } from '@/lib/utils'

import { closerKey } from '@/lib/settings/clients/closers'
import type {
  CloserCandidate,
  CloserDraft,
} from '@/lib/settings/clients/use-client-sheet-state'

export type ClientClosersEditorProps = {
  closers: CloserDraft[]
  availableUsers: CloserCandidate[]
  availableContacts: CloserCandidate[]
  /** Sum of the typed shares, or null when a share isn't a number yet. */
  shareTotal: number | null
  hasError: boolean
  disabled: boolean
  disabledReason: string | null
  isPickerOpen: boolean
  isPending: boolean
  pendingReason: string
  onPickerOpenChange: (open: boolean) => void
  onAdd: (candidate: CloserCandidate) => void
  onRemove: (key: string) => void
  onShareChange: (key: string, shareText: string) => void
  /** Open the contact create sheet; the new contact is added as a closer. */
  onCreateContact: (query: string) => void
}

/**
 * The closers on a client's commission split. One closer takes the whole
 * closer rate, so the share field only appears once there are two or more;
 * adding or removing a closer re-splits evenly, then shares are hand-tuned.
 */
export function ClientClosersEditor({
  closers,
  availableUsers,
  availableContacts,
  shareTotal,
  hasError,
  disabled,
  disabledReason,
  isPickerOpen,
  isPending,
  pendingReason,
  onPickerOpenChange,
  onAdd,
  onRemove,
  onShareChange,
  onCreateContact,
}: ClientClosersEditorProps) {
  const isSplit = closers.length > 1
  const locked = isPending || disabled
  const lockedReason = isPending ? pendingReason : disabledReason

  return (
    <div className='grid gap-2'>
      {closers.length > 0 ? (
        <ul className='grid gap-2'>
          {closers.map(closer => {
            const key = closerKey(closer)
            return (
              <li
                key={key}
                className='bg-muted/40 flex items-center gap-3 rounded-md border px-3 py-2'
              >
                {closer.kind === 'user' ? (
                  <Handshake className='text-muted-foreground h-4 w-4 shrink-0' />
                ) : (
                  <LinkIcon className='text-muted-foreground h-4 w-4 shrink-0' />
                )}
                <div className='flex min-w-0 flex-1 flex-col text-sm leading-tight'>
                  <span className='truncate font-medium'>{closer.name}</span>
                  {closer.email && closer.email !== closer.name ? (
                    <span className='text-muted-foreground truncate text-xs'>
                      {closer.email}
                    </span>
                  ) : null}
                </div>
                {isSplit ? (
                  <div className='relative w-20 shrink-0'>
                    <Input
                      value={closer.shareText}
                      onChange={event => onShareChange(key, event.target.value)}
                      inputMode='decimal'
                      aria-label={`${closer.name} share`}
                      aria-invalid={hasError || undefined}
                      disabled={locked}
                      className='h-8 pr-6 text-right tabular-nums'
                    />
                    <span className='text-muted-foreground pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-sm'>
                      %
                    </span>
                  </div>
                ) : null}
                <DisabledFieldTooltip disabled={locked} reason={lockedReason}>
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon-sm'
                    className='text-muted-foreground hover:text-destructive shrink-0'
                    onClick={() => onRemove(key)}
                    disabled={locked}
                    aria-label={`Remove closer ${closer.name}`}
                  >
                    <X className='h-4 w-4' />
                  </Button>
                </DisabledFieldTooltip>
              </li>
            )
          })}
        </ul>
      ) : null}

      <div className='flex items-center justify-between gap-3'>
        <CloserAddButton
          hasClosers={closers.length > 0}
          availableUsers={availableUsers}
          availableContacts={availableContacts}
          disabled={disabled}
          disabledReason={disabledReason}
          isPickerOpen={isPickerOpen}
          isPending={isPending}
          onPickerOpenChange={onPickerOpenChange}
          onAdd={onAdd}
          onCreateContact={onCreateContact}
        />
        {isSplit ? (
          <span
            className={cn(
              'text-sm tabular-nums',
              hasError ? 'text-destructive' : 'text-muted-foreground'
            )}
          >
            Total {shareTotal === null ? '—' : `${shareTotal}%`}
          </span>
        ) : null}
      </div>
    </div>
  )
}

type CloserAddButtonProps = {
  hasClosers: boolean
  availableUsers: CloserCandidate[]
  availableContacts: CloserCandidate[]
  disabled: boolean
  disabledReason: string | null
  isPickerOpen: boolean
  isPending: boolean
  onPickerOpenChange: (open: boolean) => void
  onAdd: (candidate: CloserCandidate) => void
  onCreateContact: (query: string) => void
}

function CloserAddButton({
  hasClosers,
  availableUsers,
  availableContacts,
  disabled,
  disabledReason,
  isPickerOpen,
  isPending,
  onPickerOpenChange,
  onAdd,
  onCreateContact,
}: CloserAddButtonProps) {
  const [query, setQuery] = useState('')

  return (
    <Popover open={isPickerOpen} onOpenChange={onPickerOpenChange} modal>
      {/* Never disabled for an empty list: the create row is the escape hatch. */}
      <DisabledFieldTooltip disabled={disabled} reason={disabledReason}>
        <div className={hasClosers ? undefined : 'w-full'}>
          <PopoverTrigger asChild>
            <Button
              type='button'
              variant={hasClosers ? 'ghost' : 'outline'}
              size={hasClosers ? 'sm' : 'default'}
              className={hasClosers ? undefined : 'w-full justify-start'}
              disabled={disabled}
            >
              {hasClosers ? (
                <Plus className='h-4 w-4' />
              ) : (
                <Handshake className='h-4 w-4' />
              )}
              {hasClosers ? 'Add closer' : 'No closer'}
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
                {availableUsers.map(candidate => (
                  <CandidateItem
                    key={closerKey(candidate)}
                    candidate={candidate}
                    isPending={isPending}
                    onAdd={onAdd}
                  />
                ))}
              </CommandGroup>
            ) : null}
            {availableContacts.length > 0 ? (
              <CommandGroup heading='Contacts'>
                {availableContacts.map(candidate => (
                  <CandidateItem
                    key={closerKey(candidate)}
                    candidate={candidate}
                    isPending={isPending}
                    onAdd={onAdd}
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
  candidate,
  isPending,
  onAdd,
}: {
  candidate: CloserCandidate
  isPending: boolean
  onAdd: (candidate: CloserCandidate) => void
}) {
  return (
    <CommandItem
      value={`${candidate.kind} ${candidate.name} ${candidate.email ?? ''}`}
      onSelect={() => {
        if (isPending) return
        onAdd(candidate)
      }}
    >
      <User2 className='text-muted-foreground h-4 w-4' />
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
