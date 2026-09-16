import type { HoursSnapshot } from '@/lib/dashboard/types'
import type { AssignedTaskSummary } from '@/lib/data/tasks'

/** Server-fetched props the individual widgets need on first render. */
export type DashboardWidgetData = {
  tasks: AssignedTaskSummary[]
  totalTaskCount: number
  initialHoursSnapshot: HoursSnapshot
}

export const COLUMN_DROPPABLE_PREFIX = 'dashboard-column-'

export function columnDroppableId(columnIndex: number) {
  return `${COLUMN_DROPPABLE_PREFIX}${columnIndex}`
}

export function parseColumnDroppableId(id: string): number | null {
  if (!id.startsWith(COLUMN_DROPPABLE_PREFIX)) return null
  const index = Number(id.slice(COLUMN_DROPPABLE_PREFIX.length))
  return Number.isInteger(index) ? index : null
}
