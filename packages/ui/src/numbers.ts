/**
 * Hours and money, formatted the same way everywhere. Both formatters pin
 * the `en-US` locale so the server and every browser render identical
 * strings (no hydration mismatches).
 */

const HOURS = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })

const CURRENCY = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Hours as "1.5h", "12h", "1,250.25h" (up to two decimals). */
export function formatHours(hours: number): string {
  return `${HOURS.format(hours)}h`
}

/** Money as "$1,234.00" (always two decimals, so columns line up). */
export function formatCurrency(amount: number): string {
  return CURRENCY.format(amount)
}
