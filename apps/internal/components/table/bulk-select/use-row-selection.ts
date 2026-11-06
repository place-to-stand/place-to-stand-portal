'use client'

import { useCallback, useMemo, useState } from 'react'

export type HeadCheckState = 'none' | 'some' | 'all'

type State = {
  /** The page the ticks belong to: a new page or filter starts empty. */
  scope: string
  ids: ReadonlySet<string>
  /** "Select all N": every row matching the filters, on every page. */
  allMatching: boolean
  /** Last row ticked, for shift-click ranges. */
  anchor: string | null
}

const EMPTY: ReadonlySet<string> = new Set()

/**
 * Which rows of a list page are ticked. Ticks reset when the rows on the
 * page change (paging, filtering, or a refresh after a bulk action), so a
 * tick can never point at a row the person can't see.
 */
export function useRowSelection(pageIds: string[], matchingCount: number) {
  const scope = pageIds.join(',')
  const [state, setState] = useState<State>({
    scope,
    ids: EMPTY,
    allMatching: false,
    anchor: null,
  })
  const current: State =
    state.scope === scope
      ? state
      : { scope, ids: EMPTY, allMatching: false, anchor: null }

  const update = useCallback(
    (next: (previous: State) => Omit<State, 'scope'>) =>
      setState(previous => {
        const base =
          previous.scope === scope
            ? previous
            : { scope, ids: EMPTY, allMatching: false, anchor: null }
        return { scope, ...next(base) }
      }),
    [scope]
  )

  const toggle = useCallback(
    (id: string, { range = false }: { range?: boolean } = {}) =>
      update(previous => {
        const ids = new Set(previous.ids)
        const turnOn = !ids.has(id)
        const from = previous.anchor ? pageIds.indexOf(previous.anchor) : -1
        const to = pageIds.indexOf(id)
        if (range && from !== -1 && to !== -1) {
          const [start, end] = from < to ? [from, to] : [to, from]
          for (const rangeId of pageIds.slice(start, end + 1)) {
            if (turnOn) ids.add(rangeId)
            else ids.delete(rangeId)
          }
        } else if (turnOn) {
          ids.add(id)
        } else {
          ids.delete(id)
        }
        // Unticking one row leaves "every matching row" for this page's ticks.
        return { ids, allMatching: false, anchor: id }
      }),
    [pageIds, update]
  )

  const headState: HeadCheckState =
    current.ids.size === 0
      ? 'none'
      : current.ids.size === pageIds.length
        ? 'all'
        : 'some'

  /** The header box: tick the whole page, or clear it when it's all ticked. */
  const toggleAll = useCallback(
    () =>
      update(previous =>
        previous.ids.size === pageIds.length
          ? { ids: EMPTY, allMatching: false, anchor: null }
          : { ids: new Set(pageIds), allMatching: false, anchor: null }
      ),
    [pageIds, update]
  )

  /**
   * Ticks or clears a group of rows, for a list split into several tables
   * (Projects: by client, internal, personal), each with its own header box.
   */
  const toggleGroup = useCallback(
    (groupIds: string[]) =>
      update(previous => {
        const ids = new Set(previous.ids)
        const allOn = groupIds.every(id => ids.has(id))
        for (const id of groupIds) {
          if (allOn) ids.delete(id)
          else ids.add(id)
        }
        return { ids, allMatching: false, anchor: null }
      }),
    [update]
  )

  const selectAllMatching = useCallback(
    () =>
      update(() => ({
        ids: new Set(pageIds),
        allMatching: true,
        anchor: null,
      })),
    [pageIds, update]
  )

  const clear = useCallback(
    () => update(() => ({ ids: EMPTY, allMatching: false, anchor: null })),
    [update]
  )

  return useMemo(
    () => ({
      ids: current.ids,
      allMatching: current.allMatching,
      /** Rows the action will cover. */
      count: current.allMatching ? matchingCount : current.ids.size,
      pageCount: pageIds.length,
      matchingCount,
      /** Any row ticked: every row shows its box. */
      active: current.ids.size > 0,
      headState,
      /** Offer "Select all N" once the whole page is ticked. */
      canSelectAllMatching:
        headState === 'all' &&
        !current.allMatching &&
        matchingCount > pageIds.length,
      isSelected: (id: string) => current.ids.has(id),
      groupState: (groupIds: string[]): HeadCheckState => {
        const on = groupIds.filter(id => current.ids.has(id)).length
        return on === 0 ? 'none' : on === groupIds.length ? 'all' : 'some'
      },
      toggle,
      toggleAll,
      toggleGroup,
      selectAllMatching,
      clear,
    }),
    [
      current.ids,
      current.allMatching,
      matchingCount,
      pageIds.length,
      headState,
      toggle,
      toggleAll,
      toggleGroup,
      selectAllMatching,
      clear,
    ]
  )
}

export type RowSelection = ReturnType<typeof useRowSelection>
