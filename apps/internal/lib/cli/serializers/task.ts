import type { SelectTask } from '@/lib/queries/tasks/common'

export type CliTask = {
  id: string
  projectId: string
  leadId: string | null
  title: string
  description: string | null
  status: SelectTask['status']
  dueOn: string | null
  assigneeIds: string[]
  rank: string
  createdAt: string
  updatedAt: string
  completedAt: string | null
  acceptedAt: string | null
  githubIssueUrl: string | null
  workerStatus: SelectTask['workerStatus']
}

export function serializeTask(
  task: SelectTask,
  assigneeIds: string[] = []
): CliTask {
  return {
    id: task.id,
    projectId: task.projectId,
    leadId: task.leadId,
    title: task.title,
    description: task.description,
    status: task.status,
    dueOn: task.dueOn,
    assigneeIds,
    rank: task.rank,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    completedAt: task.completedAt,
    acceptedAt: task.acceptedAt,
    githubIssueUrl: task.githubIssueUrl,
    workerStatus: task.workerStatus,
  }
}
