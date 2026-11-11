'use client'

import { useCallback, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import {
  NEW_SHEET_VALUE,
  duplicateSheetValue,
  parseDuplicateSourceId,
  type DuplicableSheetEntity,
  isSheetEntityClaimed,
  type SheetEntityKey,
} from './entities'
import { confirmDiscardAll } from './discard-guards'
import { emitSheetOpen } from './pending-open'
import { writeShallowUrl } from './shallow-url'
import {
  openTarget,
  parseSheetStack,
  removeSheetParams,
  swapSheetParam,
  type SheetStackItem,
} from './stack'
import { useSheetStackEntry } from './stack-entry'

export type { SheetStackItem } from './stack'

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
 * - param order in the URL is the sheet stack order, and the stack may hold
 *   several sheets of one entity (company A, a person, company B)
 * - opening a record stacks its sheet on top (a push: Back closes it),
 *   unless that record is already in the stack: then the sheets above it
 *   close, each asking first if it has unsaved changes, and you're back on
 *   it (a replace, like any close). One rule for every way to open a sheet.
 * - close = replace, never scrolling; all other params are preserved
 * - writes skip the server (`writeShallowUrl`) unless the page must resolve
 *   the record itself: only `open` of a sheet the page renders, without
 *   `shallow`, goes through `router.push`
 */
export function useSheetParams() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  /** The open sheets, bottom first. */
  const stack = useMemo(() => parseSheetStack(searchParams), [searchParams])

  /**
   * The entity's first param: the sheet a page that renders its own sheet
   * for this entity shows.
   */
  const get = useCallback(
    (entity: SheetEntityKey) =>
      stack.find(item => item.entity === entity)?.value ?? null,
    [stack]
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

  /**
   * The URL `open` lands on: this page with the sheet on top, or, when the
   * record is already open, with the sheets above it gone.
   */
  const hrefFor = useCallback(
    (entity: SheetEntityKey, value: string, aux?: Record<string, string>) => {
      const target = openTarget(stack, entity, value)
      return buildUrl(params => {
        if (target.kind === 'back') {
          removeSheetParams(params, target.above)
          return
        }
        params.append(entity, value)
        for (const [key, auxValue] of Object.entries(aux ?? {})) {
          if (auxValue) {
            params.set(key, auxValue)
          } else {
            params.delete(key)
          }
        }
      })
    },
    [buildUrl, stack]
  )

  /** Close these sheets (top first), after any unsaved-changes checks. */
  const goBackTo = useCallback(
    (above: SheetStackItem[]) => {
      if (above.length === 0) {
        return
      }
      confirmDiscardAll(above, () => {
        // Read the URL now: a check may have waited on a dialog.
        const params = new URLSearchParams(window.location.search)
        removeSheetParams(params, above)
        const queryString = params.toString()
        writeShallowUrl(
          queryString ? `${pathname}?${queryString}` : pathname,
          'replace'
        )
      })
    },
    [pathname]
  )

  const open = useCallback(
    (
      entity: SheetEntityKey,
      value: string,
      /** Aux params written in the same push (e.g. a create-sheet prefill). */
      aux?: Record<string, string>,
      options?: SheetOpenOptions
    ) => {
      const target = openTarget(stack, entity, value)
      if (target.kind === 'back') {
        goBackTo(target.above)
        return
      }
      const { item } = target
      // Let the host mount now, before the URL write lands.
      emitSheetOpen(item)
      const url = hrefFor(entity, value, aux)
      const shallow =
        options?.shallow ??
        (value === NEW_SHEET_VALUE ||
          item.ordinal > 0 ||
          !isSheetEntityClaimed(entity, pathname, value))
      if (shallow) {
        writeShallowUrl(url, 'push')
      } else {
        router.push(url, { scroll: false })
      }
    },
    [goBackTo, hrefFor, pathname, router, stack]
  )

  const openNew = useCallback(
    (entity: SheetEntityKey, aux?: Record<string, string>) =>
      open(entity, NEW_SHEET_VALUE, aux),
    [open]
  )

  /** Open the create sheet filled in from record `id` (`?task=copy-<id>`). */
  const duplicate = useCallback(
    (entity: DuplicableSheetEntity, id: string) =>
      open(entity, duplicateSheetValue(id), undefined, { shallow: true }),
    [open]
  )

  /**
   * Point an open sheet at another record in place (history replace): a
   * create sheet saved with "keep open" becomes the new record's sheet. The
   * param keeps its stack position. `from` is the sheet's current value. A
   * page that renders this sheet itself resolves the record on the server,
   * so that write goes through `router.replace`.
   */
  const swap = useCallback(
    (entity: SheetEntityKey, from: string, value: string) => {
      const item = stack.find(
        entry => entry.entity === entity && entry.value === from
      )
      if (!item) {
        return
      }
      emitSheetOpen({ ...item, value })
      const url = buildUrl(params => {
        swapSheetParam(params, entity, from, value)
      })
      if (item.ordinal === 0 && isSheetEntityClaimed(entity, pathname, value)) {
        router.replace(url, { scroll: false })
      } else {
        writeShallowUrl(url, 'replace')
      }
    },
    [buildUrl, pathname, router, stack]
  )

  /**
   * Close one sheet: `value` names it; without one, the entity's first
   * (the sheet a page renders itself).
   */
  const close = useCallback(
    (entity: SheetEntityKey, value?: string | null) => {
      const target = value ?? get(entity)
      if (!target) {
        return
      }
      writeShallowUrl(
        buildUrl(params => {
          removeSheetParams(params, [{ entity, value: target }])
        }),
        'replace'
      )
    },
    [buildUrl, get]
  )

  return {
    stack,
    get,
    getAux,
    hrefFor,
    open,
    openNew,
    duplicate,
    swap,
    close,
  }
}

/**
 * The param value of the sheet this component sits in: its stack entry's,
 * else (a sheet rendered outside an entry) the entity's top create sheet.
 */
export function useOwnSheetValue(entity: SheetEntityKey) {
  const entry = useSheetStackEntry()
  const { stack } = useSheetParams()
  if (entry?.entity === entity) {
    return entry.value
  }
  return (
    stack.findLast(
      item =>
        item.entity === entity &&
        (item.value === NEW_SHEET_VALUE ||
          parseDuplicateSourceId(item.value) !== null)
    )?.value ?? null
  )
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
  // A duplicate (`copy-<uuid>`) is the SheetHost's, never the page's own.
  const rawParam = get(entity)
  const param = parseDuplicateSourceId(rawParam) ? null : rawParam

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
