import { NextResponse } from 'next/server'
import { z } from 'zod'
import { and, eq, inArray, isNull } from 'drizzle-orm'

import {
  isWorkableTaskHome,
  listWorkableProjectIds,
} from '@/lib/projects/access'
import { db } from '@/lib/db'
import {
  taskAssigneeMetadata as taskAssigneeMetadataTable,
  taskAssignees as taskAssigneesTable,
  tasks as tasksTable,
} from '@/lib/db/schema'
import { changeTaskStatus } from '@/app/(dashboard)/projects/actions/change-task-status'
import {
  MY_TASK_STATUS_VALUES,
  type MyTaskStatus,
} from '@/lib/projects/tasks/my-tasks-constants'
import { authorizeRoute } from '@/lib/auth/guard'
import { roleCan } from '@/lib/auth/capabilities'

const reorderPayloadSchema = z.object({
  taskId: z.uuid(),
  /** The viewed board's person, or 'all' (the everyone view). */
  assigneeId: z.union([z.uuid(), z.literal('all')]).optional(),
  targetStatus: z.enum(MY_TASK_STATUS_VALUES),
  targetOrder: z.array(z.uuid()).min(1),
  sourceStatus: z.enum(MY_TASK_STATUS_VALUES).optional(),
  sourceOrder: z.array(z.uuid()).optional(),
  /** Several selected cards moved together (`taskId` among them). */
  movedTaskIds: z.array(z.uuid()).min(1).max(500).optional(),
  /** With `movedTaskIds`: the new order of each other column they left. */
  otherOrders: z
    .array(
      z.object({
        status: z.enum(MY_TASK_STATUS_VALUES),
        order: z.array(z.uuid()),
      })
    )
    .max(MY_TASK_STATUS_VALUES.length)
    .optional(),
})

