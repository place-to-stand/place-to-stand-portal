'use client'

import { useCallback, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import {
  NEW_SHEET_VALUE,
  SHEET_ENTITIES,
  duplicateSheetValue,
  parseDuplicateSourceId,
  type DuplicableSheetEntity,
  type SheetEntityKey,
} from './entities'
import { confirmDiscardAll } from './discard-guards'
import { emitSheetOpen } from './pending-open'
import { writeShallowUrl } from './shallow-url'
import {
  isStackItemClaimed,
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
 * The params as the browser holds them now. Writes read these, not the
 * render's: a sheet that closes and opens another in one handler (winning
 * a lead opens its company) must see its own close.
 */
const liveParams = () => new URLSearchParams(window.location.search)

/**
 * The one hook implementing the sheet deep-link conventions:
 * - param order in the URL is the sheet stack order, and the stack may hold
 *   several sheets of one entity (company A, a person, company B)
 * - opening a record stacks its sheet on top (a push: Back closes it),
 *   unless that record is already in the stack: then the sheets above it
 *   close, each asking first if it has unsaved changes, and you're back on
 *   it (a replace, like any close). A create sheet always stacks. One rule
 *   for every way to open a sheet.
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
   * The sheet a page that renders its own sheet for this entity shows: the
   * bottom of the stack, when it is this entity's (see `isStackItemClaimed`).
   */
  const get = useCallback(
    (entity: SheetEntityKey) =>
      stack[0]?.entity === entity ? stack[0].value : null,
    [stack]
  )

  const getAux = useCallback(
    (aux: string) => searchParams.get(aux),
    [searchParams]
  )

  const urlFor = useCallback(
    (params: URLSearchParams) => {
      const queryString = params.toString()
      return queryString ? `${pathname}?${queryString}` : pathname
    },
    [pathname]
  )

  /** `open`'s change to `params`: what the stack becomes. */
  const applyOpen = useCallback(
    (
      params: URLSearchParams,
      entity: SheetEntityKey,
      value: string,
      aux?: Record<string, string>
    ) => {
      const target = openTarget(parseSheetStack(params), entity, value)
      if (target.kind === 'back') {
        removeSheetParams(
          params,
          target.above.map(item => item.id)
        )
        return target
      }
      // Aux params prefill an entity's create sheet. A second draft of the
      // entity gets its prefill in memory (the host hands it over), so the
      // URL's stays with the first draft, which may be reading it.
      const draftBelow =
        value === NEW_SHEET_VALUE &&
        parseSheetStack(params).some(
          item => item.entity === entity && item.value === NEW_SHEET_VALUE
        )
      params.append(entity, value)
      if (draftBelow) {
        return target
      }
      if (value === NEW_SHEET_VALUE) {
        // A fresh draft never inherits another's prefill.
        for (const key of SHEET_ENTITIES[entity].auxParams) {
          if (!(key in (aux ?? {}))) {
            params.delete(key)
          }
        }
      }
      for (const [key, auxValue] of Object.entries(aux ?? {})) {
        if (auxValue) {
          params.set(key, auxValue)
        } else {
          params.delete(key)
        }
      }
      return target
    },
    []
  )

  /**
   * The URL `open` lands on: this page with the sheet on top, or, when the
   * record is already open, with the sheets above it gone. For a link's
   * href (a new-tab click).
   */
  const hrefFor = useCallback(
    (entity: SheetEntityKey, value: string, aux?: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString())
      applyOpen(params, entity, value, aux)
      return urlFor(params)
    },
    [applyOpen, searchParams, urlFor]
  )

  /** Close these sheets (top first), after any unsaved-changes checks. */
  const goBack = useCallback(
    (above: SheetStackItem[]) => {
      if (above.length === 0) {
        return
      }
      const ids = above.map(item => item.id)
      const before = window.location.search
      confirmDiscardAll(ids, () => {
        // A check may have waited on a dialog: leave a stack that changed
        // meanwhile alone.
        if (window.location.search !== before) {
          return
        }
        const params = liveParams()
        removeSheetParams(params, ids)
        writeShallowUrl(urlFor(params), 'replace')
      })
    },
    [urlFor]
  )

  /**
   * Opens a sheet, or goes back to it. Returns the sheet's stack id, so a
   * picker that opened a create sheet takes only that sheet's new record.
   */
  const open = useCallback(
    (
      entity: SheetEntityKey,
      value: string,
      /** Aux params written in the same push (e.g. a create-sheet prefill). */
      aux?: Record<string, string>,
      options?: SheetOpenOptions
    ): string | null => {
      const live = liveParams()
      const target = openTarget(parseSheetStack(live), entity, value)
      if (target.kind === 'back') {
        goBack(target.above)
        return target.item.id
      }
      applyOpen(live, entity, value, aux)
      const item = parseSheetStack(live).findLast(
        entry => entry.entity === entity && entry.value === value
      )
      if (!item) {
        return null
      }
      // Let the host mount now, before the URL write lands.
      // No aux means no prefill: never the URL's, which may be another
      // draft's.
      emitSheetOpen({ kind: 'open', item, aux: aux ?? {} })
      const shallow =
        options?.shallow ??
        (value === NEW_SHEET_VALUE || !isStackItemClaimed(item, pathname))
      if (shallow) {
        writeShallowUrl(urlFor(live), 'push')
      } else {
        router.push(urlFor(live), { scroll: false })
      }
      return item.id
    },
    [applyOpen, goBack, pathname, router, urlFor]
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
   * Point an open sheet (`id`, its stack id) at another record in place
   * (history replace): a create sheet saved with "keep open" becomes the new
   * record's sheet. The param keeps its stack position. A page that renders
   * this sheet itself resolves the record on the server, so that write goes
   * through `router.replace`.
   */
  const swap = useCallback(
    (id: string, value: string) => {
      const params = liveParams()
      const item = swapSheetParam(params, id, value)
      if (!item) {
        return
      }
      const swapped = parseSheetStack(params).find(
        entry => entry.paramIndex === item.paramIndex
      )
      if (swapped) {
        emitSheetOpen({ kind: 'swap', from: id, item: swapped })
      }
      if (swapped && isStackItemClaimed(swapped, pathname)) {
        router.replace(urlFor(params), { scroll: false })
      } else {
        writeShallowUrl(urlFor(params), 'replace')
      }
    },
    [pathname, router, urlFor]
  )

  /**
   * Close one sheet: `id` (its stack id) names it; without one, the
   * entity's first (the sheet a page renders itself).
   */
  const close = useCallback(
    (entity: SheetEntityKey, id?: string | null) => {
      const params = liveParams()
      const target =
        id ?? parseSheetStack(params).find(item => item.entity === entity)?.id
      if (!target) {
        return
      }
      removeSheetParams(params, [target])
      writeShallowUrl(urlFor(params), 'replace')
    },
    [urlFor]
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
 * The stack id of the create sheet this component sits in: its stack
 * entry's, else (a sheet rendered outside an entry, or one whose entry has
 * no param) the entity's top create sheet.
 */
export function useOwnCreateSheetId(entity: SheetEntityKey) {
  const entry = useSheetStackEntry()
  const { stack } = useSheetParams()
  if (entry?.entity === entity && entry.id) {
    return entry.id
  }
  return (
    stack.findLast(
      item =>
        item.entity === entity &&
        (item.value === NEW_SHEET_VALUE ||
          parseDuplicateSourceId(item.value) !== null)
    )?.id ?? null
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
