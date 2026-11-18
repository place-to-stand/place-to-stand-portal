'use client'

import { Keyboard, Moon, Sun } from 'lucide-react'

import { Button } from '@pts/ui/button'

import { useKeyboardShortcuts } from '@/components/keyboard/keyboard-shortcuts-dialog'
import { ShortcutKeys } from '@/components/keyboard/shortcut-keys'
import { useTheme } from '@/components/providers/theme-provider'
import { SHORTCUTS } from '@/lib/keyboard/shortcuts'

/**
 * This browser's preferences. Each applies on its own click (they never
 * touch the server), so they sit outside the Profile form and its Save.
 */
export function AccountPreferences() {
  const { theme, toggleTheme } = useTheme()
  const { setOpen: setShortcutsOpen } = useKeyboardShortcuts()
  const isDark = theme === 'dark'

  return (
    <div className='divide-border flex flex-col divide-y rounded-lg border'>
      <PreferenceRow label='Appearance' description={isDark ? 'Dark' : 'Light'}>
        <Button type='button' variant='outline' size='xs' onClick={toggleTheme}>
          {isDark ? <Sun aria-hidden /> : <Moon aria-hidden />}
          {isDark ? 'Use light mode' : 'Use dark mode'}
        </Button>
      </PreferenceRow>
      <PreferenceRow
        label='Keyboard shortcuts'
        description={
          <span className='inline-flex items-center gap-1.5'>
            Press
            <ShortcutKeys shortcut={SHORTCUTS.showShortcuts} size='xs' />
            anywhere
          </span>
        }
      >
        <Button
          type='button'
          variant='outline'
          size='xs'
          onClick={() => setShortcutsOpen(true)}
        >
          <Keyboard aria-hidden />
          Show all
        </Button>
      </PreferenceRow>
    </div>
  )
}

function PreferenceRow({
  label,
  description,
  children,
}: {
  label: string
  description: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className='flex items-center justify-between gap-4 px-4 py-3'>
      <div className='flex min-w-0 flex-col gap-0.5'>
        <span className='text-sm font-medium'>{label}</span>
        <span className='text-muted-foreground text-xs'>{description}</span>
      </div>
      {children}
    </div>
  )
}
