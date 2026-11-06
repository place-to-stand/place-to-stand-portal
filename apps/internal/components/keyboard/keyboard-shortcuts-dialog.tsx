'use client'

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@pts/ui/dialog'

import { isEditableTarget, matchesShortcut } from '@/lib/keyboard/match'
import { SHORTCUTS, shortcutsByGroup } from '@/lib/keyboard/shortcuts'

import { ShortcutKeys } from './shortcut-keys'

type KeyboardShortcutsContextValue = {
  open: boolean
  setOpen: (open: boolean) => void
}

const KeyboardShortcutsContext =
  createContext<KeyboardShortcutsContextValue | null>(null)

export function useKeyboardShortcuts() {
  const context = useContext(KeyboardShortcutsContext)
  if (!context) {
    throw new Error('useKeyboardShortcuts must be used within AppShell')
  }
  return context
}

/** Owns the shortcuts dialog and its `?` key, for the whole dashboard. */
export function KeyboardShortcutsProvider({
  children,
}: {
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      // `?` is a question mark while typing; only claim it outside fields.
      if (event.defaultPrevented || isEditableTarget(event.target)) return
      if (matchesShortcut(event, SHORTCUTS.showShortcuts)) {
        event.preventDefault()
        setOpen(current => !current)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const value = useMemo(() => ({ open, setOpen }), [open])

  return (
    <KeyboardShortcutsContext.Provider value={value}>
      {children}
      <KeyboardShortcutsDialog open={open} onOpenChange={setOpen} />
    </KeyboardShortcutsContext.Provider>
  )
}

function KeyboardShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const sections = useMemo(() => shortcutsByGroup(), [])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[calc(100dvh-4rem)] overflow-y-auto sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Press <ShortcutKeys shortcut={SHORTCUTS.showShortcuts} /> anywhere
            to open this list.
          </DialogDescription>
        </DialogHeader>
        <div className='gap-x-8 sm:columns-2'>
          {sections.map(section => (
            <section
              key={section.group}
              className='mb-6 break-inside-avoid space-y-2 last:mb-0'
            >
              <h3 className='text-muted-foreground text-xs font-semibold tracking-wide uppercase'>
                {section.group}
              </h3>
              <dl className='divide-y'>
                {section.shortcuts.map(shortcut => (
                  <div
                    key={shortcut.id}
                    className='flex items-center justify-between gap-4 py-1.5'
                  >
                    <dt className='text-sm'>{shortcut.label}</dt>
                    <dd className='shrink-0'>
                      <ShortcutKeys shortcut={shortcut} />
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
