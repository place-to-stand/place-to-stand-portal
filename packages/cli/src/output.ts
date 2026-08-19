import { globalOptions } from './context.js'

const MAX_CELL_WIDTH = 40

function toCell(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }

  if (Array.isArray(value)) {
    return value.map(toCell).join(',')
  }

  if (typeof value === 'object') {
    return JSON.stringify(value)
  }

  const text = String(value).replace(/\s+/g, ' ')

  return text.length > MAX_CELL_WIDTH
    ? `${text.slice(0, MAX_CELL_WIDTH - 1)}…`
    : text
}

function renderTable(rows: Record<string, unknown>[]): string {
  if (!rows.length) {
    return '(no rows)'
  }

  const columns = [...new Set(rows.flatMap(row => Object.keys(row)))]
  const widths = columns.map(column =>
    Math.max(
      column.length,
      ...rows.map(row => toCell(row[column]).length)
    )
  )

  const line = (cells: string[]) =>
    cells.map((cell, index) => cell.padEnd(widths[index])).join('  ').trimEnd()

  return [
    line(columns.map(column => column.toUpperCase())),
    line(widths.map(width => '-'.repeat(width))),
    ...rows.map(row => line(columns.map(column => toCell(row[column])))),
  ].join('\n')
}

function isRecordArray(value: unknown): value is Record<string, unknown>[] {
  return (
    Array.isArray(value) &&
    value.every(
      entry =>
        typeof entry === 'object' && entry !== null && !Array.isArray(entry)
    )
  )
}

/**
 * Data goes to stdout, everything else to stderr, so `pts … | jq` never has to
 * step around a status line.
 *
 * JSON is the default because the primary caller is an agent. It is indented
 * when stdout is a terminal (a human is reading) and compact when piped.
 */
export function emit(data: unknown, warning?: string): void {
  if (warning) {
    process.stderr.write(`warning: ${warning}\n`)
  }

  if (globalOptions().pretty) {
    const rendered = isRecordArray(data)
      ? renderTable(data)
      : renderTable([data as Record<string, unknown>])

    process.stdout.write(`${rendered}\n`)

    return
  }

  const indent = process.stdout.isTTY ? 2 : 0

  process.stdout.write(`${JSON.stringify(data, null, indent)}\n`)
}

export function emitMessage(message: string): void {
  process.stderr.write(`${message}\n`)
}
