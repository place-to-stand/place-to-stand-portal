import type { SalesHomeData } from '@/lib/dashboard/sales-types'
import type { HoursSnapshot } from '@/lib/dashboard/types'
import type { AssignedTaskSummary } from '@/lib/data/tasks'

/**
 * Server-fetched props the individual widgets need on first render. The
 * admin home fills the task and hours fields, the sales home `sales`; a
 * widget whose data is missing renders nothing.
 */
export type DashboardWidgetData = {
  tasks?: AssignedTaskSummary[]
  totalTaskCount?: number
  initialHoursSnapshot?: HoursSnapshot
  sales?: SalesHomeData
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
