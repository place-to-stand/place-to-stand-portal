import { z } from 'zod'

/**
 * Home dashboard widget layout. Widgets are addressed by a stable id; the
 * layout is two columns (the grid collapses to one on small screens, column
 * 0 then column 1). Persisted per user in `user_dashboard_layouts`.
 *
 * Adding a widget: add its id here, render it in `widget-layout/widget-renderer.tsx`,
 * and place it in DEFAULT_DASHBOARD_LAYOUT. Existing saved layouts pick it up
 * via `normalizeDashboardLayout`, which appends missing widgets.
 */
export const DASHBOARD_WIDGET_IDS = [
  'my-tasks',
  'hours',
  'recent-activity',
] as const

export type DashboardWidgetId = (typeof DASHBOARD_WIDGET_IDS)[number]

export const DASHBOARD_LAYOUT_COLUMN_COUNT = 2

export type DashboardLayout = {
  version: 1
  /** Exactly DASHBOARD_LAYOUT_COLUMN_COUNT columns, each an ordered widget list. */
  columns: DashboardWidgetId[][]
}

export const DEFAULT_DASHBOARD_LAYOUT: DashboardLayout = {
  version: 1,
  columns: [['my-tasks'], ['hours', 'recent-activity']],
}

const widgetIdSchema = z.enum(DASHBOARD_WIDGET_IDS)

/**
 * Lenient on purpose: unknown ids are filtered rather than rejected so a
 * widget removed in a later release doesn't invalidate every saved layout.
 */
export const dashboardLayoutInputSchema = z.object({
  version: z.literal(1),
  columns: z
    .array(z.array(z.unknown()))
    .min(1)
    .max(DASHBOARD_LAYOUT_COLUMN_COUNT),
})

/**
 * Coerce arbitrary stored/submitted JSON into a valid layout: drop unknown
 * and duplicate ids, pad/trim to the column count, and append any widget
 * that isn't placed to its default column.
 */
export function normalizeDashboardLayout(input: unknown): DashboardLayout {
  const parsed = dashboardLayoutInputSchema.safeParse(input)
  if (!parsed.success) {
    return cloneLayout(DEFAULT_DASHBOARD_LAYOUT)
  }

  const seen = new Set<DashboardWidgetId>()
  const columns: DashboardWidgetId[][] = []

  for (let i = 0; i < DASHBOARD_LAYOUT_COLUMN_COUNT; i += 1) {
    const raw = parsed.data.columns[i] ?? []
    const column: DashboardWidgetId[] = []
    for (const candidate of raw) {
      const id = widgetIdSchema.safeParse(candidate)
      if (!id.success || seen.has(id.data)) continue
      seen.add(id.data)
      column.push(id.data)
    }
    columns.push(column)
  }

  DEFAULT_DASHBOARD_LAYOUT.columns.forEach((defaultColumn, columnIndex) => {
    for (const id of defaultColumn) {
      if (!seen.has(id)) {
        seen.add(id)
        columns[columnIndex]?.push(id)
      }
    }
  })

  return { version: 1, columns }
}

export function cloneLayout(layout: DashboardLayout): DashboardLayout {
  return {
    version: layout.version,
    columns: layout.columns.map(column => [...column]),
  }
}

export function isDefaultDashboardLayout(layout: DashboardLayout) {
  return layoutsEqual(layout, DEFAULT_DASHBOARD_LAYOUT)
}

export function layoutsEqual(a: DashboardLayout, b: DashboardLayout) {
  if (a.columns.length !== b.columns.length) return false
  return a.columns.every((column, index) => {
    const other = b.columns[index] ?? []
    return (
      column.length === other.length &&
      column.every((id, position) => id === other[position])
    )
  })
}
