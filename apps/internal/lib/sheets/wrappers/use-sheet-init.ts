'use client'

import { useEffect, useRef, useState } from 'react'

import { useToast } from '@/components/ui/use-toast'

import { useSheetParams } from '../use-sheet-params'
import type { SheetEntityKey } from '../entities'
import type { SheetInitEntity, SheetInitPayloads } from '../init/payloads'

/**
 * Fetches `/api/sheets/init` for a host-rendered sheet wrapper. While
 * loading, callers render nothing (precedent: the lead task overlay) so the
 * sheet animates in exactly once, with real data. A failed load surfaces a
 * toast and closes the sheet's param so the URL doesn't point at a sheet
 * that can't render.
 */
export function useSheetInit<E extends SheetInitEntity & SheetEntityKey>(
  entity: E,
  value: string
) {
  const { close } = useSheetParams()
  const { toast } = useToast()
  const [data, setData] = useState<SheetInitPayloads[E] | null>(null)
  // The latest requested value — guards against out-of-order responses when
  // the param changes while a fetch is in flight.
  const requestedValueRef = useRef(value)
  // Held in a ref so the fetch effect depends only on the entity + value:
  // `close` and `toast` change identity on every URL change, which would
  // otherwise refetch (and blank out) an already-open sheet whenever another
  // sheet opens above it.
  const handlersRef = useRef({ close, toast })

  useEffect(() => {
    handlersRef.current = { close, toast }
  }, [close, toast])

  useEffect(() => {
    let cancelled = false
    requestedValueRef.current = value
    // Deliberately keeps the previous payload while refetching: on
    // create-save the param swaps `new` for the created id, and blanking
    // here would unmount the open sheet mid-flow. The sheet keeps its
    // current contents until the fresh record lands.

    const load = async () => {
      try {
        const response = await fetch(
          `/api/sheets/init?entity=${entity}&id=${encodeURIComponent(value)}`
        )
        const result = (await response.json()) as
          | { ok: true; data: SheetInitPayloads[E] }
          | { ok: false; error?: string }

        if (cancelled || requestedValueRef.current !== value) {
          return
        }

        if (!result.ok) {
          throw new Error(result.error ?? 'Unable to load sheet data')
        }

        setData(result.data)
      } catch (error) {
        if (cancelled || requestedValueRef.current !== value) {
          return
        }

        console.error(`[sheets] failed to load ${entity} sheet`, error)
        handlersRef.current.toast({
          variant: 'destructive',
          title: 'Unable to open the linked item',
          description:
            'It may have been deleted, or something went wrong loading it.',
        })
        handlersRef.current.close(entity)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [entity, value])

  return data
}
