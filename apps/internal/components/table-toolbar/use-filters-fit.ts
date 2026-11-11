'use client'

import { useLayoutEffect, useRef, useState, type RefObject } from 'react'

/**
 * Space kept free at the row's end for the controls that come and go: Reset
 * (shown only while a filter is set) and the refresh spinner (only while the
 * list reloads). Holding it always means neither can tip the row into
 * folding, so the bar never changes shape under the pointer.
 */
const RESET_ROOM_PX = 72
const SPINNER_ROOM_PX = 36

/** Elements laid out by `el`'s flex row, looking through `display: contents`. */
function flexItems(el: Element): Element[] {
  const items: Element[] = []
  for (const child of Array.from(el.children)) {
    const display = getComputedStyle(child).display
    if (display === 'contents') items.push(...flexItems(child))
    else if (display !== 'none') items.push(child)
  }
  return items
}

/**
 * The width the bar's row needs to sit on one line: every control plus the
 * gaps between them, with room held for Reset and the spinner.
 */
function inlineWidth(bar: HTMLElement): number {
  const gap = parseFloat(getComputedStyle(bar).columnGap) || 0
  const items = flexItems(bar).filter(item => {
    const slot = item.getAttribute('data-slot')
    return slot !== 'refresh-spinner' && slot !== 'reset-filters'
  })
  const widths = items.reduce(
    (sum, item) => sum + item.getBoundingClientRect().width,
    0
  )
  const reserved = RESET_ROOM_PX + SPINNER_ROOM_PX
  return widths + reserved + gap * (items.length + 1)
}

/**
 * True while the user is in an inline filter: focused, its list open, or
 * focus still in a list that is closing (it hands focus back to the filter).
 */
function inUse(inline: HTMLElement): boolean {
  const active = document.activeElement
  return (
    inline.contains(active) ||
    active?.closest('[data-slot="popover-content"]') != null ||
    inline.querySelector('[aria-expanded="true"]') !== null
  )
}

/** True while the Filters button has focus, which unfolding would hide. */
function onFiltersButton(): boolean {
  return (
    document.activeElement?.closest('[data-slot="filter-sheet-button"]') != null
  )
}

export type FiltersFit = {
  /** The filters sit in the Filters button instead of the row. */
  folded: boolean
  /**
   * The first measurement has run. Until then the bar keeps to one line
   * (clipped), so a row that will fold never shows wrapped first.
   */
  measured: boolean
}

/**
 * Whether a filter bar's filters should fold into its Filters button because
 * they no longer fit beside the search on one line. Decided by the bar's own
 * width, not the screen's, so a narrow panel folds as well as a narrow
 * window. Below md the filters always fold (by CSS), and this stays out of it.
 *
 * `inline` is the wrapper holding the inline filters: hidden by CSS below md,
 * which tells the hook to leave the phone layout alone. `filterCount` changes
 * when filters come or go; a folded bar then lays them out again to re-measure.
 * The bar never folds under a filter the user is in (focused or open); it
 * waits until they leave it. Nor does it unfold while `sheetOpen` (the
 * filters would show twice) or while the Filters button has focus (it would
 * vanish from under it); it waits for the sheet to close and focus to move.
 */
export function useFiltersFit(
  bar: RefObject<HTMLElement | null>,
  inline: RefObject<HTMLElement | null>,
  enabled: boolean,
  filterCount: number,
  sheetOpen: boolean
): FiltersFit {
  const [folded, setFolded] = useState(false)
  const [measured, setMeasured] = useState(false)
  // What the row needed the last time it was laid out inline. While folded
  // the filters can't be measured, so this says when they fit again.
  const neededRef = useRef(0)
  const countRef = useRef(filterCount)
  // Whether focus was on the bar (or in its sheet as it closed), so a fold
  // or unfold that hides the focused control hands focus to its stand-in.
  const keepFocusRef = useRef(false)
  const firstLayoutRef = useRef(true)

  useLayoutEffect(() => {
    // A filter's list and the Filters sheet render outside the bar, but
    // focus in them still belongs to it.
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target as Element | null
      keepFocusRef.current =
        (bar.current?.contains(target) ?? false) ||
        target?.closest(
          '[data-slot="popover-content"], [data-slot="sheet-content"]'
        ) != null
    }
    // Leaving for nothing (a click on empty space) while the control is
    // still on screen is the user's choice; only a control that vanished
    // loses focus by accident.
    const onFocusOut = (event: FocusEvent) => {
      const target = event.target as HTMLElement | null
      if (!event.relatedTarget && target?.isConnected && target.offsetParent) {
        keepFocusRef.current = false
      }
    }
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    return () => {
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
    }
  }, [bar])

  // The sheet hands focus back to its button as it closes; if the bar has
  // unfolded by then, that button is gone.
  const sheetWasOpenRef = useRef(sheetOpen)
  useLayoutEffect(() => {
    if (sheetWasOpenRef.current && !sheetOpen) keepFocusRef.current = true
    sheetWasOpenRef.current = sheetOpen
  }, [sheetOpen])

  // After a fold or unfold, put focus back if it fell off a hidden control:
  // on the Filters button after a fold, on the first filter after an unfold.
  // Two frames, so any focus the browser or a closing popup moves lands first.
  useLayoutEffect(() => {
    if (firstLayoutRef.current) {
      firstLayoutRef.current = false
      return
    }
    let second = 0
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        if (!keepFocusRef.current) return
        const active = document.activeElement as HTMLElement | null
        if (active && active !== document.body && active.offsetParent) return
        const target = folded
          ? bar.current?.querySelector<HTMLElement>(
              '[data-slot="filter-sheet-button"]'
            )
          : inline.current?.querySelector<HTMLElement>('button, input')
        target?.focus()
      })
    })
    return () => {
      cancelAnimationFrame(first)
      cancelAnimationFrame(second)
    }
  }, [folded, bar, inline])

  // Filters came or went while folded: lay them out to measure them again.
  // A layout effect, so the inline pass never paints.
  useLayoutEffect(() => {
    if (countRef.current === filterCount) return
    countRef.current = filterCount
    setFolded(false)
  }, [filterCount])

  useLayoutEffect(() => {
    const barEl = bar.current
    if (!enabled || !barEl) return

    const check = () => {
      const inlineEl = inline.current
      const available = barEl.clientWidth
      if (!folded) {
        // Below md the CSS has already folded them: nothing to measure.
        if (!inlineEl || getComputedStyle(inlineEl).display === 'none') {
          setMeasured(true)
          return
        }
        neededRef.current = inlineWidth(barEl)
        setMeasured(true)
        if (available < neededRef.current && !inUse(inlineEl)) {
          setFolded(true)
        }
      } else if (
        !sheetOpen &&
        !onFiltersButton() &&
        available >= neededRef.current
      ) {
        setFolded(false)
      }
    }

    check()
    const resize = new ResizeObserver(check)
    resize.observe(barEl)
    // A fold or unfold put off while the user was on a control happens once
    // they leave it.
    const inlineEl = inline.current
    const recheck = () => requestAnimationFrame(check)
    barEl.addEventListener('focusout', recheck)
    const expanded = new MutationObserver(recheck)
    if (inlineEl) {
      expanded.observe(inlineEl, {
        subtree: true,
        attributes: true,
        attributeFilter: ['aria-expanded'],
      })
    }
    return () => {
      resize.disconnect()
      expanded.disconnect()
      barEl.removeEventListener('focusout', recheck)
    }
  }, [bar, inline, enabled, folded, sheetOpen])

  return { folded: enabled && folded, measured: !enabled || measured }
}
