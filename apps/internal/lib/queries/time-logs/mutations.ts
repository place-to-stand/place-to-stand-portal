import 'server-only'

import { eq, inArray } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { ensureProjectAccess } from '@/lib/auth/permissions'
import { HttpError, NotFoundError } from '@/lib/errors/http'
import { db } from '@/lib/db'
import {
  tasks,
  timeLogTasks,
  timeLogs,
} from '@/lib/db/schema'

type TransactionClient = Parameters<Parameters<typeof db.transaction>[0]>[0]

/**
 * Server-side eligibility check for linked tasks (the client-side filter and
 * disabled button are advisory only): every linked task must exist, belong to
 * the log's project, not be soft-deleted, and not be status ARCHIVED.
 * Accepted tasks are explicitly allowed — the task sheet pre-links them.
 * Runs inside the mutation transaction so a task archived after the dialog
 * opened still fails cleanly with a 400.
 */
async function assertLinkedTasksEligible(
  tx: TransactionClient,
  projectId: string,
  taskIds: string[],
): Promise<void> {
  if (!taskIds.length) {
    return
  }

  const rows = await tx
    .select({
      id: tasks.id,
      projectId: tasks.projectId,
      status: tasks.status,
      deletedAt: tasks.deletedAt,
    })
    .from(tasks)
    .where(inArray(tasks.id, taskIds))

  const rowsById = new Map(rows.map(row => [row.id, row]))

  for (const taskId of taskIds) {
    const row = rowsById.get(taskId)

    if (
      !row ||
      row.projectId !== projectId ||
      row.deletedAt !== null ||
      row.status === 'ARCHIVED'
    ) {
      throw new HttpError(
        'One or more linked tasks are no longer available.',
        400,
      )
    }
  }
}

export type CreateTimeLogInput = {
  projectId: string
  userId: string
  hours: number
  loggedOn: string
  note: string | null
  taskIds: string[]
}

export type UpdateTimeLogInput = {
  projectId: string
  timeLogId: string
  userId: string
  hours: number
  loggedOn: string
  note: string | null
  taskIds: string[]
}

export async function createTimeLog(
  user: AppUser,
  input: CreateTimeLogInput,
): Promise<string> {
  const { projectId, userId, hours, loggedOn, note, taskIds } = input

  await ensureProjectAccess(user, projectId)

  const hoursValue = hours.toString()
  const noteValue = note && note.trim().length ? note.trim() : null

  return db.transaction(async tx => {
    await assertLinkedTasksEligible(tx, projectId, taskIds)

    const [inserted] = await tx
      .insert(timeLogs)
      .values({
        projectId,
        userId,
        hours: hoursValue,
        loggedOn,
        note: noteValue,
      })
      .returning({ id: timeLogs.id })

    if (!inserted) {
      throw new Error('Unable to create time log entry.')
    }

    if (taskIds.length) {
      const values = taskIds.map(taskId => ({
        timeLogId: inserted.id,
        taskId,
      }))
      await tx.insert(timeLogTasks).values(values)
    }

    return inserted.id
  })
}

export async function softDeleteTimeLog(
  user: AppUser,
  projectId: string,
  timeLogId: string,
): Promise<{ loggedOn: string }> {
  const rows = await db
    .select({
      id: timeLogs.id,
      projectId: timeLogs.projectId,
      userId: timeLogs.userId,
      loggedOn: timeLogs.loggedOn,
      deletedAt: timeLogs.deletedAt,
    })
    .from(timeLogs)
    .where(eq(timeLogs.id, timeLogId))
    .limit(1)

  if (!rows.length) {
    throw new NotFoundError('Time log not found')
  }

  const [timeLog] = rows

  if (timeLog.projectId !== projectId) {
    throw new NotFoundError('Time log not found for project')
  }

  await ensureProjectAccess(user, projectId)

  if (timeLog.deletedAt) {
    return { loggedOn: timeLog.loggedOn }
  }

  // updatedAt must move too (PRD 002 F1): the monthly close drift detector
  // finds post-close changes via record timestamps > closed_at.
  const nowIso = new Date().toISOString()
  await db
    .update(timeLogs)
    .set({ deletedAt: nowIso, updatedAt: nowIso })
    .where(eq(timeLogs.id, timeLogId))

  return { loggedOn: timeLog.loggedOn }
}

export async function updateTimeLog(
  user: AppUser,
  input: UpdateTimeLogInput,
): Promise<{ previousLoggedOn: string }> {
  const { projectId, timeLogId, userId, hours, loggedOn, note, taskIds } = input

  const rows = await db
    .select({
      id: timeLogs.id,
      projectId: timeLogs.projectId,
      userId: timeLogs.userId,
      loggedOn: timeLogs.loggedOn,
      deletedAt: timeLogs.deletedAt,
    })
    .from(timeLogs)
    .where(eq(timeLogs.id, timeLogId))
    .limit(1)

  if (!rows.length) {
    throw new NotFoundError('Time log not found')
  }

  const [existing] = rows

  if (existing.projectId !== projectId) {
    throw new NotFoundError('Time log not found for project')
  }

  if (existing.deletedAt) {
    throw new NotFoundError('Time log has been removed')
  }

  await ensureProjectAccess(user, projectId)

  const targetUserId = userId

  const hoursValue = hours.toString()
  const noteValue = note && note.trim().length ? note.trim() : null

  await db.transaction(async tx => {
    await assertLinkedTasksEligible(tx, projectId, taskIds)

    await tx
      .update(timeLogs)
      .set({
        userId: targetUserId,
        hours: hoursValue,
        loggedOn,
        note: noteValue,
        // PRD 002 F1: drift detection keys on record timestamps > closed_at.
        updatedAt: new Date().toISOString(),
      })
      .where(eq(timeLogs.id, timeLogId))

    await tx.delete(timeLogTasks).where(eq(timeLogTasks.timeLogId, timeLogId))

    if (taskIds.length) {
      const values = taskIds.map(taskId => ({
        timeLogId,
        taskId,
      }))
      await tx.insert(timeLogTasks).values(values)
    }
  })

  // F6: the caller needs the pre-mutation date — a move OUT of a closed month
  // is undetectable once loggedOn is overwritten.
  return { previousLoggedOn: existing.loggedOn }
}

