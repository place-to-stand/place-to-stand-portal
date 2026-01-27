'use client'

import { useState, useEffect, useCallback } from 'react'
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
  const [isSearching, setIsSearching] = useState(false)

  // Handle search submission
  const handleSearch = useCallback(
    (query: string) => {
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

    // Use queueMicrotask to avoid synchronous setState in effect body
    queueMicrotask(() => setIsSearching(true))
    const timer = setTimeout(() => {
      handleSearch(searchInput)
      // Don't set isSearching false here - router.push is async
      // The effect below will clear it when navigation completes
    }, 300)

    return () => {
      clearTimeout(timer)
      // Don't clear isSearching here - if user is still typing, we stay in searching state
    }
  }, [searchInput, searchQuery, handleSearch])

  // Clear searching state when URL search query updates to match input (navigation complete)
  useEffect(() => {
    if (searchInput === searchQuery) {
      // Use queueMicrotask to avoid synchronous setState in effect body
      queueMicrotask(() => setIsSearching(false))
    }
  }, [searchQuery, searchInput])

  return {
    searchInput,
    setSearchInput,
    isSearching,
    handleSearch,
    handleClearSearch,
  }
}
