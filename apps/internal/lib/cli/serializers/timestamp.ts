/**
 * Every timestamp the CLI and MCP return is ISO 8601 in UTC
 * ("2026-10-20T15:29:05.239Z"), the same format `occurredAt` input takes.
 * Drizzle hands timestamps back as Postgres text ("2026-10-20
 * 15:29:05.239278+00") and supabase-js as offset ISO, so both are normalised
 * here. Date-only fields (`dueOn`, invoice dates) stay `YYYY-MM-DD`.
 */
export function isoTimestamp(value: string): string
export function isoTimestamp(value: string | null | undefined): string | null
export function isoTimestamp(value: string | null | undefined): string | null {
  if (!value) {
    return null
  }

  const date = new Date(
    value.replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00')
  )

  return Number.isNaN(date.getTime()) ? value : date.toISOString()
}
