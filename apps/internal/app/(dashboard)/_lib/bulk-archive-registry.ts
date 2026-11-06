import 'server-only'

import { inArray } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import type { Capability } from '@/lib/auth/capabilities'
import type { BulkArchiveEntity } from '@/lib/bulk/archive-entities'
import {
  applyCompanyListParams,
  parseCompaniesSearchParams,
} from '@/lib/companies/filters'
import { closedMonthWarning } from '@/lib/data/reports/close'
import { fetchTimeLogPage } from '@/lib/data/dashboard/hours'
import { fetchFormSubmissions } from '@/lib/data/form-submissions'
import { fetchProjectsForLanding } from '@/lib/data/projects'
import { db } from '@/lib/db'
import { timeLogs } from '@/lib/db/schema'
import { parseSubmissionsListParams } from '@/lib/form-submissions/list-params'
import { parseHourBlocksSearchParams } from '@/lib/hour-blocks/filters'
import { parseInvoicesSearchParams } from '@/lib/invoices/filters'
import { parseContactsSearchParams } from '@/lib/people/filters'
import { scopeProjectsForViewer } from '@/lib/projects/viewer-scope'
import { listCompanies } from '@/lib/queries/companies'
import { listContactsForSettings } from '@/lib/queries/contacts'
import { listHourBlocksForSettings } from '@/lib/queries/hour-blocks'
import { listInvoices } from '@/lib/queries/invoices'
import { listProjectsForSettings } from '@/lib/queries/projects'
import { restoreTimeLog, softDeleteTimeLog } from '@/lib/queries/time-logs'
import { parseTimeLogsSearchParams } from '@/lib/time-logs/filters'
import { canSeePortalAccess } from '@/lib/people/portal-visibility'
import { softDeleteProject } from '@/lib/projects/sheet/actions/soft-delete-project'
import { restoreProject } from '@/lib/projects/sheet/actions/restore-project'

import { archiveCompany, restoreCompany } from '../companies/actions'
import { restoreContact, softDeleteContact } from '../people/actions'
import { restoreHourBlock, softDeleteHourBlock } from '../hour-blocks/actions'
import { archiveInvoice, restoreInvoice } from '../invoices/actions'
import { archiveSubmission } from '../submissions/actions/archive-submission'
import { restoreSubmission } from '../submissions/actions/restore-submission'
import type { RowOutcome } from './run-bulk'
import { parseProjectsLandingSearchParams } from '../projects/_lib/parse-projects-search-params'
import { parseProjectsSearchParams } from '../projects/_lib/parse-projects-search-params'

type Params = Record<string, string>

type Page = { ids: string[]; total: number }

export type BulkArchiveConfig = {
  /** Checked once before any row; each row's own action checks again. */
  capability: Capability
  /**
   * Every row the list shows for these URL params, on every page:
   * `archived` lists the Archive tab. Throws when the list is too long.
   */
  matchingIds: (
    user: AppUser,
    params: Params,
    archived: boolean,
    limit: number
  ) => Promise<string[]>
  /**
   * Archive or restore one row through the same code its row button runs,
   * so the rules (and activity entries) can't drift apart.
   */
  apply: (
    user: AppUser,
    id: string,
    archive: boolean,
    /** What `prepare` found for this row, if the list has a `prepare`. */
    context?: string
  ) => Promise<RowOutcome>
  /** Batch lookups before the rows run (a time log's project). */
  prepare?: (ids: string[]) => Promise<Map<string, string>>
}

export class BulkTooLargeError extends Error {}

/** Walks a paged list query, 100 rows at a time, collecting ids. */
async function collectPages(
  limit: number,
  fetchPage: (offset: number, pageSize: number) => Promise<Page>
): Promise<string[]> {
  const pageSize = 100
  const ids: string[] = []
  for (let offset = 0; ; offset += pageSize) {
    const page = await fetchPage(offset, pageSize)
    if (page.total > limit) throw new BulkTooLargeError()
    ids.push(...page.ids)
    if (page.ids.length < pageSize || ids.length >= page.total) return ids
  }
}

function capped(ids: string[], limit: number) {
  if (ids.length > limit) throw new BulkTooLargeError()
  return ids
}

/** `{ error }`-shaped single actions (most of them). */
async function outcome(run: Promise<{ error?: string; warning?: string }>) {
  const result = await run
  return { error: result.error, warning: result.warning ?? null }
}

export const BULK_ARCHIVE_REGISTRY: Record<
  BulkArchiveEntity,
  BulkArchiveConfig
