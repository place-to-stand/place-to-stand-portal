'use client'

import { useEffect, useState } from 'react'
import { Search, X } from 'lucide-react'

import { Input } from '@/components/ui/input'
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

  // Adopt external changes (back/forward navigation, clears) using the
  // adjust-state-during-render pattern.
  const [prevCommitted, setPrevCommitted] = useState(committed)
  if (prevCommitted !== committed) {
    setPrevCommitted(committed)
    setDraft(committed)
  }

  useEffect(() => {
    const trimmed = draft.trim()
    if (trimmed === committed) return

    const timeout = setTimeout(() => {
      onCommit(trimmed || undefined)
    }, DEBOUNCE_MS)

    return () => clearTimeout(timeout)
  }, [draft, committed, onCommit])

  const flush = () => {
    const trimmed = draft.trim()
    if (trimmed === committed) return
    onCommit(trimmed || undefined)
  }

  const clear = () => {
    setDraft('')
    if (committed) {
      onCommit(undefined)
    }
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
        <button
          type='button'
          onClick={clear}
          aria-label='Clear search'
          className='text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer'
        >
          <X className='size-4' />
        </button>
      ) : null}
    </div>
  )
}
