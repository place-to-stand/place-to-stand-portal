'use client'

import { useCallback } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { useStartRefresh } from '@/components/layout/list-refresh'

/**
 * Page changes for a paged list: writes `?page=` (dropped on page 1) and
 * keeps every other param. Pass the result to `PaginationControls`'
 * `onPageChange`.
 */
export function usePageParam(): (page: number) => void {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const startRefresh = useStartRefresh()

  return useCallback(
    (page: number) => {
      const params = new URLSearchParams(searchParams.toString())
      if (page <= 1) {
        params.delete('page')
      } else {
        params.set('page', String(page))
      }
      const query = params.toString()
      startRefresh(() => router.push(query ? `${pathname}?${query}` : pathname))
    },
    [pathname, router, searchParams, startRefresh]
  )
}
