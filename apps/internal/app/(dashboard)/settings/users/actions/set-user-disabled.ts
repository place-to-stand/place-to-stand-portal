'use server'

import { requireRole } from '@/lib/auth/session'
import { logActivity } from '@/lib/activity/logger'
import { userUpdatedEvent } from '@/lib/activity/events'
import { trackSettingsServerInteraction } from '@/lib/posthog/server'

import { setPortalUserDisabled } from '@/lib/settings/users/services'
import {
  setUserDisabledSchema,
  type SetUserDisabledInput,
} from '@/lib/settings/users/user-validation'
import { getUserById } from '@/lib/queries/users'
import { NotFoundError } from '@/lib/errors/http'

import { revalidateUsers } from './helpers'
import type { ActionResult } from './types'

export async function setUserDisabled(
  input: SetUserDisabledInput
): Promise<ActionResult> {
  const actor = await requireRole('ADMIN')

  return trackSettingsServerInteraction(
    {
      entity: 'user',
      mode: 'edit',
      targetId: input.id,
      metadata: {
        actorId: actor.id,
        disabled: input.disabled,
      },
    },
    async () => {
      const parsed = setUserDisabledSchema.safeParse(input)

      if (!parsed.success) {
        return { error: 'Invalid access change request.' }
      }

      const payload = parsed.data
      let existingUser: Awaited<ReturnType<typeof getUserById>>

      try {
        existingUser = await getUserById(actor, payload.id)
      } catch (error) {
        console.error('Failed to load user for access change', error)
        if (error instanceof NotFoundError) {
          return { error: 'User not found.' }
        }
        return { error: 'Unable to update user access.' }
      }

      const result = await setPortalUserDisabled(actor, payload)

      if (!result.error) {
        const event = userUpdatedEvent({
          fullName: existingUser.fullName ?? existingUser.email ?? 'User',
          changedFields: [
            payload.disabled ? 'access disabled' : 'access enabled',
          ],
          details: {
            before: { disabled: Boolean(existingUser.disabledAt) },
            after: { disabled: payload.disabled },
          },
        })

        await logActivity({
          actorId: actor.id,
          actorRole: actor.role,
          verb: event.verb,
          summary: event.summary,
          targetType: 'USER',
          targetId: payload.id,
          metadata: event.metadata,
        })

        revalidateUsers()
      }

      return result
    }
  )
}
