'use client'

import { useEffect, useRef, useState } from 'react'

import { useToast } from '@/components/ui/use-toast'

import { useSheetParams } from '../use-sheet-params'
import type { SheetEntityKey } from '../entities'
import type { SheetInitEntity, SheetInitPayloads } from '../init/payloads'

const cacheKey = (entity: string, value: string) => `${entity}:${value}`

/**
 * Payloads already fetched this page-load. A sheet's reference data (admin
 * list, project list, client directory) barely changes within a session, so
 * caching lets a re-open render on the first frame instead of waiting a
 * round-trip — and lets callers warm it before the user clicks.
 */
const initCache = new Map<string, unknown>()

const fetchSheetInit = async (entity: string, value: string) => {
  const response = await fetch(
    `/api/sheets/init?entity=${entity}&id=${encodeURIComponent(value)}`
  )
  const result = (await response.json()) as
    | { ok: true; data: unknown }
    | { ok: false; error?: string }

  if (!result.ok) {
    throw new Error(result.error ?? 'Unable to load sheet data')
  }

  initCache.set(cacheKey(entity, value), result.data)
  return result.data
}

/**
 * Warms the cache for a sheet the user is likely to open next, so the sheet
 * can render immediately rather than after a round-trip. Failures are
 * ignored — the real open re-requests and surfaces the error then.
 */
export function prefetchSheetInit(entity: SheetInitEntity, value: string) {
  if (initCache.has(cacheKey(entity, value))) {
    return
  }
  void fetchSheetInit(entity, value).catch(() => {})
}

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
  // Seed from the cache so a warmed sheet renders on its first frame.
  const [data, setData] = useState<SheetInitPayloads[E] | null>(
    () => (initCache.get(cacheKey(entity, value)) as SheetInitPayloads[E]) ?? null
  )
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

  // Retire the cached payload once this sheet leaves the DOM (or swaps
  // value, e.g. create→edit). The sheet is where the record gets EDITED, so
  // a payload cached before a session of edits is exactly the one that must
  // not seed the next open: the form baselines on the first data it sees and
  // deliberately never re-baselines on a same-id refetch, so a stale seed
  // showed pre-edit values and read as "my change didn't save". Prefetch
  // warming (the cache's real win) is unaffected.
  useEffect(
    () => () => {
      initCache.delete(cacheKey(entity, value))
    },
    [entity, value]
  )

  useEffect(() => {
    let cancelled = false
    requestedValueRef.current = value
    // Deliberately keeps the previous payload while refetching: on
    // create-save the param swaps `new` for the created id, and blanking
    // here would unmount the open sheet mid-flow. The sheet keeps its
    // current contents until the fresh record lands.

    const load = async () => {
      try {
        const payload = (await fetchSheetInit(
          entity,
          value
        )) as SheetInitPayloads[E]

        if (cancelled || requestedValueRef.current !== value) {
          return
        }

        setData(payload)
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