> = {
  company: {
    capability: 'companies.manage',
    matchingIds: async (user, params, archived, limit) => {
      const listParams = parseCompaniesSearchParams(params)
      const rows = await listCompanies(user, {
        status: archived ? 'archived' : 'active',
        search: listParams.search,
      })
      return capped(
        applyCompanyListParams(rows, listParams).map(row => row.id),
        limit
      )
    },
    apply: async (_user, id, archive) => {
      const result = archive
        ? await archiveCompany(id)
        : await restoreCompany(id)
      return result.ok
        ? {}
        : { error: result.error ?? 'Unable to change company.' }
    },
  },
  contact: {
    capability: 'contacts.manage',
    matchingIds: (user, params, archived, limit) => {
      const { search, companyId, signIn, sort } =
        parseContactsSearchParams(params)
      return collectPages(limit, async (offset, pageSize) => {
        const result = await listContactsForSettings(user, {
          status: archived ? 'archived' : 'active',
          search,
          companyId,
          // The sign-in filter exists on the active tab, for admins.
          signIn:
            !archived && canSeePortalAccess(user.role) ? signIn : undefined,
          offset,
          limit: pageSize,
          sort,
        })
        return {
          ids: result.items.map(item => item.id),
          total: result.totalCount,
        }
      })
    },
    apply: (_user, id, archive) =>
      outcome(archive ? softDeleteContact({ id }) : restoreContact({ id })),
  },
  hourBlock: {
    capability: 'billing.manage',
    matchingIds: (user, params, archived, limit) => {
      const { search, sort, companyId, invoice, from, to } =
        parseHourBlocksSearchParams(params)
      return collectPages(limit, async (offset, pageSize) => {
        const result = await listHourBlocksForSettings(user, {
          status: archived ? 'archived' : 'active',
          offset,
          limit: pageSize,
          search,
          sort,
          companyId,
          invoice,
          from,
          to,
        })
        return {
          ids: result.items.map(item => item.id),
          total: result.totalCount,
        }
      })
    },
    apply: (_user, id, archive) =>
      outcome(archive ? softDeleteHourBlock({ id }) : restoreHourBlock({ id })),
  },
  invoice: {
    capability: 'billing.manage',
    matchingIds: (user, params, archived, limit) => {
      const { status, search, sort } = parseInvoicesSearchParams(params)
      return collectPages(limit, async (offset, pageSize) => {
        const result = await listInvoices(user, {
          status: archived ? 'archived' : 'active',
          offset,
          limit: pageSize,
          invoiceStatus: status,
          search,
          sort,
        })
        return {
          ids: result.items.map(item => item.id),
          total: result.totalCount,
        }
      })
    },
    apply: (_user, id, archive) =>
      outcome(archive ? archiveInvoice({ id }) : restoreInvoice({ id })),
  },
  project: {
    capability: 'projects.manage',
    matchingIds: async (user, params, archived, limit) => {
      if (archived) {
        const { searchQuery, sort } = parseProjectsSearchParams(params)
        return collectPages(limit, async (offset, pageSize) => {
          const result = await listProjectsForSettings(user, {
            status: 'archived',
            search: searchQuery ?? '',
            offset,
            limit: pageSize,
            sort,
          })
          return {
            ids: result.items.map(item => item.id),
            total: result.totalCount,
          }
        })
      }
      // The active landing isn't paged: every match is already on screen.
      const { statuses, search } = parseProjectsLandingSearchParams(params)
      const projects = await scopeProjectsForViewer(
        user,
        await fetchProjectsForLanding({ statuses, search: search ?? undefined })
      )
      return capped(
        projects
          .filter(
            project =>
              project.type !== 'PERSONAL' || project.created_by === user.id
          )
          .map(project => project.id),
        limit
      )
    },
    apply: (_user, id, archive) =>
      outcome(archive ? softDeleteProject({ id }) : restoreProject({ id })),
  },
  submission: {
    capability: 'submissions.manage',
    matchingIds: (user, params, archived, limit) => {
      const filters = parseSubmissionsListParams(
        params,
        archived ? 'archive' : 'active'
      )
      return collectPages(limit, async (offset, pageSize) => {
        const result = await fetchFormSubmissions(user, {
          ...filters,
          page: offset / pageSize + 1,
          pageSize,
          archived,
        })
        return {
          ids: result.items.map(item => item.id),
          total: result.totalCount,
        }
      })
    },
    apply: (_user, id, archive) =>
      outcome(archive ? archiveSubmission({ id }) : restoreSubmission({ id })),
  },
  timeLog: {
    capability: 'billing.manage',
    matchingIds: (_user, params, archived, limit) => {
      const filters = parseTimeLogsSearchParams(params)
      return collectPages(limit, async (offset, pageSize) => {
        const page = await fetchTimeLogPage({
          search: filters.q,
          from: filters.from || undefined,
          to: filters.to || undefined,
          clientCompanyId: filters.companyId,
          projectId: filters.projectId,
          userId: filters.personId,
          limit: pageSize,
          offset,
          archived,
          sort: filters.sort,
        })
        return {
          ids: page.items.map(item => item.id),
          total: page.totalCount,
        }
      })
    },
    // A log's mutations are keyed by its project: look them up in one go.
    prepare: async ids => {
      const rows = await db
        .select({ id: timeLogs.id, projectId: timeLogs.projectId })
        .from(timeLogs)
        .where(inArray(timeLogs.id, ids))
      return new Map(rows.map(row => [row.id, row.projectId]))
    },
    apply: async (user, id, archive, projectId) => {
      if (!projectId) return { error: 'Time log not found.' }
      const { loggedOn } = archive
        ? await softDeleteTimeLog(user, projectId, id)
        : await restoreTimeLog(user, projectId, id)
      return { warning: await closedMonthWarning(user, [loggedOn]) }
    },
  },
}
