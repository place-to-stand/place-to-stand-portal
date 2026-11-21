'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@pts/ui/dialog'

import {
  changelogVersion,
  type ChangelogWeek,
} from '@/lib/help/changelog-utils'
import { cn } from '@/lib/utils'

/** The newest week (and its lines) this browser has opened What's new on. */
const SEEN_KEY = 'pts:whats-new-seen'

type WhatsNewContextValue = {
  open: () => void
  /** A week this browser hasn't opened What's new on since it shipped. */
  hasUnseen: boolean
}

const WhatsNewContext = createContext<WhatsNewContextValue | null>(null)

export function useWhatsNew() {
  const context = useContext(WhatsNewContext)
  if (!context) {
    throw new Error('useWhatsNew must be used within AppShell')
  }
  return context
}

/**
 * Owns the What's new dialog for the whole dashboard, beside Get help: it
 * opens from the user menu and ⌘K. `weeks` come from CHANGELOG.md, read on
 * the server, newest first.
 */
export function WhatsNewProvider({
  weeks,
  children,
}: {
  weeks: ChangelogWeek[]
  children: ReactNode
}) {
  const [isOpen, setIsOpen] = useState(false)
  const latest = weeks[0] ? changelogVersion(weeks[0]) : null
  const seen = useSyncExternalStore(subscribe, readSeen, () => undefined)
  // The server never knows what this browser saw (undefined), so it renders
  // no dot; the dot appears once the browser has checked. Blocked storage
  // also reads undefined, so it never shows a dot it can't clear.
  const hasUnseen = latest !== null && seen !== undefined && seen !== latest

  const open = useCallback(() => {
    setIsOpen(true)
    if (latest) writeSeen(latest)
  }, [latest])

  const value = useMemo(() => ({ open, hasUnseen }), [open, hasUnseen])

  return (
    <WhatsNewContext.Provider value={value}>
      {children}
      <WhatsNewDialog weeks={weeks} open={isOpen} onOpenChange={setIsOpen} />
    </WhatsNewContext.Provider>
  )
}

/**
 * The small dot that marks unseen changes, on the user menu and its item.
 * Screen readers hear "New changes" in its place.
 */
export function WhatsNewDot({ className }: { className?: string }) {
  return (
    <>
      <span
        aria-hidden
        data-slot='whats-new-dot'
        className={cn('bg-primary size-2 shrink-0 rounded-full', className)}
      />
      <span className='sr-only'>New changes</span>
    </>
  )
}

function WhatsNewDialog({
  weeks,
  open,
  onOpenChange,
}: {
  weeks: ChangelogWeek[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[calc(100dvh-4rem)] overflow-y-auto sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>What&rsquo;s new</DialogTitle>
          <DialogDescription>
            What changed in the portal, newest first.
          </DialogDescription>
        </DialogHeader>
        {weeks.length === 0 ? (
          <p className='text-muted-foreground text-sm'>Nothing listed yet.</p>
        ) : (
          <div className='flex flex-col gap-6'>
            {weeks.map(week => (
              <section key={week.id} className='flex flex-col gap-2'>
                <h3 className='text-sm font-semibold'>{week.title}</h3>
                <ul className='flex list-disc flex-col gap-1.5 pl-5 text-sm'>
                  {week.items.map((item, index) => (
                    <li key={index}>
                      {item.area ? (
                        <span className='font-medium'>{item.area}: </span>
                      ) : null}
                      <span className='text-muted-foreground'>{item.text}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// "Seen" lives in this browser only: it is a hint, not a record, so it needs
// no table. Storage can be blocked (private windows), so every access is
// guarded; blocked storage simply shows no dot.

const listeners = new Set<() => void>()
// What this page opened, for storage that reads but refuses writes (a full
// quota): without it the dot could never be cleared.
let openedThisPage: string | null = null

function subscribe(listener: () => void) {
  listeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

/** The stored week id: null when none yet, undefined when storage is blocked. */
function readSeen(): string | null | undefined {
  try {
    return openedThisPage ?? window.localStorage.getItem(SEEN_KEY)
  } catch {
    return undefined
  }
}

function writeSeen(version: string) {
  openedThisPage = version
  try {
    window.localStorage.setItem(SEEN_KEY, version)
  } catch {
    // Kept for this page only (above).
  }
  listeners.forEach(listener => listener())
}
