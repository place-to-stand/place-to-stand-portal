'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
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
  // Track if we're currently waiting for a search to complete
  const pendingSearchRef = useRef<string | null>(null)

  // Derive isSearching from whether we have a pending search that doesn't match URL
  const isSearching = pendingSearchRef.current !== null && pendingSearchRef.current !== searchQuery

  // Handle search submission
  const handleSearch = useCallback(
    (query: string) => {
      pendingSearchRef.current = query
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
    },
    [router, searchParams]
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

    pendingSearchRef.current = searchInput
    const timer = setTimeout(() => {
      handleSearch(searchInput)
    }, 300)

    return () => {
      clearTimeout(timer)
    }
  }, [searchInput, searchQuery, handleSearch])

  // Clear pending search when URL search query updates to match
  useEffect(() => {
    if (pendingSearchRef.current === searchQuery) {
      pendingSearchRef.current = null
    }
  }, [searchQuery])

  return {
    searchInput,
    setSearchInput,
    isSearching,
    handleSearch,
    handleClearSearch,
  }
}
