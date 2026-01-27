'use server'

import { eq } from 'drizzle-orm'
import { z } from 'zod'

import { requireRole } from '@/lib/auth/session'
import { logActivity } from '@/lib/activity/logger'
import { projectUpdatedEvent } from '@/lib/activity/events'
import { PROJECT_STATUS_ENUM_VALUES, type ProjectStatusValue } from '@/lib/constants'
import { trackSettingsServerInteraction } from '@/lib/posthog/server'
import { db } from '@/lib/db'
import { projects } from '@/lib/db/schema'
import type { ProjectActionResult } from '@/lib/settings/projects/project-service'
import {
  revalidateProjectDetailRoutes,
  revalidateProjectSettings,
} from './shared'

const updateProjectStatusSchema = z.object({
  projectId: z.string().uuid(),
  status: z.enum(PROJECT_STATUS_ENUM_VALUES),
})

export type UpdateProjectStatusInput = z.infer<typeof updateProjectStatusSchema>

export async function updateProjectStatus(
  input: UpdateProjectStatusInput
): Promise<ProjectActionResult> {
  const user = await requireRole('ADMIN')
  const parsed = updateProjectStatusSchema.safeParse(input)

  if (!parsed.success) {
    return { error: 'Invalid input.' }
  }

  const { projectId, status } = parsed.data

  const result = await trackSettingsServerInteraction(
    {
      entity: 'project',
      mode: 'edit',
      targetId: projectId,
      metadata: { status },
    },
    async () => {
      let existingProject:
        | {
            id: string
            name: string
            status: ProjectStatusValue
            clientId: string | null
          }
        | undefined

      try {
        const rows = await db
          .select({
            id: projects.id,
            name: projects.name,
            status: projects.status,
            clientId: projects.clientId,
          })
          .from(projects)
          .where(eq(projects.id, projectId))
          .limit(1)

        existingProject = rows[0]
      } catch (error) {
        console.error('Failed to load project for status update', error)
        return { error: 'Unable to update project status.' }
      }

      if (!existingProject) {
        return { error: 'Project not found.' }
      }

      if (existingProject.status === status) {
        return {}
      }

      try {
        await db
          .update(projects)
          .set({ status })
          .where(eq(projects.id, projectId))
      } catch (error) {
        console.error('Failed to update project status', error)
        return {
          error:
            error instanceof Error
              ? error.message
              : 'Unable to update project status.',
        }
      }

      const event = projectUpdatedEvent({
        name: existingProject.name,
        changedFields: ['status'],
        details: {
          before: { status: existingProject.status },
          after: { status },
        },
      })

      await logActivity({
        actorId: user.id,
        actorRole: user.role,
        verb: event.verb,
        summary: event.summary,
        targetType: 'PROJECT',
        targetId: projectId,
        targetProjectId: projectId,
        targetClientId: existingProject.clientId,
        metadata: event.metadata,
      })

      return { projectId }
    }
  )

  if (!result.error) {
    await revalidateProjectSettings()
    await revalidateProjectDetailRoutes()
  }

  return result
}
