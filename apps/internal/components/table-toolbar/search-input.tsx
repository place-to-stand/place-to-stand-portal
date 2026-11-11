'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { Search } from 'lucide-react'

import { Input } from '@pts/ui/input'
import { FieldClearButton } from '@/components/ui/field-clear-button'
import { cn } from '@/lib/utils'

const DEBOUNCE_MS = 300

type SearchInputProps = {
  /** Current URL `q` value. */
  value: string | undefined
  /** Called debounced (or immediately on Enter/clear) with the next value. */
  onCommit: (value: string | undefined) => void
  placeholder?: string
  className?: string
}

/**
 * Debounced table search (PRD 004 §03, D7). Fuzzy `%`-join semantics come
 * from the server's `createSearchPattern` (W3 decision — no escaping).
 */
export function SearchInput({
  value,
  onCommit,
  placeholder = 'Search…',
  className,
}: SearchInputProps) {
  const committed = value ?? ''
  const [draft, setDraft] = useState(committed)
  // Values this box sent whose navigation hasn't finished, oldest first.
  // Each one lands after the user may have typed more, so a `value` change
  // that matches one is our own echo and must not reset the draft.
  const [inFlight, setInFlight] = useState<string[]>([])
  // Pending while any navigation this box started is still loading.
  const [isPending, startTransition] = useTransition()
  // What the URL will hold once every commit lands.
  const target = inFlight.at(-1) ?? committed

  // Adopt external changes (back/forward navigation, Reset) using the
  // adjust-state-during-render pattern. An echo of our own send only drops
  // that entry (and older ones) from the queue and keeps the draft.
  const [prevCommitted, setPrevCommitted] = useState(committed)
  if (prevCommitted !== committed) {
    setPrevCommitted(committed)
    const echo = inFlight.lastIndexOf(committed)
    if (echo === -1) {
      setInFlight([])
      setDraft(committed)
    } else {
      setInFlight(inFlight.slice(echo + 1))
    }
  } else if (!isPending && inFlight.length > 0) {
    // Every navigation settled without bringing the value back (another
    // filter change replaced it, or it failed): forget it, so `target`
    // falls back to the URL and the draft gets sent again.
    setInFlight([])
  }

  const send = useCallback(
    (next: string) => {
      setInFlight(queue => [...queue, next])
      startTransition(() => onCommit(next || undefined))
    },
    [onCommit]
  )

  const commit = (next: string) => {
    if (next !== target) send(next)
  }

  useEffect(() => {
    const trimmed = draft.trim()
    if (trimmed === target) return

    const timeout = setTimeout(() => send(trimmed), DEBOUNCE_MS)

    return () => clearTimeout(timeout)
  }, [draft, target, send])

  const flush = () => commit(draft.trim())

  const clear = () => {
    setDraft('')
    commit('')
  }

  return (
    <div className={cn('relative w-full sm:w-56', className)}>
      <Search className='text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2' />
      <Input
        type='search'
        value={draft}
        onChange={event => setDraft(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Enter') {
            event.preventDefault()
            flush()
          }
        }}
        placeholder={placeholder}
        className='px-8 [&::-webkit-search-cancel-button]:appearance-none'
      />
      {draft ? (
        <FieldClearButton label='search' onClear={clear} className='right-3' />
      ) : null}
    </div>
  )
}
