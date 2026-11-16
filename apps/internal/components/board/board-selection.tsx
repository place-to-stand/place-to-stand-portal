'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react'

import {
  boardRange,
  hasSelectModifier,
  type BoardColumns,
} from '@/lib/dnd/board-selection'

/**
 * A selected card: the primary border and a ring around it, over whatever
 * the card shows otherwise (open, done), so it reads at a glance.
 */
export const BOARD_CARD_SELECTED_CLASS =
  'border-primary hover:border-primary ring-primary bg-primary/5 ring-1'

const EMPTY: ReadonlySet<string> = new Set()

type State = {
  ids: ReadonlySet<string>
  /** Last card picked, for shift-click ranges. */
  anchor: string | null
  /** Cards an archive is taking off the board, hidden until it lands. */
  hidden: ReadonlySet<string>
}

/**
 * Which cards of a board are selected, for the bulk bar. Shift-click picks
 * a range down one column, ⌘-click (Ctrl on Windows) adds or drops one card,
 * and the card menu's Select does the same as ⌘-click. A plain click still
 * opens the card. Escape clears the selection, and a card that leaves the
 * board (a filter, a refresh) leaves it too.
 *
 * `columns` lists each column's card ids in board order.
 */
export function useBoardSelection(columns: BoardColumns, enabled: boolean) {
  const [state, setState] = useState<State>({
    ids: EMPTY,
    anchor: null,
    hidden: EMPTY,
  })

  const onBoard = useMemo(() => new Set(columns.flat()), [columns])
  // Derived, so a card a filter hides drops out without an effect; a
  // hidden card stays hidden until fresh data takes it off the board.
  const ids = useMemo(
    () => keepOnBoard(state.ids, onBoard, state.hidden),
    [state.ids, onBoard, state.hidden]
  )
  const hidden = useMemo(
    () => keepOnBoard(state.hidden, onBoard, EMPTY),
    [state.hidden, onBoard]
  )
  const shownColumns = useMemo(
    () =>
      hidden.size
        ? columns.map(column => column.filter(id => !hidden.has(id)))
        : columns,
    [columns, hidden]
  )

  const toggle = useCallback(
    (id: string) =>
      setState(previous => {
        const next = new Set(previous.ids)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return { ...previous, ids: next, anchor: id }
      }),
    []
  )

  /** Shift-click: the cards between the last pick and this one. */
  const range = useCallback(
    (id: string) =>
      setState(previous => {
        const span = previous.anchor
          ? boardRange(shownColumns, previous.anchor, id)
          : null
        const next = new Set(previous.ids)
        // Same rule as a list: the clicked card's new state applies to the
        // whole range, so a second shift-click can take a range back off.
        const turnOn = !next.has(id)
        for (const rangeId of span ?? [id]) {
          if (turnOn) next.add(rangeId)
          else next.delete(rangeId)
        }
        return { ...previous, ids: next, anchor: id }
      }),
    [shownColumns]
  )

  const clear = useCallback(
    () => setState(previous => ({ ...previous, ids: EMPTY, anchor: null })),
    []
  )

  /**
   * Takes cards off the board while an archive saves. Returns the undo for
   * the cards the save refused.
   */
  const hide = useCallback((hideIds: readonly string[]) => {
    setState(previous => {
      const next = new Set(previous.hidden)
      hideIds.forEach(id => next.add(id))
      return { ...previous, hidden: next }
    })
    return (showIds: readonly string[]) =>
      setState(previous => {
        const next = new Set(previous.hidden)
        showIds.forEach(id => next.delete(id))
        return { ...previous, hidden: next }
      })
  }, [])

  const active = enabled && ids.size > 0

  useEffect(() => {
    if (!active) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      // A sheet, dialog or menu over the board takes Escape for itself.
      if (document.querySelector('[role="dialog"], [role="menu"]')) return
      clear()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [active, clear])

  return useMemo(
    () => ({
      enabled,
      ids,
      count: ids.size,
      active,
      /** Boards act on the cards picked, never "every match". */
      allMatching: false as const,
      canSelectAllMatching: false as const,
      matchingCount: ids.size,
      selectAllMatching: () => {},
      isSelected: (id: string) => ids.has(id),
      /**
       * A card click with Shift, ⌘ or Ctrl selects instead of opening.
       * Returns true when it did.
       */
      click: (id: string, event: MouseEvent) => {
        if (!enabled || !hasSelectModifier(event)) return false
        if (event.shiftKey) range(id)
        else toggle(id)
        return true
      },
      toggle,
      clear,
      hidden,
      hide,
    }),
    [enabled, ids, active, range, toggle, clear, hidden, hide]
  )
}

export type BoardSelection = ReturnType<typeof useBoardSelection>

function keepOnBoard(
  ids: ReadonlySet<string>,
  onBoard: ReadonlySet<string>,
  hidden: ReadonlySet<string>
): ReadonlySet<string> {
  if (ids.size === 0) return EMPTY
  let changed = false
  const kept = new Set<string>()
  ids.forEach(id => {
    if (onBoard.has(id) && !hidden.has(id)) kept.add(id)
    else changed = true
  })
  return changed ? kept : ids
}

const BoardSelectionContext = createContext<BoardSelection | null>(null)

export function BoardSelectionProvider({
  selection,
  children,
}: {
  selection: BoardSelection
  children: ReactNode
}) {
  return (
    <BoardSelectionContext.Provider value={selection}>
      {children}
    </BoardSelectionContext.Provider>
  )
}

/**
 * One card's part of its board's selection; null off a board (the lead
 * sheet's task cards) or for a viewer who can't act on the cards.
 */
export function useBoardCardSelection(id: string) {
  const selection = useContext(BoardSelectionContext)
  if (!selection?.enabled) return null
  return {
    selected: selection.isSelected(id),
    /** For the card's onClick: true when the click selected. */
    click: (event: MouseEvent) => selection.click(id, event),
    toggle: () => selection.toggle(id),
  }
}

export type BoardCardSelection = NonNullable<
  ReturnType<typeof useBoardCardSelection>
>

/**
 * What a board card spreads on its root to join the selection: a click with
 * Shift, ⌘ or Ctrl selects instead of calling `open`, a shift-press doesn't
 * select text, and the card menu gets Select. `listeners` are the card's
 * dnd-kit listeners, whose mouse-down this keeps.
 */
export function useSelectableCard(
  id: string,
  open: () => void,
  listeners: object | undefined
) {
  const selection = useBoardCardSelection(id)
  const selected = selection?.selected ?? false
  const dragMouseDown = (
    listeners as { onMouseDown?: (event: MouseEvent) => void } | undefined
  )?.onMouseDown
  return {
    selected,
    /** For the card's context menu. */
    select: selection
      ? { selected, toggle: selection.toggle }
      : (undefined as undefined),
    /** Spread after the dnd-kit listeners. */
    props: {
      'data-selected': selected || undefined,
      onMouseDown: (event: MouseEvent) => {
        dragMouseDown?.(event)
        if (event.shiftKey && selection) event.preventDefault()
      },
      onClick: (event: MouseEvent) => {
        if (selection?.click(event)) return
        open()
      },
    },
    /** Screen readers hear that the card is selected. */
    note: selected ? <span className='sr-only'>Selected</span> : null,
  }
}
