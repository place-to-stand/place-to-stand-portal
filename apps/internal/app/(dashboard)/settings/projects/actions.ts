'use server'

import type {
  DeleteProjectInput,
  ProjectActionResult,
  ProjectInput,
  RestoreProjectInput,
} from '@/lib/settings/projects/project-service'

import { saveProject as saveProjectAction } from '@/lib/settings/projects/actions/save-project'
import { softDeleteProject as softDeleteProjectAction } from '@/lib/settings/projects/actions/soft-delete-project'
import { restoreProject as restoreProjectAction } from '@/lib/settings/projects/actions/restore-project'
export async function saveProject(
  input: ProjectInput
): Promise<ProjectActionResult> {
  // permission: projects.create
  return saveProjectAction(input)
}

export async function softDeleteProject(
  input: DeleteProjectInput
): Promise<ProjectActionResult> {
  // permission: projects.manage
  return softDeleteProjectAction(input)
}

export async function restoreProject(
  input: RestoreProjectInput
): Promise<ProjectActionResult> {
  // permission: projects.manage
  return restoreProjectAction(input)
}
