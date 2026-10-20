'use client'

import { createContext, useContext, type ReactNode } from 'react'

import type { MonthCursor } from '@/lib/data/reports/types'
import { useReportNavigation } from '@/lib/reports/use-report-navigation'
import { cn } from '@/lib/utils'

type ReportNavigation = ReturnType<typeof useReportNavigation>

const ReportNavigationContext = createContext<ReportNavigation | null>(null)

/**
 * Owns month navigation for the whole report, so the toolbar can show the
 * month being loaded while the body dims the month it's leaving.
 */
export function ReportNavigationProvider({
  minCursor,
  maxCursor,
  children,
}: {
  minCursor: MonthCursor
  maxCursor: MonthCursor
  children: ReactNode
}) {
  const navigation = useReportNavigation({ minCursor, maxCursor })
  return (
    <ReportNavigationContext value={navigation}>
      {children}
    </ReportNavigationContext>
  )
}

export function useReportNavigationContext(): ReportNavigation {
  const navigation = useContext(ReportNavigationContext)
  if (!navigation) {
    throw new Error(
      'useReportNavigationContext must be used inside ReportNavigationProvider'
    )
  }
  return navigation
}

/**
 * The report under the toolbar. While another month loads it still shows the
 * previous one, so it fades and stops taking clicks instead of passing for
 * the month the toolbar now names.
 */
export function ReportBody({ children }: { children: ReactNode }) {
  const { isPending } = useReportNavigationContext()
  return (
    <div
      aria-busy={isPending}
      inert={isPending}
      className={cn(
        'space-y-6 transition-opacity duration-200 motion-reduce:transition-none',
        isPending && 'opacity-50'
      )}
    >
      {children}
    </div>
  )
}
