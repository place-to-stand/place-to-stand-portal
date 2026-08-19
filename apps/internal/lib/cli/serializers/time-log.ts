import type { TimeLogEntry } from '@/lib/projects/time-log/types'

export type CliTimeLog = {
  id: string
  projectId: string
  userId: string
  userName: string | null
  hours: number
  loggedOn: string
  note: string | null
  /** Tasks this entry was booked against; empty for project-level time. */
  taskIds: string[]
  createdAt: string
  updatedAt: string
}

export function serializeTimeLog(entry: TimeLogEntry): CliTimeLog {
  return {
    id: entry.id,
    projectId: entry.project_id,
    userId: entry.user_id,
    userName: entry.user?.full_name ?? null,
    hours: entry.hours,
    loggedOn: entry.logged_on,
    note: entry.note,
    taskIds: (entry.linked_tasks ?? [])
      .map(link => link.task?.id)
      .filter((id): id is string => Boolean(id)),
    createdAt: entry.created_at,
    updatedAt: entry.updated_at,
  }
}
