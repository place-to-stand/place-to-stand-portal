import { z } from 'zod'

import { roleCan, type Capability, type Role } from '@/lib/auth/capabilities'

/**
 * Home dashboard widget layout. Every widget lives in one pool; a role sees
 * the widgets its capabilities allow (`WIDGET_CAPABILITIES`), and each person
 * chooses which of those to show and where. The layout is two columns (the
 * grid collapses to one on small screens, column 0 then column 1) plus the
 * list of widgets they've hidden. Persisted per user in
 * `user_dashboard_layouts`.
 *
 * Adding a widget: add its id and capability here (and the capability in
 * `lib/auth/capabilities.ts`), render it in `widget-layout/widget-renderer.tsx`,
 * and place it in `DEFAULT_PLACEMENT`. Saved layouts pick it up via
 * `normalizeDashboardLayout`, which adds any widget the person hasn't placed
 * or hidden at its default spot.
 */
export const DASHBOARD_WIDGET_IDS = [
  'notifications',
  'my-tasks',
  'next-steps',
  'pipeline',
  'quiet-leads',
  'hours',
  'recent-activity',
] as const

export type DashboardWidgetId = (typeof DASHBOARD_WIDGET_IDS)[number]

export const WIDGET_CAPABILITIES: Record<DashboardWidgetId, Capability> = {
  notifications: 'widget.notifications',
  'my-tasks': 'widget.my_tasks',
  'next-steps': 'widget.next_steps',
  pipeline: 'widget.pipeline',
  'quiet-leads': 'widget.quiet_leads',
  hours: 'widget.hours',
  'recent-activity': 'widget.recent_activity',
}

export const DASHBOARD_LAYOUT_COLUMN_COUNT = 2

export type DashboardLayout = {
  version: 1
  /** Exactly DASHBOARD_LAYOUT_COLUMN_COUNT columns, each an ordered widget list. */
  columns: DashboardWidgetId[][]
  /** Widgets the role may show but this person has hidden. */
  hidden: DashboardWidgetId[]
}

/**
 * Where each widget goes by default, per home. Admins start on their work
 * widgets with the sales ones hidden; everyone else starts on the sales home.
 */
const DEFAULT_PLACEMENT: Record<
  'admin' | 'staff',
  { columns: DashboardWidgetId[][]; hidden: DashboardWidgetId[] }
> = {
  admin: {
    columns: [
      ['notifications', 'my-tasks'],
      ['hours', 'recent-activity'],
    ],
    hidden: ['next-steps', 'pipeline', 'quiet-leads'],
  },
  staff: {
    columns: [
      ['notifications', 'next-steps'],
      ['pipeline', 'quiet-leads'],
    ],
    hidden: ['my-tasks'],
  },
}

export function widgetsForRole(role: Role): Set<DashboardWidgetId> {
  return new Set(
    DASHBOARD_WIDGET_IDS.filter(id => roleCan(role, WIDGET_CAPABILITIES[id]))
  )
}

/** The default layout for a role, limited to the widgets it may see. */
export function defaultLayoutForRole(role: Role): DashboardLayout {
  const placement = DEFAULT_PLACEMENT[role === 'ADMIN' ? 'admin' : 'staff']
  const allowed = widgetsForRole(role)
  const placed = new Set([...placement.columns.flat(), ...placement.hidden])

  return {
    version: 1,
    columns: placement.columns.map(column => column.filter(id => allowed.has(id))),
    hidden: [
      ...placement.hidden.filter(id => allowed.has(id)),
      // Anything allowed but not in this home's placement starts hidden.
      ...[...allowed].filter(id => !placed.has(id)),
    ],
  }
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
  hidden: z.array(z.unknown()).optional(),
})

/**
 * Coerce arbitrary stored/submitted JSON into a valid layout for a role:
 * drop unknown, duplicate and disallowed ids, pad/trim to the column count,
 * and add any allowed widget that is neither placed nor hidden at its
 * default spot (shown or hidden, as the default says).
 */
export function normalizeDashboardLayout(
  input: unknown,
  role: Role
): DashboardLayout {
  const defaults = defaultLayoutForRole(role)
  const parsed = dashboardLayoutInputSchema.safeParse(input)
  if (!parsed.success) {
    return cloneLayout(defaults)
  }

  const allowed = widgetsForRole(role)
  const seen = new Set<DashboardWidgetId>()
  const take = (candidate: unknown): DashboardWidgetId | null => {
    const id = widgetIdSchema.safeParse(candidate)
    if (!id.success || seen.has(id.data) || !allowed.has(id.data)) return null
    seen.add(id.data)
    return id.data
  }

  const columns: DashboardWidgetId[][] = []
  for (let i = 0; i < DASHBOARD_LAYOUT_COLUMN_COUNT; i += 1) {
    const raw = parsed.data.columns[i] ?? []
    columns.push(raw.map(take).filter(id => id !== null))
  }
  const hidden = (parsed.data.hidden ?? [])
    .map(take)
    .filter(id => id !== null)

  defaults.columns.forEach((defaultColumn, columnIndex) => {
    for (const id of defaultColumn) {
      if (!seen.has(id)) {
        seen.add(id)
        columns[columnIndex]?.push(id)
      }
    }
  })
  for (const id of defaults.hidden) {
    if (!seen.has(id)) {
      seen.add(id)
      hidden.push(id)
    }
  }

  return { version: 1, columns, hidden }
}

export function cloneLayout(layout: DashboardLayout): DashboardLayout {
  return {
    version: layout.version,
    columns: layout.columns.map(column => [...column]),
    hidden: [...layout.hidden],
  }
}

export function isDefaultDashboardLayout(layout: DashboardLayout, role: Role) {
  return layoutsEqual(layout, defaultLayoutForRole(role))
}

function sameList(a: readonly string[], b: readonly string[]) {
  return a.length === b.length && a.every((id, index) => id === b[index])
}

export function layoutsEqual(a: DashboardLayout, b: DashboardLayout) {
  if (a.columns.length !== b.columns.length) return false
  const sameHidden = sameList([...a.hidden].sort(), [...b.hidden].sort())
  return (
    sameHidden &&
    a.columns.every((column, index) => sameList(column, b.columns[index] ?? []))
  )
}

/** Moves a widget out of the grid into the hidden list. */
export function hideWidget(
  layout: DashboardLayout,
  id: DashboardWidgetId
): DashboardLayout {
  const next = cloneLayout(layout)
  next.columns = next.columns.map(column => column.filter(item => item !== id))
  if (!next.hidden.includes(id)) next.hidden.push(id)
  return next
}

/** Shows a hidden widget at the top of the shorter column. */
export function showWidget(
  layout: DashboardLayout,
  id: DashboardWidgetId
): DashboardLayout {
  const next = cloneLayout(layout)
  if (!next.hidden.includes(id)) return next
  next.hidden = next.hidden.filter(item => item !== id)
  const target = next.columns.reduce(
    (best, column, index) =>
      column.length < (next.columns[best]?.length ?? Infinity) ? index : best,
    0
  )
  next.columns[target]?.unshift(id)
  return next
}
