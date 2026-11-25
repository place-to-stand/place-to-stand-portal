import 'server-only'

import { alias } from 'drizzle-orm/pg-core'
import {
  and,
  count,
  desc,
  eq,
  ilike,
  isNotNull,
  isNull,
  or,
  sql,
  type SQL,
} from 'drizzle-orm'

import { db } from '@/lib/db'
import {
  companies,
  feedbackReports,
  projectIntegrationLinks,
  projects,
  tasks,
  users,
} from '@/lib/db/schema'
import type { FeedbackType } from '@/lib/feedback/constants'
import type { FeedbackReportRecord, FeedbackState } from '@/lib/feedback/types'
import { createSearchPattern } from '@/lib/pagination/cursor'
import { personNameOf } from '@pts/db/names'
import type { NewFeedbackReport } from '@pts/db/types'

export type FeedbackFilters = {
  /** false/undefined: active rows. true: archived rows. */
  archived?: boolean
  projectId?: string
  type?: FeedbackType
  state?: FeedbackState
  /** Message, page, reporter name or email, project name. */
  search?: string
}

const reporter = alias(users, 'feedback_reporter')

/** The reporter's name: their person's when signed in, else what they typed. */
const reporterNameSql = sql<string | null>`coalesce(${personNameOf(
  'feedback_reporter'
)}, ${feedbackReports.reporterName})`

/** The reporter's email: their sign-in's when signed in, else what they typed. */
const reporterEmailSql = sql<
  string | null
>`coalesce(${reporter.email}, ${feedbackReports.reporterEmail})`

/**
 * New: nobody has looked at it. Not seen, not spam, not already a task (the
 * list shows those as Spam and Task, so they never count as new).
 */
const newReportSql = and(
  isNull(feedbackReports.acknowledgedAt),
  isNull(feedbackReports.spamReason),
  isNull(feedbackReports.taskId)
)

function buildFilters({
  archived,
  projectId,
  type,
  state,
  search,
}: FeedbackFilters): SQL | undefined {
  const pattern = search?.trim() ? createSearchPattern(search) : null

  return and(
    archived
      ? isNotNull(feedbackReports.deletedAt)
      : isNull(feedbackReports.deletedAt),
    projectId ? eq(feedbackReports.projectId, projectId) : undefined,
    type ? eq(feedbackReports.type, type) : undefined,
    state === 'new' ? newReportSql : undefined,
    state === 'task'
      ? and(
          isNotNull(feedbackReports.taskId),
          isNull(feedbackReports.spamReason)
        )
      : undefined,
    state === 'spam' ? isNotNull(feedbackReports.spamReason) : undefined,
    state === 'not_spam' ? isNull(feedbackReports.spamReason) : undefined,
    pattern
      ? or(
          ilike(feedbackReports.message, pattern),
          ilike(feedbackReports.pageUrl, pattern),
          ilike(reporterEmailSql, pattern),
          ilike(reporterNameSql, pattern),
          ilike(projects.name, pattern)
        )
      : undefined
  )
}

const recordColumns = {
  id: feedbackReports.id,
  type: feedbackReports.type,
  message: feedbackReports.message,
  pageUrl: feedbackReports.pageUrl,
  pageTitle: feedbackReports.pageTitle,
  screenshotPath: feedbackReports.screenshotPath,
  screenshotMimeType: feedbackReports.screenshotMimeType,
  screenshotSize: feedbackReports.screenshotSize,
  reporterUserId: feedbackReports.reporterUserId,
  reporterName: reporterNameSql,
  reporterEmail: reporterEmailSql,
  origin: feedbackReports.origin,
  userAgent: feedbackReports.userAgent,
  viewport: feedbackReports.viewport,
  language: feedbackReports.language,
  timezone: feedbackReports.timezone,
  posthogReplayUrl: feedbackReports.posthogReplayUrl,
  spamReason: feedbackReports.spamReason,
  taskId: feedbackReports.taskId,
  taskTitle: tasks.title,
  taskArchived: sql<boolean>`${tasks.deletedAt} is not null`,
  acknowledgedAt: feedbackReports.acknowledgedAt,
  createdAt: feedbackReports.createdAt,
  deletedAt: feedbackReports.deletedAt,
  projectId: projects.id,
  projectName: projects.name,
  projectSlug: projects.slug,
  projectType: projects.type,
  companyId: projects.companyId,
  clientName: companies.name,
  clientSlug: companies.slug,
}

