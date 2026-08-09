import type { KeyboardEvent, MouseEvent } from 'react'

/**
 * Row-as-button affordance for list tables whose primary action is opening a
 * sheet or navigating to a detail view. Pair `CLICKABLE_ROW_CLASS` with
 * `getClickableRowProps(onActivate)` spread onto a `<TableRow>`.
 *
 * Clicks on interactive content inside the row (links, buttons, switches,
 * hover-card triggers, disabled-control tooltip wrappers) never activate the
 * row, so cells keep their own behavior without per-element stopPropagation.
 */
export const CLICKABLE_ROW_CLASS =
  'cursor-pointer focus-visible:ring-2 focus-visible:ring-offset-0 focus-visible:outline-none'

/**
 * `[aria-disabled="true"]` covers DisabledFieldTooltip wrappers: a disabled
 * button suppresses its own click, so the wrapper is what receives it — and a
 * click on a disabled control must stay inert, not open the row.
 */
const INTERACTIVE_SELECTOR =
  'a, button, input, textarea, select, label, [role="switch"], [role="checkbox"], [role="menuitem"], [aria-disabled="true"]'

type RowEvent =
  | MouseEvent<HTMLTableRowElement>
  | KeyboardEvent<HTMLTableRowElement>

function shouldIgnoreRowClick(event: RowEvent): boolean {
  const target = event.target
  if (!(target instanceof Element)) return false
  // Portaled content (dialogs, tooltips) bubbles through the React tree even
  // though it lives outside the row in the DOM.
  if (!event.currentTarget.contains(target)) return true
  const interactive = target.closest(INTERACTIVE_SELECTOR)
  return Boolean(interactive && interactive !== event.currentTarget)
}

export function getClickableRowProps(onActivate: () => void) {
  return {
    role: 'button' as const,
    tabIndex: 0,
    onClick: (event: MouseEvent<HTMLTableRowElement>) => {
      if (shouldIgnoreRowClick(event)) return
      // Don't hijack a click that ends a text selection (copying an email,
      // an invoice number, ...).
      if (window.getSelection()?.toString()) return
      onActivate()
    },
    onKeyDown: (event: KeyboardEvent<HTMLTableRowElement>) => {
      // Only when the row itself is focused — Enter on a focused button inside
      // the row bubbles here and must not double-activate.
      if (event.target !== event.currentTarget) return
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        onActivate()
      }
    },
  }
}
