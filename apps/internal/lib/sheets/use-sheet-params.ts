'use client'

import { useCallback, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import {
  NEW_SHEET_VALUE,
  SHEET_ENTITIES,
  isSheetEntityClaimed,
  isSheetEntityKey,
  isValidSheetParamValue,
  type SheetEntityKey,
} from './entities'
import { emitSheetOpen } from './pending-open'
import { writeShallowUrl } from './shallow-url'

export type SheetStackItem = {
  entity: SheetEntityKey
  value: string
}

export type SheetOpenOptions = {
  /**
   * Skip the server. Defaults to true when the page can't need it: a sheet
   * the page doesn't render itself (the SheetHost loads its own data) or a
   * create sheet. A host page passes true when it already holds the record,
   * e.g. a click on one of its own rows.
   */
  shallow?: boolean
}

/**
 * The one hook implementing the sheet deep-link conventions:
 * - open = push (Back closes the sheet), close = replace (Back after close
 *   doesn't reopen it), never scrolling
 * - writes skip the server (`writeShallowUrl`) unless the page must resolve
 *   the record itself: only `open` of a sheet the page renders, without
 *   `shallow`, goes through `router.push`
 * - all other params are preserved on every write
 * - param order in the URL is the sheet stack order — `open` appends,
 *   `close` removes only its own param (plus its aux params)
 */
export function useSheetParams() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  /** Entity params present in the URL, in stack (mount) order. */
  const stack = useMemo(() => {
    const items: SheetStackItem[] = []
    for (const [key, value] of searchParams.entries()) {
      if (
        isSheetEntityKey(key) &&
        value &&
        isValidSheetParamValue(value) &&
        !items.some(item => item.entity === key)
      ) {
        items.push({ entity: key, value })
      }
    }
    return items
  }, [searchParams])

  const get = useCallback(
    (entity: SheetEntityKey) => searchParams.get(entity),
    [searchParams]
  )

  const getAux = useCallback(
    (aux: string) => searchParams.get(aux),
    [searchParams]
  )

  const buildUrl = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString())
      mutate(params)
      const queryString = params.toString()
      return queryString ? `${pathname}?${queryString}` : pathname
    },
    [pathname, searchParams]
  )

  const open = useCallback(
    (
      entity: SheetEntityKey,
      value: string,
      /** Aux params written in the same push (e.g. a create-sheet prefill). */
      aux?: Record<string, string>,
      options?: SheetOpenOptions
    ) => {
      // Let the host mount now, before the URL write lands.
      emitSheetOpen(entity, value)
      const url = buildUrl(params => {
        // `set` keeps an existing param's stack position; `append` puts a
        // newly opened sheet on top.
        if (params.has(entity)) {
          params.set(entity, value)
        } else {
          params.append(entity, value)
        }
        for (const [key, auxValue] of Object.entries(aux ?? {})) {
          if (auxValue) {
            params.set(key, auxValue)
          } else {
            params.delete(key)
          }
        }
      })
      const shallow =
        options?.shallow ??
        (value === NEW_SHEET_VALUE ||
          !isSheetEntityClaimed(entity, pathname, value))
      if (shallow) {
        writeShallowUrl(url, 'push')
      } else {
        router.push(url, { scroll: false })
      }
    },
    [buildUrl, pathname, router]
  )

  const openNew = useCallback(
    (entity: SheetEntityKey, aux?: Record<string, string>) =>
      open(entity, NEW_SHEET_VALUE, aux),
    [open]
  )

  const close = useCallback(
    (entity: SheetEntityKey) => {
      writeShallowUrl(
        buildUrl(params => {
          params.delete(entity)
          for (const aux of SHEET_ENTITIES[entity].auxParams) {
            params.delete(aux)
          }
        }),
        'replace'
      )
    },
    [buildUrl]
  )

  return { stack, get, getAux, open, openNew, close }
}

/**
 * Param-mirrored selection for a host page's own sheet: local state opens the
 * sheet instantly while the URL catches up, and external URL changes
 * (back/forward, shared-link navigation) are adopted via the
 * adjust-state-during-render pattern rather than an effect. Mirrors the
 * submissions table precedent.
 */
export function useSheetParamSelection(entity: SheetEntityKey) {
  const { get, open, openNew, close } = useSheetParams()
  const param = get(entity)

  const [selectedValue, setSelectedValue] = useState<string | null>(param)
  const [lastParam, setLastParam] = useState<string | null>(param)
  if (param !== lastParam) {
    setLastParam(param)
    setSelectedValue(param)
  }

  const select = useCallback(
    (id: string) => {
      setSelectedValue(id)
      // The host page picked one of its own rows, so it holds the record.
      open(entity, id, undefined, { shallow: true })
    },
    [entity, open]
  )

  const openCreate = useCallback(() => {
    setSelectedValue(NEW_SHEET_VALUE)
    openNew(entity)
  }, [entity, openNew])

  const clear = useCallback(() => {
    setSelectedValue(null)
    close(entity)
  }, [close, entity])

  return {
    selectedValue,
    selectedId:
      selectedValue && selectedValue !== NEW_SHEET_VALUE ? selectedValue : null,
    isCreating: selectedValue === NEW_SHEET_VALUE,
    isOpen: selectedValue !== null,
    select,
    openCreate,
    clear,
  }
}

/**
 * A page's server-side "this link points nowhere" flag, shown only while the
 * URL still holds the link the server judged. Sheet writes skip the server,
 * so the flag would otherwise outlive a dismiss or a click on another row.
 */
export function useDeepLinkNotFound(entity: SheetEntityKey, notFound: boolean) {
  const { get } = useSheetParams()
  const param = get(entity)
  const [judged, setJudged] = useState({ notFound, param })
  const changed = judged.notFound !== notFound
  if (changed) {
    setJudged({ notFound, param })
  }
  return notFound && param === (changed ? param : judged.param)
}
