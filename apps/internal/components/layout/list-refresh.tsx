'use client'

import {
  createContext,
  useContext,
  useTransition,
  type ReactNode,
  type TransitionStartFunction,
} from 'react'
import { Loader2 } from 'lucide-react'

import { cn } from '@/lib/utils'

const runNow: TransitionStartFunction = callback => {
  void callback()
}

// Two contexts: controls only need the stable start function, so they don't
// re-render when a refresh starts and ends; only the spinners read the state.
const StartRefreshContext = createContext<TransitionStartFunction>(runNow)
const IsRefreshingContext = createContext(false)

/**
 * One refresh state for the dashboard: list controls start their reloads
 * through it, and the page's main panel shows a spinner while one runs.
 */
export function ListRefreshProvider({ children }: { children: ReactNode }) {
  const [isRefreshing, startRefresh] = useTransition()
  return (
    <StartRefreshContext.Provider value={startRefresh}>
      <IsRefreshingContext.Provider value={isRefreshing}>
        {children}
        {/* One always-there live region, so screen readers hear it. */}
        <span role='status' className='sr-only'>
          {isRefreshing ? 'Loading…' : ''}
        </span>
      </IsRefreshingContext.Provider>
    </StartRefreshContext.Provider>
  )
}

/**
 * Runs a navigation that reloads the page's data (a filter, sort or page
 * change) as a tracked refresh. Outside the dashboard it simply runs.
 */
export function useStartRefresh(): TransitionStartFunction {
  return useContext(StartRefreshContext)
}

/**
 * The spinner in a panel's top right while its data reloads. Nothing shows
 * otherwise, so it takes no space at rest. The provider's live region
 * speaks for it.
 */
export function RefreshSpinner({ className }: { className?: string }) {
  const isRefreshing = useContext(IsRefreshingContext)
  if (!isRefreshing) return null
  return (
    <span
      aria-hidden
      data-slot='refresh-spinner'
      className={cn('text-muted-foreground shrink-0', className)}
    >
      <Loader2 className='size-4 animate-spin' />
    </span>
  )
}
