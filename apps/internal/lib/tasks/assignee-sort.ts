import 'server-only'

import { and, eq, isNull, ne, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { taskAssigneeMetadata, taskAssignees, tasks } from '@/lib/db/schema'

type TaskStatus = typeof tasks.$inferSelect.status

/**
 * Pins a task to the top of its `status` column on every assignee's My Tasks
 * board.
 *
 * My Tasks orders each column by `task_assignee_metadata.sort_order`, a
 * per-user number that only drag-and-drop writes (`api/my-tasks/reorder`).
 * `tasks.rank` — what the project board uses — never reaches it. So a status
 * change that leaves `sort_order` alone carries the old column's position into
 * the new one and the task surfaces somewhere in the middle, which is exactly
 * where nobody looks for the ticket they just moved. Call this after the
 * status is written and the assignee rows are final.
 *
 * Writes `min(sort_order) - 1` for the destination column, so it can go
 * negative; the next drag renumbers the column from 1 (`upsertSortOrders`).
 */
export async function pinTaskToTopOfAssigneeBoards(
  taskId: string,
  status: TaskStatus
): Promise<void> {
  const assignees = await db
    .select({ userId: taskAssignees.userId })
    .from(taskAssignees)
    .where(and(eq(taskAssignees.taskId, taskId), isNull(taskAssignees.deletedAt)))

  if (!assignees.length) {
    return
  }

  // Lowest ordered position per assignee among their *other* tasks in the
  // destination column. A user with no ordered rows there is absent, and any
  // value beats the unordered rows, which sort last.
  const columnFloors = await db
    .select({
      userId: taskAssigneeMetadata.userId,
      floor: sql<number>`min(${taskAssigneeMetadata.sortOrder})`,
    })
    .from(taskAssigneeMetadata)
    .innerJoin(
      tasks,
      and(
        eq(tasks.id, taskAssigneeMetadata.taskId),
        eq(tasks.status, status),
        isNull(tasks.deletedAt)
      )
    )
    .innerJoin(
      taskAssignees,
      and(
        eq(taskAssignees.taskId, taskAssigneeMetadata.taskId),
        eq(taskAssignees.userId, taskAssigneeMetadata.userId),
        isNull(taskAssignees.deletedAt)
      )
    )
    .where(
      and(
        isNull(taskAssigneeMetadata.deletedAt),
        ne(taskAssigneeMetadata.taskId, taskId)
      )
    )
    .groupBy(taskAssigneeMetadata.userId)

  const floorByUser = new Map(
    columnFloors.map(row => [row.userId, Number(row.floor)])
  )
  const timestamp = new Date().toISOString()

  await db
    .insert(taskAssigneeMetadata)
    .values(
      assignees.map(({ userId }) => ({
        taskId,
        userId,
        sortOrder: (floorByUser.get(userId) ?? 1) - 1,
        createdAt: timestamp,
        updatedAt: timestamp,
        deletedAt: null,
      }))
    )
    .onConflictDoUpdate({
      target: [taskAssigneeMetadata.taskId, taskAssigneeMetadata.userId],
      set: {
        sortOrder: sql`excluded.sort_order`,
        updatedAt: timestamp,
        deletedAt: null,
      },
    })
}
