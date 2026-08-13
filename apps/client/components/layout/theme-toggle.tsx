'use client'

import { MoonIcon, SunIcon } from 'lucide-react'

import { useTheme } from '@/components/providers/theme-provider'

/**
 * Menu row that flips between light and dark.
 *
 * Renders a stable placeholder until mounted: the server has no way to know
 * which theme the blocking script chose, so labelling the button before
 * hydration would show the wrong one to half of users.
 */
export function ThemeToggle() {
  const { theme, mounted, toggleTheme } = useTheme()

  const isDark = theme === 'dark'
  const Icon = isDark ? SunIcon : MoonIcon

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="flex w-full cursor-pointer items-center gap-2 text-left text-sm"
    >
      {mounted ? (
        <>
          <Icon className="size-4 shrink-0" aria-hidden="true" />
          {isDark ? 'Light mode' : 'Dark mode'}
        </>
      ) : (
        // Same shape, no label — avoids a flash of the wrong mode name.
        <>
          <MoonIcon className="size-4 shrink-0 opacity-0" aria-hidden="true" />
          <span className="opacity-0">Dark mode</span>
        </>
      )}
    </button>
  )
}
