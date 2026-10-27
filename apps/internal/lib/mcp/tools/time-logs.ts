import 'server-only'

import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'

import { resolveUserIds } from '@/lib/cli/queries/users'
import { serializeTimeLog } from '@/lib/cli/serializers/time-log'
import { resolveProjectId } from '@/lib/cli/tasks'
import { fetchProjectsLite } from '@/lib/data/projects'
import { BadRequestError } from '@/lib/errors/http'
import { listTimeLogs } from '@/lib/queries/time-logs/read'

import { listLimit } from '../output'
import { defineTool } from '../tool'

const loggedOn = z.iso.date()

/**
 * Read-only on purpose: hours feed the shared bank account and profit share,
 * so logging time stays a manual human step (D5).
 */
export function registerTimeLogTools(server: McpServer) {
  defineTool(server, {
    name: 'list_time_logs',
    title: 'List time logs',
    description:
      'List logged hours, newest work date first. Filter by project, person and work-date range. totalHours and totalCount cover every matching entry, not just the ones returned; when hasMore is true, narrow the filters. No tool logs or edits time.',
    access: 'admin',
    effect: 'read',
    input: {
      project: z
        .string()
        .trim()
        .min(1)
        .describe('Project slug or UUID.')
        .optional(),
      user: z
        .string()
        .trim()
        .min(1)
        .describe('Whose hours: email or UUID.')
        .optional(),
      from: loggedOn
        .describe('Earliest work date, inclusive (YYYY-MM-DD).')
        .optional(),
      to: loggedOn
        .describe('Latest work date, inclusive (YYYY-MM-DD).')
        .optional(),
      limit: listLimit,
    },
    run: async (
      { project, user: person, from, to, limit },
      { user }
    ) => {
      if (from && to && to < from) {
        throw new BadRequestError('to must not be before from.')
      }

      const [projectId, userIds] = await Promise.all([
        project ? resolveProjectId(user, project) : undefined,
        person ? resolveUserIds(user, [person]) : [],
      ])

      const [result, projects] = await Promise.all([
        listTimeLogs(user, {
          projectId,
          userId: userIds[0],
          from,
          to,
          limit,
        }),
        fetchProjectsLite(),
      ])

      const projectNames = new Map(
        projects.map(row => [row.id, row.name] as const)
      )
      return {
        items: result.logs.map(log => ({
          ...serializeTimeLog(log),
          projectName: projectNames.get(log.project_id) ?? null,
        })),
        hasMore: result.totalCount > result.logs.length,
        totalCount: result.totalCount,
        totalHours: result.totalHours,
      }
    },
  })
}
