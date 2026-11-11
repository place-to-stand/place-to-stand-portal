'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'
import { Keyboard } from 'lucide-react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { NAV_GROUPS } from '@/components/layout/navigation-config'
import { useViewerAccess } from '@/components/providers/viewer-access-provider'
import { roleCan } from '@/lib/auth/capabilities'
import { filterNavGroupsForRole } from '@/lib/auth/roles'
import type { PaletteSearchResult } from '@/lib/command-palette/types'
import { CommandPaletteRecords } from '@/components/layout/command-palette-records'
import { useKeyboardShortcuts } from '@/components/keyboard/keyboard-shortcuts-dialog'
import { ShortcutKeys } from '@/components/keyboard/shortcut-keys'
import { matchesShortcut } from '@/lib/keyboard/match'
import { confirmDiscardAll } from '@/lib/sheets/discard-guards'
import { parseSheetStack } from '@/lib/sheets/stack'
import { SHORTCUTS } from '@/lib/keyboard/shortcuts'

const MIN_QUERY_LENGTH = 2
const DEBOUNCE_MS = 200

type CommandPaletteContextValue = {
  open: boolean
  setOpen: (open: boolean) => void
}

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(
  null
)

export function useCommandPalette() {
  const context = useContext(CommandPaletteContext)
  if (!context) {
    throw new Error('useCommandPalette must be used within AppShell')
  }
  return context
}

function useDebouncedValue(value: string, delayMs: number) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timeout)
  }, [value, delayMs])

  return debounced
}

async function fetchPaletteResults(
  query: string
): Promise<PaletteSearchResult> {
  const response = await fetch(
    `/api/command-palette/search?q=${encodeURIComponent(query)}`
  )
  if (!response.ok) {
    throw new Error('Search failed')
  }
  const payload = (await response.json()) as {
    ok: boolean
    data?: PaletteSearchResult
  }
  if (!payload.ok || !payload.data) {
    throw new Error('Search failed')
  }
  return payload.data
}

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)

  // ⌘K / Ctrl+K (PW2) — matches the metaKey || ctrlKey convention of the
  // record-cycle shortcuts; no conflict with the sidebar's ⌘B.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Yield when something closer to the target already claimed the event —
      // e.g. the rich text editor's ⌘K link shortcut (ProseMirror calls
      // preventDefault before the event bubbles up to window).
      if (e.defaultPrevented) return
      if (matchesShortcut(e, SHORTCUTS.commandPalette)) {
        e.preventDefault()
        setOpen(current => !current)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const value = useMemo(() => ({ open, setOpen }), [open])

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
      <CommandPalette />
    </CommandPaletteContext.Provider>
  )
}

function CommandPalette() {
  const { open, setOpen } = useCommandPalette()
  const { setOpen: setShortcutsOpen } = useKeyboardShortcuts()
  const { role } = useViewerAccess()
  const canSearch = roleCan(role, 'portal.command_palette')
  const navGroups = useMemo(
    () => (role ? filterNavGroupsForRole(NAV_GROUPS, role) : []),
    [role]
  )
  const router = useRouter()
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedValue(query.trim(), DEBOUNCE_MS)

  const trimmedQuery = query.trim()
  // Record search spans every record, so it is admin-only; SALES staff get
  // page navigation only.
  const recordSearchEnabled =
    canSearch && open && debouncedQuery.length >= MIN_QUERY_LENGTH

  const { data: records, isFetching } = useQuery({
    queryKey: ['command-palette-search', debouncedQuery],
    queryFn: () => fetchPaletteResults(debouncedQuery),
    enabled: recordSearchEnabled,
    staleTime: 30_000,
    // Keep the previous query's results on screen while the next one
    // fetches — results morph in place instead of vanishing per keystroke.
    placeholderData: keepPreviousData,
  })

  // True from the first keystroke of a searchable query until its results
  // land: the debounce window (trimmed !== debounced) plus the fetch
  // itself. While true, the empty state must not claim "No results".
  const isSearchPending =
    canSearch &&
    open &&
    trimmedQuery.length >= MIN_QUERY_LENGTH &&
    (trimmedQuery !== debouncedQuery || isFetching)

  const navigate = useCallback(
    (href: string) => {
      setOpen(false)
      setQuery('')
      // Leaving drops the open sheets: each with unsaved changes asks first,
      // top sheet first, as going back in the stack does.
      const ids = parseSheetStack(new URLSearchParams(window.location.search))
        .map(item => item.id)
        .reverse()
      confirmDiscardAll(ids, () => router.push(href))
    },
    [router, setOpen]
  )

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen)
      if (!nextOpen) {
        setQuery('')
      }
    },
    [setOpen]
  )

  return (
    <CommandDialog
      open={open}
      onOpenChange={handleOpenChange}
      title='Command palette'
      description='Search pages and every record'
    >
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder='Search pages and records…'
      />
      <CommandList>
        <CommandEmpty>
          {isSearchPending
            ? 'Searching…'
            : `No results${trimmedQuery ? ` for “${trimmedQuery}”` : ''}.`}
        </CommandEmpty>
        {navGroups.map((group, index) => (
          <CommandGroup
            key={group.title ?? `group-${index}`}
            heading={group.title ?? 'Navigate'}
          >
            {group.items.map(item => {
              const Icon = item.icon
              return (
                <CommandItem
                  key={item.href}
                  value={`${group.title ?? ''} ${item.label}`}
                  onSelect={() => navigate(item.href)}
                >
                  <Icon className='size-4' />
                  <span>{item.label}</span>
                </CommandItem>
              )
            })}
          </CommandGroup>
        ))}
        <CommandPaletteRecords
          records={recordSearchEnabled ? (records ?? null) : null}
          onSelect={navigate}
        />
        <CommandGroup heading='Help'>
          <CommandItem
            value='Help keyboard shortcuts keys'
            onSelect={() => {
              handleOpenChange(false)
              setShortcutsOpen(true)
            }}
          >
            <Keyboard className='size-4' />
            <span>Keyboard shortcuts</span>
            <ShortcutKeys
              shortcut={SHORTCUTS.showShortcuts}
              size='sm'
              className='ml-auto'
            />
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
