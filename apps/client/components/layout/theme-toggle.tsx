'use client'

import { MoonIcon, SunIcon } from 'lucide-react'

import { DropdownMenuItem } from '@pts/ui/dropdown-menu'
import { useTheme } from '@/components/providers/theme-provider'

/**
 * Menu row that flips between light and dark. The item itself is the control,
 * and it keeps the menu open so the change can be seen in place.
 *
 * Renders a stable placeholder until mounted: the server has no way to know
 * which theme the blocking script chose, so labelling the row before
 * hydration would show the wrong one to half of users.
 */
export function ThemeToggleMenuItem() {
  const { theme, mounted, toggleTheme } = useTheme()

  const isDark = theme === 'dark'
  const Icon = isDark ? SunIcon : MoonIcon

  return (
    <DropdownMenuItem
      onSelect={event => {
        event.preventDefault()
        toggleTheme()
      }}
    >
      {mounted ? (
        <>
          <Icon aria-hidden='true' />
          {isDark ? 'Light mode' : 'Dark mode'}
        </>
      ) : (
        // Same shape, no label — avoids a flash of the wrong mode name.
        <>
          <MoonIcon className='opacity-0' aria-hidden='true' />
          <span className='opacity-0'>Dark mode</span>
        </>
      )}
    </DropdownMenuItem>
  )
}
