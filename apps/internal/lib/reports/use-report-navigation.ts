'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { addMonths, getMonth, getYear, startOfMonth } from 'date-fns'

import type { MonthCursor } from '@/lib/data/reports/types'

type UseReportNavigationOptions = {
  minCursor: MonthCursor
  maxCursor: MonthCursor
}

type UseReportNavigationResult = {
  /** The month being viewed, 1-indexed. */
  cursor: MonthCursor
  goToMonth: (cursor: MonthCursor) => void
  goToPrevMonth: () => void
  goToNextMonth: () => void
  goToThisMonth: () => void
  canGoPrev: boolean
  canGoNext: boolean
  minLimitLabel: string
  maxLimitLabel: string
}

const NAVIGATION_SETTLE_MS = 300

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

function formatMonthLabel(cursor: MonthCursor): string {
  const label = MONTH_NAMES[cursor.month - 1] ?? 'Unknown'
  return `${label} ${cursor.year}`
}

export function compareMonthCursor(a: MonthCursor, b: MonthCursor): number {
  const aValue = a.year * 12 + (a.month - 1)
  const bValue = b.year * 12 + (b.month - 1)

  if (aValue < bValue) return -1
  if (aValue > bValue) return 1
  return 0
}

function dateToCursor(date: Date): MonthCursor {
  return {
    year: getYear(date),
    month: getMonth(date) + 1, // Convert 0-indexed to 1-indexed
  }
}

function cursorToDate(cursor: MonthCursor): Date {
  return startOfMonth(new Date(cursor.year, cursor.month - 1, 1))
}

/**
 * Hook for report month navigation with URL persistence and bounds checking.
 * Month values in URLs are 0-indexed (0 = January, 11 = December).
 * MonthCursor uses 1-indexed months (1 = January, 12 = December).
 */
export function useReportNavigation({
  minCursor,
  maxCursor,
}: UseReportNavigationOptions): UseReportNavigationResult {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Parse initial state from URL or default to current month
  const initialMonth = useMemo(() => {
    const monthParam = searchParams.get('month')
    const yearParam = searchParams.get('year')

    const now = new Date()

    // URL uses 0-indexed months
    const parsedMonth = monthParam ? parseInt(monthParam, 10) : getMonth(now)
    const parsedYear = yearParam ? parseInt(yearParam, 10) : getYear(now)

    const validMonth =
      Number.isFinite(parsedMonth) && parsedMonth >= 0 && parsedMonth <= 11
        ? parsedMonth
        : getMonth(now)
    const validYear = Number.isFinite(parsedYear) ? parsedYear : getYear(now)

    return startOfMonth(new Date(validYear, validMonth, 1))
  }, [searchParams])

  const [currentMonth, setCurrentMonth] = useState(() => initialMonth)

  // Sync local state when the URL-derived month changes, using the
  // adjust-state-during-render pattern instead of a resync effect.
  const [prevInitialMonth, setPrevInitialMonth] = useState(initialMonth)
  if (prevInitialMonth !== initialMonth) {
    setPrevInitialMonth(initialMonth)
    setCurrentMonth(initialMonth)
  }

  const cursor = useMemo(() => dateToCursor(currentMonth), [currentMonth])

  const canGoPrev = compareMonthCursor(cursor, minCursor) > 0
  const canGoNext = compareMonthCursor(cursor, maxCursor) < 0

  const minLimitLabel = useMemo(() => formatMonthLabel(minCursor), [minCursor])
  const maxLimitLabel = useMemo(() => formatMonthLabel(maxCursor), [maxCursor])

  // The label moves on every click, but the URL (and the server render behind
  // it) only follows once clicking settles. Next doesn't cancel superseded
  // navigations, so a burst of arrow clicks used to stream a full report per
  // month in parallel, and one dropped stream crashed the page.
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (pushTimer.current) clearTimeout(pushTimer.current)
    },
    []
  )

  const navigate = useCallback(
    (month: Date) => {
      setCurrentMonth(month)
      const params = new URLSearchParams(searchParams.toString())
      // URL uses 0-indexed months
      params.set('month', String(getMonth(month)))
      params.set('year', String(getYear(month)))
      if (pushTimer.current) clearTimeout(pushTimer.current)
      pushTimer.current = setTimeout(() => {
        pushTimer.current = null
        router.push(`?${params.toString()}`)
      }, NAVIGATION_SETTLE_MS)
    },
    [router, searchParams]
  )

  const goToMonth = useCallback(
    (target: MonthCursor) => {
      if (
        compareMonthCursor(target, minCursor) < 0 ||
        compareMonthCursor(target, maxCursor) > 0
      ) {
        return
      }
      navigate(cursorToDate(target))
    },
    [minCursor, maxCursor, navigate]
  )

  const goToPrevMonth = useCallback(() => {
    if (!canGoPrev) return
    navigate(startOfMonth(addMonths(currentMonth, -1)))
  }, [canGoPrev, currentMonth, navigate])

  const goToNextMonth = useCallback(() => {
    if (!canGoNext) return
    navigate(startOfMonth(addMonths(currentMonth, 1)))
  }, [canGoNext, currentMonth, navigate])

  const goToThisMonth = useCallback(() => {
    const nowCursor = dateToCursor(new Date())
    // Clamp to bounds
    const target =
      compareMonthCursor(nowCursor, maxCursor) > 0
        ? maxCursor
        : compareMonthCursor(nowCursor, minCursor) < 0
          ? minCursor
          : nowCursor
    navigate(cursorToDate(target))
  }, [minCursor, maxCursor, navigate])

  return {
    cursor,
    goToMonth,
    goToPrevMonth,
    goToNextMonth,
    goToThisMonth,
    canGoPrev,
    canGoNext,
    minLimitLabel,
    maxLimitLabel,
  }
}
