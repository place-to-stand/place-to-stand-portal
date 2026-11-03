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

/**
 * Light/dark preference, shared by both portals: the `theme` key in
 * localStorage and the `.dark` class on <html>. The blocking script in each
 * root layout sets the class before first paint (stored choice, else the
 * system's); this provider takes over after hydration. Until the user picks
 * one, nothing is stored, so the portal keeps following the system.
 */
export type Theme = 'light' | 'dark'

const THEME_STORAGE_KEY = 'theme'

type ThemeContextValue = {
  theme: Theme
  /** False until the client has confirmed the theme, to avoid a wrong icon. */
  mounted: boolean
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

function apply(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Storage blocked (private mode): the class still changes for this page.
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Starts light on the server; the effect below reads what the blocking
  // script already put on the DOM.
  const [theme, setThemeState] = useState<Theme>('light')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Deferred: setting state synchronously inside an effect triggers
    // cascading renders (and the lint rule that guards against it).
    queueMicrotask(() => {
      setThemeState(
        document.documentElement.classList.contains('dark') ? 'dark' : 'light'
      )
      setMounted(true)
    })
  }, [])

  const setTheme = useCallback((next: Theme) => {
    apply(next)
    setThemeState(next)
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState(previous => {
      const next: Theme = previous === 'light' ? 'dark' : 'light'
      apply(next)
      return next
    })
  }, [])

  const value = useMemo(
    () => ({ theme, mounted, setTheme, toggleTheme }),
    [theme, mounted, setTheme, toggleTheme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
