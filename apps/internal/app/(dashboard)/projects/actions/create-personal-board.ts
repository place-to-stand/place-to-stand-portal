'use server'

import { z } from 'zod'

import { projectCreatedEvent } from '@/lib/activity/events'
import { logActivity } from '@/lib/activity/logger'
import { requireStaffUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { projects } from '@/lib/db/schema'
import {
  generateUniqueProjectSlug,
  toProjectSlug,
} from '@/lib/settings/projects/project-service'

import { revalidateProjectTaskViews } from './shared'

const inputSchema = z.object({
  name: z.string().trim().min(1, 'Name the board.').max(120),
})

export type CreatePersonalBoardResult =
  | { ok: true; slug: string }
  | { ok: false; error: string }

const INSERT_RETRY_LIMIT = 3

/**
 * Any staff user (admin or sales) may start a PERSONAL board of their own.
 * Only its creator sees it (admins see every project).
 */
export async function createPersonalBoard(input: {
  name: string
}): Promise<CreatePersonalBoardResult> {
  const user = await requireStaffUser()
  const parsed = inputSchema.safeParse(input)

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid board name.',
    }
  }

  const name = parsed.data.name
  const baseSlug = toProjectSlug(name)

  for (let attempt = 0; attempt < INSERT_RETRY_LIMIT; attempt += 1) {
    const slug = await generateUniqueProjectSlug(baseSlug)

    try {
      const [created] = await db
        .insert(projects)
        .values({
          name,
          slug,
          type: 'PERSONAL',
          status: 'ACTIVE',
          createdBy: user.id,
          ownerId: user.id,
        })
        .returning({ id: projects.id, slug: projects.slug })

      if (!created) break

      const event = projectCreatedEvent({ name, status: 'ACTIVE' })
      await logActivity({
        actorId: user.id,
        actorRole: user.role,
        verb: event.verb,
        summary: event.summary,
        targetType: 'PROJECT',
        targetId: created.id,
        targetProjectId: created.id,
        metadata: event.metadata,
      })

      await revalidateProjectTaskViews()
      return { ok: true, slug: created.slug ?? slug }
    } catch (error) {
      // A concurrent insert took the slug: pick the next one and retry.
      if ((error as { code?: string } | null)?.code === '23505') continue
      console.error('Failed to create personal board', error)
      return { ok: false, error: 'Unable to create the board.' }
    }
  }

  return { ok: false, error: 'Unable to create the board. Please try again.' }
}
