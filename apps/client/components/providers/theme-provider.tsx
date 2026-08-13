'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

/**
 * Light/dark preference, persisted to localStorage.
 *
 * Mirrors `apps/internal/components/providers/theme-provider.tsx` — same
 * storage key and same `.dark` class on <html> — so the two portals behave
 * identically. The blocking script in the root layout is what actually sets
 * the class before first paint; this provider only takes over afterwards.
 */
type Theme = 'light' | 'dark'

const THEME_STORAGE_KEY = 'theme'

type ThemeContextValue = {
  theme: Theme
  /** False until the client has confirmed the theme, to avoid a wrong icon. */
  mounted: boolean
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Starts light on the server; the effect below reconciles with what the
  // blocking script already put on the DOM.
  const [theme, setTheme] = useState<Theme>('light')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Deferred: setting state synchronously inside an effect triggers
    // cascading renders (and the lint rule that guards against it).
    queueMicrotask(() => {
      setTheme(
        document.documentElement.classList.contains('dark') ? 'dark' : 'light'
      )
      setMounted(true)
    })
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme(previous => {
      const next: Theme = previous === 'light' ? 'dark' : 'light'
      document.documentElement.classList.toggle('dark', next === 'dark')
      localStorage.setItem(THEME_STORAGE_KEY, next)
      return next
    })
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, mounted, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
