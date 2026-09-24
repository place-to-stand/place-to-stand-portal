import { formatCalendarDate } from '@pts/ui/dates'

export const formatCurrency = (value: string | number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(typeof value === 'string' ? Number(value) : value)

/** `long` → "September 3, 2026"; `short` → "Sep 3, 2026" (the paid stamp). */
export const formatDate = (
  dateStr: string | null,
  style: 'long' | 'short' = 'long'
) =>
  formatCalendarDate(dateStr, { year: 'numeric', month: style, day: 'numeric' })

export const formatTaxRate = (taxRate: string | null) => {
  if (!taxRate) return '0'
  const rate = Number(taxRate) * 100
  return rate % 1 === 0 ? rate.toFixed(0) : rate.toFixed(2).replace(/0+$/, '')
}
