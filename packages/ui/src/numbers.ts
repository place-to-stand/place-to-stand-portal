/**
 * Hours and money, formatted the same way everywhere: pages, exports, emails,
 * PDFs, notifications. This file is the only place either is built
 * (`scripts/check-formatters.mjs` fails the lint on a hand-rolled copy).
 *
 * Both formatters pin the `en-US` locale so the server and every browser
 * render identical strings (no hydration mismatches). It has no imports, so
 * non-React packages (`@pts/pdf`) can depend on it too.
 *
 * - Rounding: half away from zero (Intl's default), hours to at most two
 *   decimals, money to exactly two (or none with `cents: false`).
 * - Negatives: a plain "-" ("-1.5h", "-$12.00"); never "-0". Pass
 *   `signed: true` for a change ("+1.5h", "−$12.00", with a true minus).
 * - Input: a number, or a numeric string as Postgres `numeric` columns arrive.
 *   Handle null/undefined at the call site — there is no one right blank.
 */

type NumericInput = number | string

type SignOptions = {
  /** Always show the sign: "+" for zero and up, a true minus (−) below. */
  signed?: boolean
}

export type CurrencyOptions = SignOptions & {
  /**
   * `false` rounds to whole dollars ("$1,234"). Only for approximate
   * summaries; anything billed, paid or owed keeps its cents.
   */
  cents?: boolean
}

const MINUS = '−'

const HOURS = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
  signDisplay: 'negative',
})

const CURRENCY = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: 'negative',
})

const WHOLE_DOLLARS = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
  signDisplay: 'negative',
})

function toNumber(value: NumericInput): number {
  return typeof value === 'string' ? Number(value) : value
}

function format(
  value: number,
  formatter: Intl.NumberFormat,
  signed: boolean | undefined
): string {
  if (!signed) return formatter.format(value)
  return `${value < 0 ? MINUS : '+'}${formatter.format(Math.abs(value))}`
}

/** Hours as "1.5h", "12h", "1,250.25h" (up to two decimals). */
export function formatHours(
  hours: NumericInput,
  options: SignOptions = {}
): string {
  return `${format(toNumber(hours), HOURS, options.signed)}h`
}

/** Money as "$1,234.00" (always two decimals, so columns line up). */
export function formatCurrency(
  amount: NumericInput,
  options: CurrencyOptions = {}
): string {
  const formatter = options.cents === false ? WHOLE_DOLLARS : CURRENCY
  return format(toNumber(amount), formatter, options.signed)
}