export async function POST(request: Request) {
  const { user, denied } = await authorizeRoute('projects.view_member')
  if (denied) return denied

  let payload: z.infer<typeof reorderPayloadSchema>

  try {
    const json = await request.json()
    const parsed = reorderPayloadSchema.safeParse(json)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid reorder payload.' },
        { status: 400 }
      )
    }

    payload = parsed.data
  } catch (error) {
    console.error('Failed to parse my tasks reorder payload', error)
    return NextResponse.json(
      { error: 'Invalid reorder payload.' },
      { status: 400 }
    )
  }

  if (!payload.targetOrder.includes(payload.taskId)) {
    return NextResponse.json(
      { error: 'Target column ordering must include the moved task.' },
      { status: 400 }
    )
  }

  if (
    payload.sourceStatus &&
    payload.sourceStatus !== payload.targetStatus &&
    !payload.sourceOrder
  ) {
    return NextResponse.json(
      { error: 'Source column ordering is required when moving columns.' },
      { status: 400 }
    )
  }

  const movedTaskIds = payload.movedTaskIds ?? [payload.taskId]
  if (movedTaskIds.some(id => !payload.targetOrder.includes(id))) {
    return NextResponse.json(
      { error: 'Target column ordering must include every moved task.' },
      { status: 400 }
    )
  }
  const otherOrders = payload.otherOrders ?? []

  const uniqueTaskIds = Array.from(
    new Set([
      ...payload.targetOrder,
      ...(payload.sourceOrder ?? []),
      ...otherOrders.flatMap(column => column.order),
    ])
  )

  if (!uniqueTaskIds.length) {
    return NextResponse.json(
      { error: 'No tasks provided for reorder.' },
      { status: 400 }
    )
  }

  // Admins may reorder any board; ordering persists under the VIEWED
  // assignee's rows, defaulting to self. In the everyone view ('all') it
  // persists under the viewer's own rows, the order that view sorts by.
  // Sales users reorder only their own board, and only tasks on projects
  // they can work.
  if (
    !roleCan(user.role, 'projects.view_all') &&
    payload.assigneeId &&
    payload.assigneeId !== user.id
  ) {
    return NextResponse.json(
      { error: 'You can only reorder your own board.' },
      { status: 403 }
    )
  }
  const everyone = payload.assigneeId === 'all'
  const boardOwnerId =
    payload.assigneeId && !everyone ? payload.assigneeId : user.id

  const workableProjectIds = await listWorkableProjectIds(user)
  if (workableProjectIds !== null) {
    const homeRows = await db
      .select({ projectId: tasksTable.projectId, leadId: tasksTable.leadId })
      .from(tasksTable)
      .where(inArray(tasksTable.id, uniqueTaskIds))
    if (
      homeRows.some(row => !isWorkableTaskHome(user, workableProjectIds, row))
    ) {
      return NextResponse.json(
        { error: 'You are not a member of every project on this board.' },
        { status: 403 }
      )
    }
  }

  const assigneeRows = await db
    .select({ taskId: taskAssigneesTable.taskId })
    .from(taskAssigneesTable)
    .where(
      and(
        eq(taskAssigneesTable.userId, boardOwnerId),
        isNull(taskAssigneesTable.deletedAt),
        inArray(taskAssigneesTable.taskId, uniqueTaskIds)
      )
    )

  // The everyone view holds anyone's tasks (and unassigned ones).
  if (!everyone && assigneeRows.length !== uniqueTaskIds.length) {
    return NextResponse.json(
      { error: "All tasks must be assigned to the viewed person's board." },
      { status: 403 }
    )
  }

  const movedTasks = await db
    .select({
      id: tasksTable.id,
      status: tasksTable.status,
    })
    .from(tasksTable)
    .where(
      and(inArray(tasksTable.id, movedTaskIds), isNull(tasksTable.deletedAt))
    )

  if (movedTasks.length !== new Set(movedTaskIds).size) {
    return NextResponse.json({ error: 'Task not found.' }, { status: 404 })
  }

  // Every moved task exists and may be worked (checked above) before any
  // changes column, so a refusal here is rare; each change saves on its own.
  for (const task of movedTasks) {
    if (task.status === payload.targetStatus) continue
    const result = await changeTaskStatus({
      taskId: task.id,
      status: payload.targetStatus as MyTaskStatus,
    })

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
  }

  try {
    await db.transaction(async tx => {
      await upsertSortOrders({
        client: tx,
        userId: boardOwnerId,
        taskIds: payload.targetOrder,
      })

      if (
        payload.sourceStatus &&
        payload.sourceStatus !== payload.targetStatus &&
        payload.sourceOrder
      ) {
        await upsertSortOrders({
          client: tx,
          userId: boardOwnerId,
          taskIds: payload.sourceOrder,
        })
      }

      for (const column of otherOrders) {
        await upsertSortOrders({
          client: tx,
          userId: boardOwnerId,
          taskIds: column.order,
        })
      }
    })
  } catch (error) {
    console.error('Failed to persist my tasks ordering', error)
    return NextResponse.json(
      { error: 'Unable to save your new ordering. Please try again.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}

type DbInsertExecutor = Pick<typeof db, 'insert'>

async function upsertSortOrders({
  client,
  userId,
  taskIds,
}: {
  client: DbInsertExecutor
  userId: string
  taskIds: string[]
}) {
  if (!taskIds.length) {
    return
  }

  const timestamp = new Date().toISOString()

  for (let index = 0; index < taskIds.length; index++) {
    const taskId = taskIds[index]

    await client
      .insert(taskAssigneeMetadataTable)
      .values({
        taskId,
        userId,
        sortOrder: index + 1,
        createdAt: timestamp,
        updatedAt: timestamp,
        deletedAt: null,
      })
      .onConflictDoUpdate({
        target: [
          taskAssigneeMetadataTable.taskId,
          taskAssigneeMetadataTable.userId,
        ],
        set: {
          sortOrder: index + 1,
          updatedAt: timestamp,
          deletedAt: null,
        },
      })
  }
}
