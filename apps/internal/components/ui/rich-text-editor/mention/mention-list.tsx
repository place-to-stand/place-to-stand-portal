'use client'

import { forwardRef, useImperativeHandle, useState } from 'react'

import { PersonAvatar } from '@/components/table/assignee-submenu'
import type { AssigneeOption } from '@/lib/assignees/types'
import { cn } from '@/lib/utils'

export type MentionListProps = {
  items: AssigneeOption[]
  /** True until the people have loaded. */
  loading: boolean
  /** Set when they couldn't load. */
  error: boolean
  command: (person: AssigneeOption) => void
}

export type MentionListHandle = {
  onKeyDown: (event: KeyboardEvent) => boolean
}

/**
 * The @ list under the cursor. The editor keeps focus: arrows move the
 * highlight, Enter or Tab picks, Escape closes (handled by the extension).
 */
export const MentionList = forwardRef<MentionListHandle, MentionListProps>(
  ({ items, loading, error, command }, ref) => {
    const [selected, setSelected] = useState(0)
    const [itemsSeen, setItemsSeen] = useState(items)
    // A new query starts back at the top.
    if (itemsSeen !== items) {
      setItemsSeen(items)
      setSelected(0)
    }

    useImperativeHandle(ref, () => ({
      onKeyDown: event => {
        if (!items.length) return false
        if (event.key === 'ArrowDown') {
          setSelected(index => (index + 1) % items.length)
          return true
        }
        if (event.key === 'ArrowUp') {
          setSelected(index => (index - 1 + items.length) % items.length)
          return true
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
          const person = items[selected]
          if (person) command(person)
          return true
        }
        return false
      },
    }))

    const empty = loading
      ? 'Loading people…'
      : error
        ? 'Couldn’t load people. Try again.'
        : 'No one here matches.'

    return (
      <div
        role='listbox'
        aria-label='People to mention'
        className='bg-popover text-popover-foreground w-64 overflow-hidden rounded-md border p-1 shadow-md'
      >
        {items.length ? (
          items.map((person, index) => (
            <button
              key={person.id}
              type='button'
              role='option'
              aria-selected={index === selected}
              tabIndex={-1}
              // Keep the editor's focus and selection while clicking.
              onMouseDown={event => event.preventDefault()}
              onMouseEnter={() => setSelected(index)}
              onClick={() => command(person)}
              className={cn(
                'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm',
                index === selected && 'bg-accent text-accent-foreground'
              )}
            >
              <PersonAvatar person={person} />
              <span className='truncate'>{person.name}</span>
            </button>
          ))
        ) : (
          <p className='text-muted-foreground px-2 py-1.5 text-sm'>{empty}</p>
        )}
      </div>
    )
  }
)
MentionList.displayName = 'MentionList'
