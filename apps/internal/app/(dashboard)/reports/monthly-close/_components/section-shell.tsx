import type { ComponentType, ReactNode } from 'react'

import { cn } from '@/lib/utils'

type Icon = ComponentType<{ className?: string }>

type SectionShellProps = {
  icon: Icon
  iconTone?: 'emerald' | 'violet' | 'amber' | 'sky' | 'rose'
  title: string
  description: string
  total?: string
  totalLabel?: string
  /**
   * Compact variant — tighter header padding, smaller icon/title/total.
   * Used by the middle-column detail sections (Prepaid/Net30/Payroll/
   * Origination/Closer). Partner Payouts stays on the default (larger)
   * sizing.
   */
  compact?: boolean
  children: ReactNode
}

/**
 * Card shell for the monthly close detail tables. Intentionally NOT built
 * on shadcn's `Card` primitive — Card's intrinsic `py-6 gap-6` leaves dead
 * space below the last table row that we can't easily override.
 *
 * Layout:
 *
 *   ┌────────────────────────────────────────────────────┐
 *   │ [ICON] SECTION TITLE                     $12,675   │
 *   │ plain-english description of the calc      total   │
 *   ├────────────────────────────────────────────────────┤
 *   │ [ table rendered as children ]                     │
 *   └────────────────────────────────────────────────────┘
 *
 * Typography hierarchy:
 *   - Title: small-caps tracked eyebrow (deliberate, not whispery)
 *   - Description: `text-sm text-foreground/70` (readable, not tiny)
 *   - Total: `text-2xl` tabular-nums (hero)
 *   - Total label: tiny uppercase tracked below the number
 */
export function SectionShell({
  icon: Icon,
  iconTone = 'emerald',
  title,
  description,
  total,
  totalLabel = 'total',
  compact = false,
  children,
}: SectionShellProps) {
  const iconAccent = {
    emerald: 'text-emerald-600 dark:text-emerald-400',
    violet: 'text-violet-600 dark:text-violet-400',
    amber: 'text-amber-600 dark:text-amber-400',
    sky: 'text-sky-600 dark:text-sky-400',
    rose: 'text-rose-600 dark:text-rose-400',
  }

  return (
    <section className='bg-card overflow-hidden rounded-xl border shadow-sm'>
      {/* Header — hero title mirrors the hero total on the right. */}
      <header
        className={cn(
          'flex items-start justify-between gap-6 px-5',
          compact ? 'pt-3.5 pb-3' : 'pt-5 pb-4'
        )}
      >
        <div
          className={cn(
            'flex min-w-0 items-start',
            compact ? 'gap-2.5' : 'gap-3'
          )}
        >
          <Icon
            className={cn(
              'shrink-0',
              compact ? 'mt-[2px] h-4 w-4' : 'mt-[3px] h-5 w-5',
              iconAccent[iconTone]
            )}
          />
          <div
            className={cn(
              'min-w-0',
              compact ? 'space-y-1' : 'space-y-1.5'
            )}
          >
            <h3
              className={cn(
                'leading-none font-semibold tracking-tight',
                compact ? 'text-base' : 'text-xl'
              )}
            >
              {title}
            </h3>
            <p className='text-foreground/60 text-xs leading-snug'>
              {description}
            </p>
          </div>
        </div>
        {total ? (
          <div className='shrink-0 text-right'>
            <div
              className={cn(
                'leading-none font-semibold tracking-tight tabular-nums',
                compact ? 'text-lg' : 'text-2xl'
              )}
            >
              {total}
            </div>
            <div
              className={cn(
                'text-muted-foreground/70 leading-none font-semibold tracking-[0.18em] uppercase',
                compact ? 'mt-1 text-[9px]' : 'mt-1.5 text-[9px]'
              )}
            >
              {totalLabel}
            </div>
          </div>
        ) : null}
      </header>
      {/* Divider + content */}
      <div className='border-border/60 border-t'>{children}</div>
    </section>
  )
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

export function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount)
}

export function formatHours(hours: number): string {
  return hours.toFixed(2)
}

// ------------------------------------------------------------------
// SectionRow — shared row primitive for the detail section lists.
// Mirrors the breakdown-row style used by the top rollup cards, so every
// list on the page shares the same visual language.
//
//   [ leading? ] [ primary + secondary? .................. hrs   $amt ]
//
// Fixed widths on the hours + amount columns guarantee vertical
// alignment across rows within a section.
// ------------------------------------------------------------------
type SectionRowProps = {
  leading?: ReactNode
  primary: ReactNode
  secondary?: ReactNode
  hours?: number
  amount: number
}

export function SectionRow({
  leading,
  primary,
  secondary,
  hours,
  amount,
}: SectionRowProps) {
  return (
    <div className='hover:bg-muted/30 flex items-center gap-3 px-5 py-2 transition-colors'>
      {leading ? <div className='shrink-0'>{leading}</div> : null}
      <div className='min-w-0 flex-1'>
        <div className='truncate text-[13px] font-medium'>{primary}</div>
        {secondary ? (
          <div className='text-muted-foreground truncate text-[11px]'>
            {secondary}
          </div>
        ) : null}
      </div>
      {hours != null ? (
        <div className='text-muted-foreground w-16 shrink-0 text-right text-[11px] tabular-nums'>
          {formatHours(hours)} hrs
        </div>
      ) : null}
      <div className='w-24 shrink-0 text-right text-[13px] font-semibold tabular-nums'>
        {formatCurrency(amount)}
      </div>
    </div>
  )
}

/**
 * Wrapper for a list of SectionRows. Adds thin dividers between rows so
 * the list has structure without table chrome.
 */
export function SectionRowList({ children }: { children: ReactNode }) {
  return <div className='divide-border/40 divide-y'>{children}</div>
}

/**
 * Empty state for when a section has no rows this period.
 */
export function SectionEmpty({ message }: { message: string }) {
  return (
    <p className='text-muted-foreground py-8 text-center text-sm'>{message}</p>
  )
}

/**
 * Shared table classes. The header row gets a subtle muted fill + stronger
 * bottom border so it reads as a distinct "header zone" separate from the
 * body rows. Column labels are small-caps tracked with a slightly brighter
 * foreground tone. First/last cells get extra horizontal padding so the
 * table content doesn't butt against the card edge.
 */
export const tableClasses = {
  // Row-level — applied to the <TableRow> inside <TableHeader>
  headRow: 'bg-muted/50 hover:bg-muted/50 border-b-2 border-border/80',
  // Cell-level — applied to each <TableHead>. Tight height so the header
  // reads as a compact masthead, not a bloated strip.
  head: 'text-foreground/70 h-8 text-[10px] font-semibold tracking-[0.14em] uppercase first:pl-5 last:pr-5',
  headRight:
    'text-foreground/70 h-8 text-right text-[10px] font-semibold tracking-[0.14em] uppercase first:pl-5 last:pr-5',
  row: 'hover:bg-muted/40 transition-colors',
  cell: 'first:pl-5 last:pr-5',
  cellNumeric: 'text-right tabular-nums first:pl-5 last:pr-5',
  // Footer cells — tighter vertical padding than body rows. Used by the
  // Partner Payouts "Column totals" row.
  footerCell: 'py-1.5 first:pl-5 last:pr-5',
}
