import 'server-only'

/** Turns activity rows into the compact lines the summary prompt reads. */
import { isClientCompany } from '@pts/db/client-state'
import { formatCalendarDate } from '@pts/ui/dates'
import { and, inArray, isNull } from 'drizzle-orm'
import type { ActivityLogWithActor } from '@/lib/activity/types'
import type { Json } from '@/lib/types/json'
import { db } from '@/lib/db'
import { companies, projects } from '@/lib/db/schema'
import { METADATA_CHARACTER_LIMIT } from './config'

export type ActivityContext = {
  projects: Record<
    string,
    {
      id: string
      name: string
      companyId: string | null
    }
  >
  clients: Record<
    string,
    {
      id: string
      name: string
    }
  >
}

export const TARGET_LABELS: Record<string, string> = {
  TASK: 'task work',
  PROJECT: 'project updates',
  CLIENT: 'client changes',
  COMMENT: 'task comments',
  TIME_LOG: 'time logs',
  HOUR_BLOCK: 'hour blocks',
  USER: 'team members',
  SETTINGS: 'settings changes',
  CONTACT: 'person updates',
  COMPANY: 'company updates',
  LEAD: 'lead activity',
  INVOICE: 'invoicing',
  SUBMISSION: 'website submissions',
  MONTHLY_CLOSE: 'monthly close',
  PLAN: 'planning',
}

export const DEFAULT_PROJECT_LABEL = 'General'
export const DEFAULT_CLIENT_LABEL = 'General'
export const COMPANY_GENERAL_CLIENT_LABEL = 'Place To Stand'

export function formatActivityLog(
  log: ActivityLogWithActor,
  context: ActivityContext
): string {
  const { project, client } = resolveProjectClientLabels(log, context)
  // formatCalendarDate pins timestamps to the company timezone (Pacific).
  const formattedTimestamp = `${formatCalendarDate(log.created_at, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })} PT`

  const targetLabel =
    TARGET_LABELS[log.target_type] || log.target_type || 'activity'
  const summary = log.summary.trim().replace(/\s+/g, ' ')
  const verb = log.verb.replaceAll('_', ' ').toLowerCase()

  const parts = [
    `[${formattedTimestamp}]`,
    `${verb} · ${targetLabel} · "${summary}"`,
    `(${project} / ${client})`,
  ]

  const metadata = compactMetadata(log.metadata)
  if (metadata) {
    parts.push(metadata)
  }

  return parts.join(' ')
}

/**
 * Metadata often carries the useful specifics (hours logged, old/new status,
 * amounts), but it can also be a large nested blob. Serialize it compactly
 * and cap the length so one event cannot dominate the prompt.
 */
export function compactMetadata(
  metadata: Json | null | undefined
): string | null {
  if (!metadata || typeof metadata !== 'object') {
    return null
  }

  const serialized = JSON.stringify(metadata)
  if (serialized === '{}' || serialized === '[]') {
    return null
  }

  if (serialized.length <= METADATA_CHARACTER_LIMIT) {
    return serialized
  }

  return serialized.slice(0, METADATA_CHARACTER_LIMIT - 1) + '…'
}

/**
 * Resolves project/client display names for the AI prompt. No per-user
 * filtering: this route is admin-only (assertAdmin above), so the caller may
 * see every referenced project and client.
 */
export async function buildActivityContext(
  logs: ActivityLogWithActor[]
): Promise<ActivityContext> {
  const allowedProjectIds = dedupeIds(logs.map(log => log.target_project_id))
  const allowedClientIds = dedupeIds(logs.map(log => log.target_company_id))

  const [projectRows, clientRows] = await Promise.all([
    allowedProjectIds.length
      ? db
          .select({
            id: projects.id,
            name: projects.name,
            companyId: projects.companyId,
          })
          .from(projects)
          .where(
            and(
              inArray(projects.id, allowedProjectIds),
              isNull(projects.deletedAt)
            )
          )
      : Promise.resolve([]),
    allowedClientIds.length
      ? db
          .select({
            id: companies.id,
            name: companies.name,
          })
          .from(companies)
          .where(
            and(isClientCompany(), inArray(companies.id, allowedClientIds))
          )
      : Promise.resolve([]),
  ])

  const projectDirectory = projectRows.reduce<ActivityContext['projects']>(
    (acc, row) => {
      acc[row.id] = {
        id: row.id,
        name: row.name?.trim() || 'Unnamed Project',
        companyId: row.companyId,
      }
      return acc
    },
    {}
  )

  const clientDirectory = clientRows.reduce<ActivityContext['clients']>(
    (acc, row) => {
      acc[row.id] = {
        id: row.id,
        name: row.name?.trim() || 'Unnamed Client',
      }
      return acc
    },
    {}
  )

  return {
    projects: projectDirectory,
    clients: clientDirectory,
  }
}

export function dedupeIds(values: Array<string | null>): string[] {
  return Array.from(
    new Set(values.filter((value): value is string => Boolean(value)))
  )
}

export function resolveProjectClientLabels(
  log: ActivityLogWithActor,
  context: ActivityContext
): { project: string; client: string } {
  const projectFromContext = log.target_project_id
    ? (context.projects[log.target_project_id] ?? null)
    : null

  const clientFromProject =
    projectFromContext?.companyId &&
    context.clients[projectFromContext.companyId]
      ? context.clients[projectFromContext.companyId]
      : null

  const clientFromContext = log.target_company_id
    ? (context.clients[log.target_company_id] ?? null)
    : null

  const projectName = selectFirstNonEmpty(
    [
      projectFromContext?.name,
      readMetadataString(log.metadata, ['project', 'name']),
      readMetadataString(log.metadata, ['task', 'projectName']),
      readMetadataString(log.metadata, ['projectName']),
    ],
    DEFAULT_PROJECT_LABEL
  )

  let clientName = selectFirstNonEmpty(
    [
      clientFromProject?.name,
      clientFromContext?.name,
      readMetadataString(log.metadata, ['client', 'name']),
      readMetadataString(log.metadata, ['clientName']),
    ],
    DEFAULT_CLIENT_LABEL
  )

  if (
    clientName === DEFAULT_CLIENT_LABEL &&
    projectName === DEFAULT_PROJECT_LABEL
  ) {
    clientName = COMPANY_GENERAL_CLIENT_LABEL
  }

  return { project: projectName, client: clientName }
}

export function selectFirstNonEmpty(
  values: Array<string | null | undefined>,
  fallback: string
): string {
  for (const value of values) {
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (trimmed.length) {
        return trimmed
      }
    }
  }

  return fallback
}

export function readMetadataString(
  source: Json | null | undefined,
  path: string[]
): string | null {
  if (!source) {
    return null
  }

  let current: Json | null | undefined = source

  for (const segment of path) {
    if (
      current &&
      typeof current === 'object' &&
      !Array.isArray(current) &&
      segment in current
    ) {
      current = (current as Record<string, Json | undefined>)[segment]
    } else {
      return null
    }
  }

  return typeof current === 'string' ? current : null
}
