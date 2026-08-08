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
import { useQuery } from '@tanstack/react-query'
import { Building2, Contact, FolderKanban } from 'lucide-react'

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { NAV_GROUPS } from '@/components/layout/navigation-config'
import type {
  PaletteSearchResult,
} from '@/lib/queries/command-palette'

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
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
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
  const router = useRouter()
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedValue(query.trim(), DEBOUNCE_MS)

  const recordSearchEnabled = open && debouncedQuery.length >= MIN_QUERY_LENGTH

  const { data: records } = useQuery({
    queryKey: ['command-palette-search', debouncedQuery],
    queryFn: () => fetchPaletteResults(debouncedQuery),
    enabled: recordSearchEnabled,
    staleTime: 30_000,
  })

  const navigate = useCallback(
    (href: string) => {
      setOpen(false)
      setQuery('')
      router.push(href)
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

  const clients = recordSearchEnabled ? (records?.clients ?? []) : []
  const projects = recordSearchEnabled ? (records?.projects ?? []) : []
  const contactResults = recordSearchEnabled ? (records?.contacts ?? []) : []

  return (
    <CommandDialog
      open={open}
      onOpenChange={handleOpenChange}
      title='Command palette'
      description='Search pages, clients, and projects'
    >
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder='Search pages, clients, projects…'
      />
      <CommandList>
        <CommandEmpty>
          No results{query.trim() ? ` for “${query.trim()}”` : ''}.
        </CommandEmpty>
        {NAV_GROUPS.map((group, index) => (
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
        {clients.length > 0 ? (
          <CommandGroup heading='Clients'>
            {clients.map(client => (
              <CommandItem
                key={client.id}
                value={`client-${client.id}`}
                onSelect={() =>
                  navigate(`/clients/${client.slug ?? client.id}`)
                }
              >
                <Building2 className='size-4' />
                <span>{client.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
        {projects.length > 0 ? (
          <CommandGroup heading='Projects'>
            {projects.map(project => (
              <CommandItem
                key={project.id}
                value={`project-${project.id}`}
                onSelect={() =>
                  navigate(
                    `/projects/${project.clientSegment}/${project.projectSlug}/tasks`
                  )
                }
              >
                <FolderKanban className='size-4' />
                <span>
                  {project.clientLabel ? (
                    <span className='text-muted-foreground'>
                      {project.clientLabel} ·{' '}
                    </span>
                  ) : null}
                  {project.name}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
        {contactResults.length > 0 ? (
          <CommandGroup heading='Contacts'>
            {contactResults.map(contact => (
              <CommandItem
                key={contact.id}
                value={`contact-${contact.id}`}
                onSelect={() =>
                  // Contacts have no detail route — land on the contacts list
                  // pre-filtered to the record.
                  navigate(`/contacts?q=${encodeURIComponent(contact.name)}`)
                }
              >
                <Contact className='size-4' />
                <span>
                  {contact.name}{' '}
                  <span className='text-muted-foreground'>{contact.email}</span>
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
      </CommandList>
    </CommandDialog>
  )
}
