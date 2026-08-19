import { taskUpdatedEvent } from '@/lib/activity/events'

export type TaskSnapshot = {
  title: string
  description: string | null
  status: string
  projectId: string
  dueOn: string | null
  assigneeIds: string[]
}

type TaskUpdateEvent = ReturnType<typeof taskUpdatedEvent>

/**
 * Diff two task snapshots into an activity event, or `null` when nothing
 * changed. `taskUpdatedEvent` only formats — computing what actually differs
 * is the caller's job, and this is that job in one place so the CLI and the
 * browser produce identical audit trails.
 *
 * Callers must normalise nullable fields (`?? null`) before building a
 * snapshot, so that `undefined` and `null` do not read as a change.
 */
export function buildTaskUpdateEvent(
  before: TaskSnapshot,
  after: TaskSnapshot
): TaskUpdateEvent | null {
  const changedFields: string[] = []
  const previousDetails: Record<string, unknown> = {}
  const nextDetails: Record<string, unknown> = {}

  if (before.title !== after.title) {
    changedFields.push('title')
    previousDetails.title = before.title
    nextDetails.title = after.title
  }

  if (before.description !== after.description) {
    changedFields.push('description')
    previousDetails.description = before.description
    nextDetails.description = after.description
  }

  if (before.status !== after.status) {
    changedFields.push('status')
    previousDetails.status = before.status
    nextDetails.status = after.status
  }

  if (before.projectId !== after.projectId) {
    changedFields.push('project')
    previousDetails.projectId = before.projectId
    nextDetails.projectId = after.projectId
  }

  if (before.dueOn !== after.dueOn) {
    changedFields.push('due date')
    previousDetails.dueOn = before.dueOn
    nextDetails.dueOn = after.dueOn
  }

  const addedAssignees = after.assigneeIds.filter(
    assigneeId => !before.assigneeIds.includes(assigneeId)
  )
  const removedAssignees = before.assigneeIds.filter(
    assigneeId => !after.assigneeIds.includes(assigneeId)
  )
  const hasAssigneeChanges =
    addedAssignees.length > 0 || removedAssignees.length > 0

  if (hasAssigneeChanges) {
    changedFields.push('assignees')
  }

  if (!changedFields.length) {
    return null
  }

  const hasDetailChanges =
    Object.keys(previousDetails).length > 0 ||
    Object.keys(nextDetails).length > 0

  return taskUpdatedEvent({
    title: after.title,
    changedFields,
    details: hasDetailChanges
      ? { before: previousDetails, after: nextDetails }
      : undefined,
    assigneeChanges: hasAssigneeChanges
      ? { added: addedAssignees, removed: removedAssignees }
      : undefined,
  })
}
