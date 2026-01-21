'use client'

import { useState, useEffect, useCallback, useTransition } from 'react'
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import type { ReadonlyURLSearchParams } from 'next/navigation'

interface UseInboxSearchOptions {
  searchQuery: string
  searchParams: ReadonlyURLSearchParams
  router: AppRouterInstance
}

interface UseInboxSearchReturn {
  searchInput: string
  setSearchInput: (value: string) => void
  isSearching: boolean
  handleSearch: (query: string) => void
  handleClearSearch: () => void
}

export function useInboxSearch({
  searchQuery,
  searchParams,
  router,
}: UseInboxSearchOptions): UseInboxSearchReturn {
  const [searchInput, setSearchInput] = useState(searchQuery)
  const [isPending, startTransition] = useTransition()

  // Handle search submission
  const handleSearch = useCallback(
    (query: string) => {
      startTransition(() => {
        const params = new URLSearchParams(searchParams.toString())
        // Reset to page 1 and remove thread when searching
        params.delete('thread')
        params.delete('page')
        if (query.trim()) {
          params.set('q', query.trim())
        } else {
          params.delete('q')
        }
        const newUrl = params.toString()
          ? `/my/inbox?${params.toString()}`
          : '/my/inbox'
        router.push(newUrl)
      })
    },
    [router, searchParams, startTransition]
  )

  // Clear search
  const handleClearSearch = useCallback(() => {
    setSearchInput('')
    handleSearch('')
  }, [handleSearch])

  // Debounced live search - triggers after 300ms of no typing
  useEffect(() => {
    // Don't trigger on initial mount or if search hasn't changed
    if (searchInput === searchQuery) return

    const timer = setTimeout(() => {
      handleSearch(searchInput)
    }, 300)

    return () => {
      clearTimeout(timer)
    }
  }, [searchInput, searchQuery, handleSearch])

  return {
    searchInput,
    setSearchInput,
    isSearching: isPending,
    handleSearch,
    handleClearSearch,
  }
}
