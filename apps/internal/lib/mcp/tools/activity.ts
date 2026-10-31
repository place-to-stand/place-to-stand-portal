import 'server-only'

import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'

import {
  fetchActivityLogs,
  fetchActivityLogsSince,
} from '@/lib/activity/queries'
import {
  ACTIVITY_TARGET_TYPES,
  type ActivityTargetType,
} from '@/lib/activity/types'
import { canReadActivity, SALES_ACTIVITY_TARGET_TYPES } from '@/lib/auth/roles'
import type { AppUser } from '@/lib/auth/session'
import { resolveUserIds } from '@/lib/cli/queries/users'
import { serializeActivity } from '@/lib/cli/serializers/activity'
import { resolveClientIdentifier } from '@/lib/data/clients'
import { resolveProjectIdentifier } from '@/lib/data/projects'
import { activitySource } from '@/lib/db/schema'
import { BadRequestError, ForbiddenError } from '@/lib/errors/http'

import { listLimit } from '../output'
import { defineTool } from '../tool'

const source = z
  .enum(activitySource.enumValues)
  .describe(
    'Only changes made through this channel: ADMIN_UI (the portal), CLI, MCP (an agent) or SYSTEM.'
  )

const actor = z
  .string()
  .trim()
  .min(1)
  .describe('Only changes made by this user: email or UUID.')

const RECENT_DEFAULT = 100

function assertWindow(from: string, to: string | undefined) {
  if (to && new Date(to).getTime() < new Date(from).getTime()) {
    throw new BadRequestError('until must not be before since.')
  }
}
const RECENT_MAX = 500

/**
 * A bare date means the whole UTC day, so `until: "2026-10-25"` still
 * includes everything logged on the 25th.
 */
const windowBound = z
  .union([z.iso.date(), z.iso.datetime({ offset: true })])
  .describe('ISO 8601 date (YYYY-MM-DD, UTC) or date-time with offset.')

function startOf(bound: string): string {
  return bound.length === 10 ? `${bound}T00:00:00.000Z` : bound
}

function endOf(bound: string): string {
  return bound.length === 10 ? `${bound}T23:59:59.999Z` : bound
}

async function resolveActorId(user: AppUser, reference?: string) {
  if (!reference) {
    return undefined
  }

  const [actorId] = await resolveUserIds(user, [reference])

  return actorId
}

