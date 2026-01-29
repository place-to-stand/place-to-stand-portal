'use client'

import { useCallback, useMemo, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { addMonths, getMonth, getYear, startOfMonth } from 'date-fns'

import type { MonthCursor } from '@/lib/data/reports/types'

type UseReportNavigationOptions = {
  minCursor: MonthCursor
  maxCursor: MonthCursor
}

type UseReportNavigationResult = {
  currentMonth: Date
  monthValue: string
  yearValue: string
  setYearValue: (value: string) => void
  selectMonth: (value: string) => void
  commitYearChange: () => void
  goToPrevMonth: () => void
  goToNextMonth: () => void
  goToThisMonth: () => void
  canGoPrev: boolean
  canGoNext: boolean
  minLimitLabel: string
  maxLimitLabel: string
}

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

function compareMonthCursor(a: MonthCursor, b: MonthCursor): number {
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

/**
 * Hook for report month/year navigation with URL persistence and bounds checking.
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

    // Validate month (0-11) and year
    const validMonth =
      Number.isFinite(parsedMonth) && parsedMonth >= 0 && parsedMonth <= 11
        ? parsedMonth
        : getMonth(now)
    const validYear = Number.isFinite(parsedYear) ? parsedYear : getYear(now)

    return startOfMonth(new Date(validYear, validMonth, 1))
  }, [searchParams])

  const [currentMonth, setCurrentMonth] = useState(() => initialMonth)
  const [monthValue, setMonthValue] = useState(() =>
    String(getMonth(initialMonth))
  )
  const [yearValue, setYearValue] = useState(() =>
    String(getYear(initialMonth))
  )

  // Sync local state when URL changes
  useEffect(() => {
    setCurrentMonth(initialMonth)
    setMonthValue(String(getMonth(initialMonth)))
    setYearValue(String(getYear(initialMonth)))
  }, [initialMonth])

  // Compute navigation bounds
  const currentCursor = useMemo(() => dateToCursor(currentMonth), [currentMonth])

  const canGoPrev = useMemo(
    () => compareMonthCursor(currentCursor, minCursor) > 0,
    [currentCursor, minCursor]
  )

  const canGoNext = useMemo(
    () => compareMonthCursor(currentCursor, maxCursor) < 0,
    [currentCursor, maxCursor]
  )

  const minLimitLabel = useMemo(() => formatMonthLabel(minCursor), [minCursor])
  const maxLimitLabel = useMemo(() => formatMonthLabel(maxCursor), [maxCursor])

  // Update URL when month changes
  const updateUrl = useCallback(
    (month: Date) => {
      const params = new URLSearchParams(searchParams.toString())
      // URL uses 0-indexed months
      params.set('month', String(getMonth(month)))
      params.set('year', String(getYear(month)))
      router.push(`?${params.toString()}`)
    },
    [router, searchParams]
  )

  const selectMonth = useCallback(
    (value: string) => {
      setMonthValue(value)
      const monthNumber = parseInt(value, 10)

      if (Number.isNaN(monthNumber)) {
        return
      }

      const parsedYear = parseInt(yearValue, 10)
      const yearNumber = Number.isNaN(parsedYear)
        ? getYear(currentMonth)
        : parsedYear

      const nextMonth = startOfMonth(new Date(yearNumber, monthNumber, 1))

      // Check if within bounds
      const nextCursor = dateToCursor(nextMonth)
      if (compareMonthCursor(nextCursor, minCursor) < 0) {
        return // Before min
      }
      if (compareMonthCursor(nextCursor, maxCursor) > 0) {
        return // After max
      }

      setCurrentMonth(nextMonth)
      updateUrl(nextMonth)
    },
    [currentMonth, minCursor, maxCursor, updateUrl, yearValue]
  )

  const commitYearChange = useCallback(() => {
    const parsedYear = parseInt(yearValue, 10)

    if (Number.isNaN(parsedYear)) {
      setYearValue(String(getYear(currentMonth)))
      return
    }

    const nextMonth = startOfMonth(
      new Date(parsedYear, getMonth(currentMonth), 1)
    )

    // Check if within bounds
    const nextCursor = dateToCursor(nextMonth)
    if (compareMonthCursor(nextCursor, minCursor) < 0) {
      // Clamp to min
      const clampedMonth = startOfMonth(
        new Date(minCursor.year, minCursor.month - 1, 1)
      )
      setCurrentMonth(clampedMonth)
      setMonthValue(String(minCursor.month - 1))
      setYearValue(String(minCursor.year))
      updateUrl(clampedMonth)
      return
    }
    if (compareMonthCursor(nextCursor, maxCursor) > 0) {
      // Clamp to max
      const clampedMonth = startOfMonth(
        new Date(maxCursor.year, maxCursor.month - 1, 1)
      )
      setCurrentMonth(clampedMonth)
      setMonthValue(String(maxCursor.month - 1))
      setYearValue(String(maxCursor.year))
      updateUrl(clampedMonth)
      return
    }

    setCurrentMonth(nextMonth)
    updateUrl(nextMonth)
  }, [currentMonth, minCursor, maxCursor, updateUrl, yearValue])

  const goToPrevMonth = useCallback(() => {
    if (!canGoPrev) return

    const nextMonth = startOfMonth(addMonths(currentMonth, -1))
    setCurrentMonth(nextMonth)
    setMonthValue(String(getMonth(nextMonth)))
    setYearValue(String(getYear(nextMonth)))
    updateUrl(nextMonth)
  }, [canGoPrev, currentMonth, updateUrl])

  const goToNextMonth = useCallback(() => {
    if (!canGoNext) return

    const nextMonth = startOfMonth(addMonths(currentMonth, 1))
    setCurrentMonth(nextMonth)
    setMonthValue(String(getMonth(nextMonth)))
    setYearValue(String(getYear(nextMonth)))
    updateUrl(nextMonth)
  }, [canGoNext, currentMonth, updateUrl])

  const goToThisMonth = useCallback(() => {
    const now = startOfMonth(new Date())
    const nowCursor = dateToCursor(now)

    // Clamp to bounds
    let targetMonth = now
    if (compareMonthCursor(nowCursor, maxCursor) > 0) {
      targetMonth = startOfMonth(new Date(maxCursor.year, maxCursor.month - 1, 1))
    } else if (compareMonthCursor(nowCursor, minCursor) < 0) {
      targetMonth = startOfMonth(new Date(minCursor.year, minCursor.month - 1, 1))
    }

    setCurrentMonth(targetMonth)
    setMonthValue(String(getMonth(targetMonth)))
    setYearValue(String(getYear(targetMonth)))
    updateUrl(targetMonth)
  }, [minCursor, maxCursor, updateUrl])

  return {
    currentMonth,
    monthValue,
    yearValue,
    setYearValue,
    selectMonth,
    commitYearChange,
    goToPrevMonth,
    goToNextMonth,
    goToThisMonth,
    canGoPrev,
    canGoNext,
    minLimitLabel,
    maxLimitLabel,
  }
}
