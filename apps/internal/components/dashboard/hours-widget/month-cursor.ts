export type CursorLike = {
  year: number
  month: number
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

export function formatMonthLabel(year: number, month: number) {
  const label = MONTH_NAMES[month - 1] ?? 'Unknown'
  return `${label} ${year}`
}

export function shiftMonth(cursor: CursorLike, delta: number) {
  const date = new Date(Date.UTC(cursor.year, cursor.month - 1 + delta, 1))
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
  }
}

export function formatHours(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

export function compareMonthCursor(a: CursorLike, b: CursorLike) {
  const aValue = a.year * 12 + (a.month - 1)
  const bValue = b.year * 12 + (b.month - 1)

  if (aValue < bValue) {
    return -1
  }
  if (aValue > bValue) {
    return 1
  }
  return 0
}