export function registerActivityTools(server: McpServer) {
  defineTool(server, {
    name: 'list_activity',
    title: 'List activity',
    description:
      'The audit trail for one thing or one area, newest first: who changed what, when, and through which channel (portal, CLI or an agent). Filter by target type, a target id (a task, lead, contact…), project, client, source, actor or time window; when hasMore is true, narrow the filters. For "what happened recently" across everything, use recent_activity. Sales users must set targetType to LEAD and/or CONTACT and cannot filter by project or client.',
    effect: 'read',
    input: {
      targetType: z
        .array(z.enum(ACTIVITY_TARGET_TYPES))
        .min(1)
        .describe('Only activity on these kinds of record.')
        .optional(),
      targetId: z
        .string()
        .uuid()
        .describe('Only activity on this record (task, lead, contact… UUID).')
        .optional(),
      project: z
        .string()
        .trim()
        .min(1)
        .describe('Project slug or UUID.')
        .optional(),
      client: z
        .string()
        .trim()
        .min(1)
        .describe('Client slug or UUID.')
        .optional(),
      source: source.optional(),
      actor: actor.optional(),
      since: windowBound
        .describe(
          'Only changes on or after this: ISO 8601 date (YYYY-MM-DD, UTC midnight) or date-time with offset.'
        )
        .optional(),
      until: windowBound
        .describe(
          'Only changes on or before this: ISO 8601 date (YYYY-MM-DD, the whole UTC day) or date-time with offset.'
        )
        .optional(),
      limit: listLimit,
    },
    run: async (
      {
        targetType,
        targetId,
        project,
        client,
        source,
        actor,
        since,
        until,
        limit,
      },
      { user }
    ) => {
      const from = since ? startOf(since) : undefined
      const to = until ? endOf(until) : undefined

      if (from) {
        assertWindow(from, to)
      }

      // The portal's rule, checked before any reference is resolved so a SALES
      // caller gets the reason rather than a project or client lookup error:
      // SALES reads LEAD and CONTACT activity only, named by targetType, and
      // never scoped by project or client. `fetchActivityLogs` re-checks it.
      if (
        !canReadActivity(user.role, {
          targetType,
          projectId: project,
          companyId: client,
        })
      ) {
        throw new ForbiddenError(
          'Sales users can read lead and contact activity only: set targetType to LEAD and/or CONTACT, and leave project and client unset.'
        )
      }

      const [projectId, clientId, actorId] = await Promise.all([
        project
          ? resolveProjectIdentifier(user, project).then(p => p.resolvedId)
          : undefined,
        client
          ? resolveClientIdentifier(user, client).then(c => c.resolvedId)
          : undefined,
        resolveActorId(user, actor),
      ])

      const result = await fetchActivityLogs(user, {
        targetType,
        targetId,
        projectId,
        companyId: clientId,
        source,
        actorId,
        since: from,
        until: to,
        limit,
      })

      return {
        items: result.logs.map(serializeActivity),
        hasMore: result.hasMore,
      }
    },
  })

  defineTool(server, {
    name: 'recent_activity',
    title: 'Recent activity',
    description: `Everything that happened across the portal in a time window, oldest first, for questions like "what happened this week?". Returns the newest ${RECENT_DEFAULT} entries by default (max ${RECENT_MAX}); truncated: true means older entries in the window were left out, so narrow the window or filter by source, actor or target type. Sales users see lead and contact activity only.`,
    effect: 'read',
    input: {
      since: windowBound.describe(
        'Start of the window, inclusive: ISO 8601 date (YYYY-MM-DD, UTC midnight) or date-time with offset.'
      ),
      until: windowBound
        .describe(
          'End of the window, inclusive: ISO 8601 date (YYYY-MM-DD, the whole UTC day) or date-time with offset. Defaults to now.'
        )
        .optional(),
      targetType: z
        .array(z.enum(ACTIVITY_TARGET_TYPES))
        .min(1)
        .describe(
          'Only activity on these kinds of record. For sales users it defaults to LEAD and CONTACT, the only kinds they may read.'
        )
        .optional(),
      source: source.optional(),
      actor: actor.optional(),
      limit: z
        .number()
        .int()
        .min(1)
        .max(RECENT_MAX)
        .default(RECENT_DEFAULT)
        .describe(
          `Maximum entries, 1–${RECENT_MAX}. Default ${RECENT_DEFAULT}.`
        ),
    },
    run: async (
      { since, until, targetType, source, actor, limit },
      { user }
    ) => {
      const from = startOf(since)
      const to = until ? endOf(until) : undefined

      assertWindow(from, to)

      // SALES reads only LEAD and CONTACT activity (`canReadActivity`). With
      // no targetType that is the whole of what they may see, so default to
      // it; naming any other type is refused, as on list_activity.
      const scopedTypes =
        targetType ??
        (user.role === 'ADMIN' ? undefined : [...SALES_ACTIVITY_TARGET_TYPES])

      if (!canReadActivity(user.role, { targetType: scopedTypes })) {
        throw new ForbiddenError(
          'Sales users can read lead and contact activity only: leave targetType unset, or set it to LEAD and/or CONTACT.'
        )
      }

      const actorId = await resolveActorId(user, actor)

      // One extra row says whether the window held more than `limit`. The
      // query keeps the newest rows and returns them oldest first, so the
      // surplus row is the first one.
      const logs = await fetchActivityLogsSince(user, {
        since: from,
        until: to,
        targetType: scopedTypes as ActivityTargetType[] | undefined,
        source,
        actorId,
        limit: limit + 1,
      })
      const truncated = logs.length > limit

      return {
        items: (truncated ? logs.slice(1) : logs).map(serializeActivity),
        truncated,
      }
    },
  })
}
