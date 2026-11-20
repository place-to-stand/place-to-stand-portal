import type {
  DbUser,
  ProjectWithRelations,
  TaskWithRelations,
} from '@/lib/types'

import type { ProjectTimeLogDialogParams } from './types'

type DialogParamExtras = {
  tasks: TaskWithRelations[]
  currentUserId: string
  admins: DbUser[]
}

/**
 * Derives `ProjectTimeLogDialog` params from a fully-relational project row,
 * for the task sheet and the time-log context routes. Callers must only
 * invoke this with a genuine `ProjectWithRelations`
 * (the lead overlay's init payload does not guarantee `burndown`).
 */
export function buildProjectTimeLogDialogParams(
  project: ProjectWithRelations,
  { tasks, currentUserId, admins }: DialogParamExtras
): ProjectTimeLogDialogParams {
  return {
    projectId: project.id,
    projectName: project.name,
    projectType: project.type,
    companyId: project.client?.id ?? null,
    clientName: project.client?.name ?? null,
    clientBillingType: project.client?.billing_type ?? null,
    clientRemainingHours: project.burndown.totalClientRemainingHours,
    tasks,
    currentUserId,
    projectMembers: project.members,
    admins,
  }
}
