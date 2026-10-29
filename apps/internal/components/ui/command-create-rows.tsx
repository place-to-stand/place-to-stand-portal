'use client'

import { Plus } from 'lucide-react'

import {
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command'

type CommandCreateRowsProps = {
  /** Current search text of the owning `CommandInput` (controlled). */
  query: string
  /** Singular noun for the copy: "contact" → "Create contact". */
  entityLabel: string
  /** Fires with the typed query (possibly empty) as a name prefill. */
  onCreate: (query: string) => void
  /** The no-match line shown above the create row. */
  emptyMessage?: string
}

/**
 * The "create from inside a picker" affordance, shared by every entity
 * picker that supports it: a row pinned to the bottom of the list, matches
 * or not. It reads "Create contact", or "Create “name”" once something is
 * typed, and carries the typed text as the name prefill. Render inside a
 * `CommandList`, after the entity groups.
 */
export function CommandCreateRows({
  query,
  entityLabel,
  onCreate,
  emptyMessage,
}: CommandCreateRowsProps) {
  const trimmed = query.trim()

  return (
    <>
      {emptyMessage ? <CommandEmpty>{emptyMessage}</CommandEmpty> : null}
      <CommandGroup
        forceMount
        className='bg-popover sticky bottom-0 z-10 border-t'
      >
        <CommandItem
          value='__create__'
          forceMount
          onSelect={() => onCreate(trimmed)}
        >
          <Plus className='text-muted-foreground size-4 shrink-0' />
          <span className='truncate'>
            {trimmed ? (
              <>
                Create{' '}
                <span className='font-medium'>&ldquo;{trimmed}&rdquo;</span>
              </>
            ) : (
              `Create ${entityLabel}`
            )}
          </span>
        </CommandItem>
      </CommandGroup>
    </>
  )
}
