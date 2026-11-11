'use client'

import {
  createContext,
  useContext,
  useTransition,
  type ReactNode,
  type TransitionStartFunction,
} from 'react'
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

// Each bar starts a beat after the one before it. Negative delays start the
// bars mid-cycle, so they move from the first frame instead of waiting.
const BAR_DELAYS_MS = [-450, -300, -150, 0]

/**
 * The spinner at a panel's top right while its data reloads: four bars
 * rising and falling in turn like a level meter, in a 36px cell the height of
 * the filter fields beside it. Nothing shows otherwise, so it takes no space
 * at rest. The provider's live region speaks for it.
 */
export function RefreshSpinner({ className }: { className?: string }) {
  const isRefreshing = useContext(IsRefreshingContext)
  if (!isRefreshing) return null
  return (
    <span
      aria-hidden
      data-slot='refresh-spinner'
      className={cn(
        'text-foreground pointer-events-none flex size-9 shrink-0 items-center justify-center',
        className
      )}
    >
      <span className='flex h-[18px] items-center gap-[3px]'>
        {BAR_DELAYS_MS.map(delay => (
          <span
            key={delay}
            className='h-full w-[3px] animate-[refresh-bar_0.9s_ease-in-out_infinite] rounded-full bg-current motion-reduce:animate-[refresh-bar-fade_1.8s_ease-in-out_infinite]'
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </span>
    </span>
  )
}
