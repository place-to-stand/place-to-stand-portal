import { wasClientCompany } from '@pts/db/client-state'
import 'server-only'

import { clientFields } from '@/lib/queries/companies/billing/selectors'
import { and, eq } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { companies } from '@/lib/db/schema'
import { fetchLatestClosersByClient } from '@/lib/queries/companies/billing/commission-terms'
import type { ClientWithClosers } from '@/lib/companies/billing/client-sheet-utils'
import {
  fetchProjectsLite,
  fetchProjectsWithRelationsByIds,
} from '@/lib/data/projects'
import { getTaskHome } from '@/lib/data/tasks'
import { normalizeRawTask } from '@/lib/data/projects/normalize-task'
import { loadTaskWithRelations } from '@/lib/queries/tasks/relations'
import { fetchFormSubmissionById } from '@/lib/data/form-submissions'
import {
  fetchArchivedLeads,
  fetchLeadAssignees,
  fetchLeadById,
} from '@/lib/data/leads'
import { fetchAdminUsers, fetchCrmUsers } from '@/lib/data/users'
import { NotFoundError } from '@/lib/errors/http'
import { ForbiddenError } from '@/lib/errors/http'
import { roleCan } from '@/lib/auth/capabilities'
import { assertCan } from '@/lib/auth/permissions'
import { ensureTaskWorkAccess } from '@/lib/projects/access'
import { scopeProjectsForViewer } from '@/lib/projects/viewer-scope'
import {
  listClientDirectory,
  toClientPickerRow,
} from '@/lib/queries/companies/billing'
import { getContactDeepLinkRowById } from '@/lib/queries/contacts'
import {
  getHourBlockWithClientById,
  listHourBlockClientDirectory,
} from '@/lib/queries/hour-blocks'
import {
  getInvoiceById,
  listInvoiceReferenceData,
} from '@/lib/queries/invoices'
import { getProjectById } from '@/lib/queries/projects'
import type { ProjectWithClient } from '@/lib/projects/sheet/project-sheet-form'

import { NEW_SHEET_VALUE } from '../entities'
import type { SheetInitEntity, SheetInitPayloads } from './payloads'

type SheetInitResolver<E extends SheetInitEntity> = (
  user: AppUser,
  /** Param value: a validated UUID, or `new` for create sheets. */
  id: string
) => Promise<SheetInitPayloads[E]>

const resolveClientInit: SheetInitResolver<'client'> = async (user, id) => {
  // Billing fields: checked here too, not only by the route's allowlist.
  assertCan(user, 'clients.manage')
  if (id === NEW_SHEET_VALUE) {
    return { client: null }
  }

  // The billing form self-fetches its reference data (contacts/admins) —
  // it only needs the row (snake_case `ClientCompanyView` plus its closer split).
  const rows = await db
    .select(clientFields)
    .from(companies)
    // Former clients too: the company sheet restarts billing from their
    // last terms.
    .where(and(wasClientCompany(), eq(companies.id, id)))
    .limit(1)

  const row = rows[0]
  if (!row) {
    throw new NotFoundError('Client not found')
  }

  const closersByClient = await fetchLatestClosersByClient([row.id])
  const client: ClientWithClosers = {
    id: row.id,
    name: row.name,
    slug: row.slug,
    notes: row.notes,
    state: row.state ?? null,
    origination_contact_id: row.originationContactId,
    origination_user_id: row.originationUserId,
    billing_type: row.billingType,
    company_id: row.companyId,
    created_by: row.createdBy,
    created_at: row.createdAt ?? row.updatedAt,
    updated_at: row.updatedAt,
    deleted_at: row.deletedAt,
    closers: closersByClient.get(row.id) ?? [],
  }

  return { client }
}

const resolveSubmissionInit: SheetInitResolver<'submission'> = async (
  user,
  id
) => {
  if (id === NEW_SHEET_VALUE) {
    throw new NotFoundError('Submissions cannot be created from the portal')
  }

  const submission = await fetchFormSubmissionById(user, id, true)
  return { submission }
}

const resolveContactInit: SheetInitResolver<'contact'> = async (user, id) => {
  if (id === NEW_SHEET_VALUE) {
    return { contact: null }
  }

  // The contact sheet self-fetches its client links (`getContactSheetData`)
  // — it only needs the minimal row. Archived people open too (stacked over
  // another sheet, or off the People pages), as on the Archive tab.
  const contact = await getContactDeepLinkRowById(user, id)
  if (!contact) {
    throw new NotFoundError('Person not found')
  }
  return { contact }
}

const resolveHourBlockInit: SheetInitResolver<'hour-block'> = async (
  user,
  id
) => {
  const [clientDirectory, hourBlock] = await Promise.all([
    listHourBlockClientDirectory(user),
    id === NEW_SHEET_VALUE ? null : getHourBlockWithClientById(user, id),
  ])

  if (id === NEW_SHEET_VALUE) {
    return { hourBlock: null, clients: clientDirectory }
  }

  if (!hourBlock) {
    throw new NotFoundError('Hour block not found')
  }

  return { hourBlock, clients: clientDirectory }
}

const resolveInvoiceInit: SheetInitResolver<'invoice'> = async (user, id) => {
  const reference = await listInvoiceReferenceData(user)

  if (id === NEW_SHEET_VALUE) {
    return { invoice: null, ...reference }
  }

  const invoice = await getInvoiceById(user, id)
  if (!invoice) {
    throw new NotFoundError('Invoice not found')
  }

  return { invoice, ...reference }
}

