'use client'

import { useCallback, useMemo, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { useStartRefresh } from '@/components/layout/list-refresh'
import { writeShallowUrl } from '@/lib/sheets/shallow-url'

/**
 * Filter/search key declaration (PRD 004 §03, R2). Filters are declared
 * SEPARATELY from sort — `sort` must never be listed here, so sort-only
 * changes can never read as "filtered" (no `Showing N of M`, no
 * filtered-empty messaging).
 */
type ListFilterConfig = {
  /** Raw-value validator; invalid params don't count as active (PRD-003 R4). */
  isValid?: (value: string) => boolean
  /**
   * Normalized default when the param is absent. A param equal to this is
   * inactive (projects' implicit clean-URL status default).
   */
  defaultValue?: string
}

type UseListParamsOptions = {
  /** Route the filter state lives on ('/settings/users'). */
  basePath: string
  /** Pagination keys cleared on every update ('cursor'+'dir', or 'page'). */
  resetKeys: readonly string[]
  /** Filter/search keys only — never sort (R2). */
  filters?: Record<string, ListFilterConfig>
  /**
   * Keys the page filters in the browser from data it already holds (a
   * board's search). A change to these alone writes the URL without asking
   * the server for the page again.
   */
  shallowKeys?: readonly string[]
}

export function useListParams({
  basePath,
  resetKeys,
  filters,
  shallowKeys,
}: UseListParamsOptions) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const startRefresh = useStartRefresh()
  // The query of a push that hasn't landed yet. Filters show a pick at once
  // (optimistic), so a second pick can come before the first one's page
  // loads; building on the pending query keeps both instead of the second
  // dropping the first. Cleared once the URL catches up.
  const committed = searchParams.toString()
  const pending = useRef<{ base: string; query: string } | null>(null)

  const update = useCallback(
    (updates: Record<string, string | undefined>) => {
      const base =
        pending.current && pending.current.base === committed
          ? pending.current.query
          : committed
      const next = new URLSearchParams(base)

      for (const [key, value] of Object.entries(updates)) {
        if (value) {
          next.set(key, value)
        } else {
          next.delete(key)
        }
      }

      // Keyset invariant: any change through this hook resets pagination —
      // a stale cursor against a re-filtered/re-sorted set must be impossible.
      for (const key of resetKeys) {
        next.delete(key)
      }

      const queryString = next.toString()
      const url = queryString ? `${basePath}?${queryString}` : basePath
      const current = new URLSearchParams(base)
      const changed = Object.keys(updates).filter(
        key => (current.get(key) ?? undefined) !== (updates[key] || undefined)
      )
      if (
        shallowKeys &&
        changed.every(key => shallowKeys.includes(key)) &&
        window.location.pathname === basePath
      ) {
        // A shallow write changes the URL at once: nothing is pending.
        pending.current = null
        writeShallowUrl(url, 'push')
        return
      }
      pending.current = { base: committed, query: queryString }
      startRefresh(() => router.push(url))
    },
    [basePath, resetKeys, router, committed, shallowKeys, startRefresh]
  )

  const getParam = useCallback(
    (key: string) => searchParams.get(key) ?? undefined,
    [searchParams]
  )

  /**
   * Clear every declared filter key back to its default (absent) state.
   * Removing a param restores its implicit default (e.g. projects' status
   * filter), and `update` already clears pagination keys.
   */
  const reset = useCallback(() => {
    if (!filters) return
    update(
      Object.fromEntries(Object.keys(filters).map(key => [key, undefined]))
    )
  }, [filters, update])

  const hasActiveFilters = useMemo(() => {
    if (!filters) return false

    return Object.entries(filters).some(([key, config]) => {
      const raw = searchParams.get(key)
      if (raw === null) return false
      if (config.isValid && !config.isValid(raw)) return false
      if (config.defaultValue !== undefined) {
        return raw !== config.defaultValue
      }
      return raw.length > 0
    })
  }, [filters, searchParams])

  return { update, getParam, hasActiveFilters, reset }
}
