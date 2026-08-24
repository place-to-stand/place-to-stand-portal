'use client'

import { useCallback, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

/**
 * `?session=` drives which session is shown in the right pane — plain URL
 * state (shallow replace, no server round-trip forced), not the sheet
 * system: this is an inline pane swap, not an overlay.
 */
export function useSelectedSession() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const paramValue = searchParams.get('session')

  const [selectedId, setSelectedId] = useState<string | null>(paramValue)
  const [lastParam, setLastParam] = useState<string | null>(paramValue)
  if (paramValue !== lastParam) {
    setLastParam(paramValue)
    setSelectedId(paramValue)
  }

  const select = useCallback(
    (id: string | null) => {
      setSelectedId(id)
      const params = new URLSearchParams(searchParams.toString())
      if (id) {
        params.set('session', id)
      } else {
        params.delete('session')
      }
      const query = params.toString()
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams]
  )

  return { selectedId, select }
}
