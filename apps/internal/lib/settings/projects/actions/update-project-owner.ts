'use server'

import { and, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'

import { requireRole } from '@/lib/auth/session'
import { logActivity } from '@/lib/activity/logger'
import { projectUpdatedEvent } from '@/lib/activity/events'
import { trackSettingsServerInteraction } from '@/lib/posthog/server'
import { db } from '@/lib/db'
import { projects, users } from '@/lib/db/schema'
import type { ProjectActionResult } from '@/lib/settings/projects/project-service'
import {
  revalidateProjectDetailRoutes,
  revalidateProjectSettings,
} from './shared'

const updateProjectOwnerSchema = z.object({
  projectId: z.string().uuid(),
  /** Null clears the owner (the sheet's "Unassigned" option). */
  ownerId: z.string().uuid().nullable(),
})

export type UpdateProjectOwnerInput = z.infer<typeof updateProjectOwnerSchema>

/**
 * Single-field owner swap for table-row controls (the landing's avatar
 * picker). Mirrors `updateProjectStatus`; the full-form path stays
 * `saveProject`.
 */
export async function updateProjectOwner(
  input: UpdateProjectOwnerInput
): Promise<ProjectActionResult> {
  const user = await requireRole('ADMIN')
  const parsed = updateProjectOwnerSchema.safeParse(input)

  if (!parsed.success) {
    return { error: 'Invalid input.' }
  }

  const { projectId, ownerId } = parsed.data

  const result = await trackSettingsServerInteraction(
    {
      entity: 'project',
      mode: 'edit',
      targetId: projectId,
      metadata: { ownerId },
    },
    async () => {
      let existingProject:
        | {
            id: string
            name: string
            ownerId: string | null
            clientId: string | null
          }
        | undefined

      try {
        const rows = await db
          .select({
            id: projects.id,
            name: projects.name,
            ownerId: projects.ownerId,
            clientId: projects.clientId,
          })
          .from(projects)
          .where(and(eq(projects.id, projectId), isNull(projects.deletedAt)))
          .limit(1)

        existingProject = rows[0]
      } catch (error) {
        console.error('Failed to load project for owner update', error)
        return { error: 'Unable to update project owner.' }
      }

      if (!existingProject) {
        return { error: 'Project not found or has been archived.' }
      }

      const previousOwnerId = existingProject.ownerId ?? null

      if (previousOwnerId === ownerId) {
        return {}
      }

      // A valid uuid isn't enough — the owner must be an active admin, or a
      // stale/forged id would attribute the project to nobody reachable.
      if (ownerId) {
        const [owner] = await db
          .select({ id: users.id })
          .from(users)
          .where(
            and(
              eq(users.id, ownerId),
              eq(users.role, 'ADMIN'),
              isNull(users.deletedAt)
            )
          )
          .limit(1)

        if (!owner) {
          return { error: 'Selected owner is not an active admin.' }
        }
      }

      try {
        await db
          .update(projects)
          .set({ ownerId })
          .where(and(eq(projects.id, projectId), isNull(projects.deletedAt)))
      } catch (error) {
        console.error('Failed to update project owner', error)
        return {
          error:
            error instanceof Error
              ? error.message
              : 'Unable to update project owner.',
        }
      }

      // Same field name and shape saveProject logs for owner changes, so the
      // activity feed renders both paths identically.
      const event = projectUpdatedEvent({
        name: existingProject.name,
        changedFields: ['owner'],
        details: {
          before: { ownerId: previousOwnerId },
          after: { ownerId },
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
