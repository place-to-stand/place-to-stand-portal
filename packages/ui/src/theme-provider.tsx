'use client'

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

/**
 * Light/dark preference, shared by both portals: the `theme` key in
 * localStorage and the `.dark` class on <html>. The blocking script in each
 * root layout sets the class before first paint (stored choice, else the
 * system's); this provider sets it again on mount and takes over from there. Until the user picks
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

/** The stored choice, else the system's: what the blocking script picks. */
function preferredTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    // Storage blocked: fall back to the system.
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

function apply(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Storage blocked (private mode): the class still changes for this page.
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Starts light on the server; the layout effect below sets the real one.
  const [theme, setThemeState] = useState<Theme>('light')
  const [mounted, setMounted] = useState(false)

  useLayoutEffect(() => {
    // Re-apply the class rather than read it back from <html>: when hydration
    // fails anywhere outside a Suspense boundary, React renders the root
    // again on the client and strips every attribute from <html>, the
    // blocking script's `dark` class included, and that script does not run
    // again. This provider mounts again in that render, so putting the class
    // back here (before paint) keeps the page in the chosen theme.
    const next = preferredTheme()
    document.documentElement.classList.toggle('dark', next === 'dark')
    // Deferred: setting state synchronously inside an effect triggers
    // cascading renders (and the lint rule that guards against it).
    queueMicrotask(() => {
      setThemeState(next)
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
