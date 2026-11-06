'use client'

import type { ComponentProps, MouseEvent } from 'react'

import { useSheetLink, type SheetTarget } from '@/lib/sheets/use-sheet-link'

/**
 * The look of a linked record's name in a list cell (the Client on an hour
 * block, the Company on a person): the cell's text, underlined on hover. The
 * label truncates without clipping the underline.
 */
export const cellLinkClass =
  'hover:text-foreground truncate-link transition hover:underline'

/**
 * A link to a record that opens its sheet over the page you're on, stacked
 * like any sheet, instead of going to the record's list. Every link to a
 * record with a sheet is one of these (list cells, hover-card rows, card and
 * widget meta lines, toasts). A new-tab click opens the same view in a tab.
 * Rows ignore clicks on anchors, so it never also opens the row's sheet.
 */
export function SheetLink({
  sheet,
  className = cellLinkClass,
  onClick,
  onOpen,
  children,
  ...props
}: Omit<ComponentProps<'a'>, 'href'> & {
  sheet: SheetTarget
  /** Runs first on every click (e.g. to keep a drag card from seeing it). */
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void
  /** Runs after a plain click opened the sheet (e.g. to close a toast). */
  onOpen?: () => void
}) {
  const link = useSheetLink(sheet, onOpen)
  return (
    // Other props pass through, so a Radix `asChild` trigger (a tooltip)
    // can wrap it.
    <a
      {...props}
      href={link.href}
      onClick={event => {
        onClick?.(event)
        link.onClick(event)
      }}
      className={className}
    >
      {children}
    </a>
  )
}
