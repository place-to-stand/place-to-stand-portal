'use client'

import { Moon, Sun } from 'lucide-react'

import { Tabs, TabsList, TabsTrigger } from '@pts/ui/tabs'
import { useTheme } from '@/components/providers/theme-provider'

/**
 * Light / dark switch for the style guide, on the app's own theme provider
 * (the same state the user menu toggles), so the whole page re-renders in
 * the chosen theme.
 */
export function ThemeToggle() {
  const { theme, setTheme, mounted } = useTheme()

  return (
    <Tabs
      // null until mounted: the server can't know the theme, and a guessed
      // selection would mismatch on hydration.
      value={mounted ? theme : null}
      onValueChange={value => setTheme(value === 'dark' ? 'dark' : 'light')}
    >
      <TabsList aria-label='Theme'>
        <TabsTrigger value='light' className='px-3'>
          <Sun />
          Light
        </TabsTrigger>
        <TabsTrigger value='dark' className='px-3'>
          <Moon />
          Dark
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
