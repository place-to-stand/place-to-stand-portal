'use client'

import * as React from 'react'

import { cn } from './cn'

// PRD 004 §04 (D10): density variant. 'compact' = h-8 text-xs heads +
// py-1.5 cells, promoted from the monthly-close tableClasses experiment.
type TableDensity = 'default' | 'compact'

// 'fixed' opts into table-layout: fixed so column widths come from the
// header row alone — sorting/paging in new rows can't reflow the grid.
// Opt-in: columns without a declared width split the leftover space
// equally, so a table must set header widths before switching.
type TableLayout = 'auto' | 'fixed'

type TableContextValue = { density: TableDensity; stack: boolean }

const TableContext = React.createContext<TableContextValue>({
  density: 'default',
  stack: false,
})

function useTableContext() {
  return React.useContext(TableContext)
}

/**
 * `stack` turns each row into a compact card below `md`, where a desktop
 * column grid can only overprint itself or scroll sideways: the header row
 * hides, the first cell becomes the full-width title line, and the remaining
 * cells wrap beneath it. Cells that need a name to make sense on a phone
 * pass `label`; a cell can drop out with `max-md:hidden` and an actions cell
 * usually takes `max-md:ml-auto` to sit at the end of the wrapped line.
 *
 * From `md` up the columns come back. A table whose columns don't fit a
 * tablet-width content area passes an `md:min-w-[…]` floor in `className`
 * so it scrolls inside its container instead of overprinting.
 */
function Table({
  className,
  density = 'default',
  layout = 'auto',
  stack = false,
  ...props
}: React.ComponentProps<'table'> & {
  density?: TableDensity
  layout?: TableLayout
  stack?: boolean
}) {
  const context = React.useMemo(() => ({ density, stack }), [density, stack])
  return (
    <TableContext.Provider value={context}>
      <div
        data-slot='table-container'
        className='relative w-full overflow-x-auto'
      >
        <table
          data-slot='table'
          data-density={density}
          data-stack={stack || undefined}
          className={cn(
            'w-full caption-bottom text-sm',
            layout === 'fixed' && 'table-fixed',
            stack && 'max-md:block',
            className
          )}
          {...props}
        />
      </div>
    </TableContext.Provider>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
  const { stack } = useTableContext()
  return (
    <thead
      data-slot='table-header'
      className={cn('[&_tr]:border-b', stack && 'max-md:hidden', className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  const { stack } = useTableContext()
  return (
    <tbody
      data-slot='table-body'
      className={cn(
        '[&_tr:last-child]:border-0',
        stack && 'max-md:block',
        className
      )}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<'tfoot'>) {
  return (
    <tfoot
      data-slot='table-footer'
      className={cn(
        'bg-muted/50 border-t font-medium [&>tr]:last:border-b-0',
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<'tr'>) {
  const { stack } = useTableContext()
  return (
    <tr
      data-slot='table-row'
      className={cn(
        'hover:bg-muted/50 data-selected:bg-muted border-b transition-colors',
        stack &&
          'max-md:flex max-md:flex-wrap max-md:items-center max-md:gap-x-4 max-md:gap-y-1.5 max-md:px-3 max-md:py-2.5',
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<'th'>) {
  const { density } = useTableContext()
  return (
    <th
      data-slot='table-head'
      className={cn(
        'text-foreground px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 *:[[role=checkbox]]:translate-y-0.5',
        density === 'compact' ? 'h-8 text-xs' : 'h-10',
        className
      )}
      {...props}
    />
  )
}

function TableCell({
  className,
  label,
  children,
  ...props
}: React.ComponentProps<'td'> & {
  /** Names the value in a stacked (phone) row, where the header is hidden. */
  label?: string
}) {
  const { density, stack } = useTableContext()
  const showLabel = stack && label
  return (
    <td
      data-slot='table-cell'
      className={cn(
        'align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 *:[[role=checkbox]]:translate-y-0.5',
        // One row height for every list (a td's height is its minimum):
        // rows with only text match rows with action buttons.
        density === 'compact' ? 'h-10 px-2 py-1.5' : 'h-11 p-2',
        stack && 'max-md:h-auto max-md:min-w-0 max-md:p-0 max-md:first:basis-full',
        showLabel && 'max-md:flex max-md:items-center max-md:gap-1.5',
        className
      )}
      {...props}
    >
      {showLabel ? (
        <span
          data-slot='table-cell-label'
          className='text-muted-foreground hidden text-xs max-md:inline'
        >
          {label}
        </span>
      ) : null}
      {children}
    </td>
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<'caption'>) {
  return (
    <caption
      data-slot='table-caption'
      className={cn('text-muted-foreground mt-4 text-sm', className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