const resolveProjectInit: SheetInitResolver<'project'> = async (user, id) => {
  // Without `projects.manage` the sheet can only create (no edits) and gets
  // no client or team lists.
  if (!roleCan(user.role, 'projects.manage')) {
    if (id !== NEW_SHEET_VALUE || !roleCan(user.role, 'projects.create')) {
      throw new ForbiddenError('Only admins can edit projects.')
    }
    return { project: null, clients: [], adminUsers: [] }
  }

  const [clientDirectory, adminUsersResult] = await Promise.all([
    listClientDirectory(),
    fetchAdminUsers(),
  ])

  const clientRows = clientDirectory.map(toClientPickerRow)
  const adminUsers = adminUsersResult.map(admin => ({
    id: admin.id,
    full_name: admin.full_name,
    email: admin.email,
    avatar_url: admin.avatar_url,
    disabled_at: admin.disabled_at ?? null,
  }))

  if (id === NEW_SHEET_VALUE) {
    return { project: null, clients: clientRows, adminUsers }
  }

  const row = await getProjectById(user, id)
  // The directory holds every client (archived included), so the project's
  // client sub-row resolves from it without another query.
  const clientRow = row.companyId
    ? (clientDirectory.find(client => client.id === row.companyId) ?? null)
    : null

  const project: ProjectWithClient = {
    id: row.id,
    company_id: row.companyId,
    name: row.name,
    status: row.status,
    type: row.type,
    starts_on: row.startsOn,
    ends_on: row.endsOn,
    created_by: row.createdBy,
    owner_id: row.ownerId,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
    deleted_at: row.deletedAt,
    slug: row.slug,
    client: clientRow
      ? {
          id: clientRow.id,
          name: clientRow.name,
          deleted_at: clientRow.deletedAt,
        }
      : null,
  }

  return { project, clients: clientRows, adminUsers }
}

const resolveLeadInit: SheetInitResolver<'lead'> = async (user, id) => {
  const assignees = await fetchLeadAssignees()
  const senderName = user.full_name ?? user.email ?? null

  if (id === NEW_SHEET_VALUE) {
    return { lead: null, assignees, senderName }
  }

  try {
    const lead = await fetchLeadById(user, id)
    return { lead, assignees, senderName }
  } catch (error) {
    // An archived lead opens here too (stacked over another sheet, or off
    // the Leads pages), as it does on the Archive tab.
    if (!(error instanceof NotFoundError)) throw error
    const archived = (await fetchArchivedLeads(user)).find(
      lead => lead.id === id
    )
    if (!archived) throw error
    return { lead: archived, assignees, senderName }
  }
}

const resolveTaskInit: SheetInitResolver<'task'> = async (user, id) => {
  // The sheet only reads project identity fields for its selector — no need
  // to hydrate every project's task graph. Assignees come from every CRM
  // user; the save path checks each one can reach the task's project. Leads
  // for the same selector load through their own GET route.
  const isNew = id === NEW_SHEET_VALUE
  const [admins, liteProjects, home] = await Promise.all([
    fetchCrmUsers(),
    fetchProjectsLite(),
    isNew ? Promise.resolve(null) : getTaskHome(id),
  ])
  // Non-admins only see (redacted) projects they can work.
  const allProjects = await scopeProjectsForViewer(user, liteProjects)

  const base = {
    admins,
    projects: allProjects,
    currentUserId: user.id,
  }

  if (isNew) {
    return { task: null, ...base }
  }

  if (!home) {
    throw new NotFoundError('Task not found')
  }
  // Archived tasks open too: the Review tab stacks them over other sheets.
  await ensureTaskWorkAccess(user, id, { includeArchived: true })

  // A lead task has no project to hydrate: load the task alone.
  if (!home.projectId) {
    const raw = await loadTaskWithRelations(id)
    if (!raw) {
      throw new NotFoundError('Task not found')
    }
    return { task: normalizeRawTask(raw), ...base }
  }

  // Hydrate the holding project with just this task: the sheet reads the
  // project's own fields, never its other tasks.
  const holdingProjectId = home.projectId
  const [hydratedProject] = await scopeProjectsForViewer(
    user,
    await fetchProjectsWithRelationsByIds([holdingProjectId], {
      taskIds: [id],
      includeArchivedTasks: true,
    })
  )
  const task =
    [
      ...(hydratedProject?.tasks ?? []),
      ...(hydratedProject?.archivedTasks ?? []),
    ].find(item => item.id === id) ?? null

  if (!task) {
    throw new NotFoundError('Task not found')
  }

  return {
    task,
    ...base,
    projects: allProjects.map(project =>
      project.id === holdingProjectId && hydratedProject
        ? hydratedProject
        : project
    ),
  }
}

const resolveCompanyInit: SheetInitResolver<'company'> = async (_user, id) => ({
  companyId: id === NEW_SHEET_VALUE ? null : id,
})

const RESOLVERS: {
  [E in SheetInitEntity]: SheetInitResolver<E>
} = {
  task: resolveTaskInit,
  client: resolveClientInit,
  submission: resolveSubmissionInit,
  contact: resolveContactInit,
  'hour-block': resolveHourBlockInit,
  invoice: resolveInvoiceInit,
  project: resolveProjectInit,
  lead: resolveLeadInit,
  company: resolveCompanyInit,
}

export const isSheetInitEntity = (value: string): value is SheetInitEntity =>
  value in RESOLVERS

export async function resolveSheetInit<E extends SheetInitEntity>(
  user: AppUser,
  entity: E,
  id: string
): Promise<SheetInitPayloads[E]> {
  return RESOLVERS[entity](user, id)
}