function selectRecords() {
  return db
    .select(recordColumns)
    .from(feedbackReports)
    .innerJoin(projects, eq(projects.id, feedbackReports.projectId))
    .leftJoin(companies, eq(companies.id, projects.companyId))
    .leftJoin(tasks, eq(tasks.id, feedbackReports.taskId))
    .leftJoin(reporter, eq(reporter.id, feedbackReports.reporterUserId))
}

function countRecords(where: SQL | undefined) {
  return db
    .select({ value: count() })
    .from(feedbackReports)
    .innerJoin(projects, eq(projects.id, feedbackReports.projectId))
    .leftJoin(reporter, eq(reporter.id, feedbackReports.reporterUserId))
    .where(where)
}

export async function listFeedbackReports(
  filters: FeedbackFilters,
  { limit, offset }: { limit: number; offset: number }
): Promise<FeedbackReportRecord[]> {
  return selectRecords()
    .where(buildFilters(filters))
    .orderBy(desc(feedbackReports.createdAt), desc(feedbackReports.id))
    .limit(limit)
    .offset(offset)
}

export async function countFeedbackReports(
  filters: FeedbackFilters
): Promise<number> {
  const [row] = await countRecords(buildFilters(filters))
  return Number(row?.value ?? 0)
}

/** New reports, not archived (the nav pill). */
export async function countNewFeedbackReports(): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(feedbackReports)
    .where(and(isNull(feedbackReports.deletedAt), newReportSql))
  return Number(row?.value ?? 0)
}

export async function getFeedbackReportById(
  id: string
): Promise<FeedbackReportRecord | null> {
  const [row] = await selectRecords().where(eq(feedbackReports.id, id)).limit(1)
  return row ?? null
}

/** The one row the intake reads: is this project taking feedback, from where. */
export async function getFeedbackIntakeProject(projectId: string) {
  const [project] = await db
    .select({
      id: projects.id,
      enabled: projects.feedbackEnabled,
      origins: projects.feedbackOrigins,
    })
    .from(projects)
    .where(and(eq(projects.id, projectId), isNull(projects.deletedAt)))
    .limit(1)

  if (!project) return null

  const links = await db
    .select({
      productionDomain: sql<
        string | null
      >`${projectIntegrationLinks.metadata} ->> 'productionDomain'`,
    })
    .from(projectIntegrationLinks)
    .where(
      and(
        eq(projectIntegrationLinks.projectId, projectId),
        eq(projectIntegrationLinks.provider, 'VERCEL'),
        isNull(projectIntegrationLinks.deletedAt)
      )
    )

  return {
    ...project,
    productionDomains: links.map(link => link.productionDomain),
  }
}

/** A project's feedback settings, for its Feedback tab. */
export async function getProjectFeedbackSettings(projectId: string) {
  const project = await getFeedbackIntakeProject(projectId)
  if (!project) return null
  return {
    enabled: project.enabled,
    origins: project.origins,
    productionDomains: project.productionDomains.filter(
      (domain): domain is string => Boolean(domain)
    ),
  }
}

export async function updateProjectFeedbackSettings(
  projectId: string,
  { enabled, origins }: { enabled: boolean; origins: string[] }
): Promise<{ id: string; name: string; companyId: string | null } | null> {
  const rows = await db
    .update(projects)
    .set({
      feedbackEnabled: enabled,
      feedbackOrigins: origins,
      updatedAt: sql`now()`,
    })
    .where(and(eq(projects.id, projectId), isNull(projects.deletedAt)))
    .returning({
      id: projects.id,
      name: projects.name,
      companyId: projects.companyId,
    })
  return rows[0] ?? null
}

export async function insertFeedbackReport(
  row: NewFeedbackReport
): Promise<{ id: string }> {
  const [inserted] = await db
    .insert(feedbackReports)
    .values(row)
    .returning({ id: feedbackReports.id })
  if (!inserted) throw new Error('Feedback report insert returned no row')
  return inserted
}

/**
 * Updates one report. `expect` narrows the row the update may touch (active
 * or archived, still without a task), so a stale screen can't act twice.
 * Returns false when no row matched.
 */
export async function updateFeedbackReport(
  id: string,
  patch: Partial<NewFeedbackReport>,
  expect: { archived?: boolean; withoutTask?: boolean } = {}
): Promise<boolean> {
  const rows = await db
    .update(feedbackReports)
    .set({ ...patch, updatedAt: sql`now()` })
    .where(
      and(
        eq(feedbackReports.id, id),
        expect.archived === undefined
          ? undefined
          : expect.archived
            ? isNotNull(feedbackReports.deletedAt)
            : isNull(feedbackReports.deletedAt),
        expect.withoutTask ? isNull(feedbackReports.taskId) : undefined
      )
    )
    .returning({ id: feedbackReports.id })
  return rows.length > 0
}
