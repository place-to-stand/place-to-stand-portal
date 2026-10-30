import { wasClientCompany, clientEndedAtSql } from '@pts/db/client-state'
import 'server-only'

import { currentBillingTypeSql } from '@/lib/queries/clients/billing-terms'
import { clientNameSql } from '@pts/db/names'
import {
  currentOriginationContactIdSql,
  currentOriginationUserIdSql,
} from '@/lib/queries/clients/commission-terms'
import { and, eq, isNull } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { companies, contacts } from '@/lib/db/schema'
import {
  fetchProjectsLite,
  fetchProjectsWithRelationsByIds,
} from '@/lib/data/projects'
import { getActiveTaskProjectId } from '@/lib/data/tasks'
import { fetchFormSubmissionById } from '@/lib/data/form-submissions'
import { fetchLeadAssignees, fetchLeadById } from '@/lib/data/leads'
import {
  findSalesProjectId,
  getOrCreateSalesProject,
} from '@/lib/leads/sales-project'
import { fetchAdminUsers, fetchCrmUsers } from '@/lib/data/users'
import { NotFoundError } from '@/lib/errors/http'
import { ForbiddenError } from '@/lib/errors/http'
import { roleCan } from '@/lib/auth/capabilities'
import { ensureTaskWorkAccess } from '@/lib/projects/access'
import { scopeProjectsForViewer } from '@/lib/projects/viewer-scope'
import { fetchClientDirectory } from '@/lib/queries/clients'
import { getContactSheetInputById } from '@/lib/queries/contacts'
import {
  getHourBlockWithClientById,
  listHourBlockClientDirectory,
} from '@/lib/queries/hour-blocks'
import {
  getInvoiceById,
  listInvoiceReferenceData,
} from '@/lib/queries/invoices'
import { getProjectById } from '@/lib/queries/projects'
import type { ProjectWithClient } from '@/lib/settings/projects/project-sheet-form'
import { fetchLatestClosersByClient } from '@/lib/queries/clients/commission-terms'
import type { ClientRow } from '@/lib/companies/billing/client-sheet-utils'

import { NEW_SHEET_VALUE } from '../entities'
import type { SheetInitEntity, SheetInitPayloads } from './payloads'

type SheetInitResolver<E extends SheetInitEntity> = (
  user: AppUser,
  /** Param value: a validated UUID, or `new` for create sheets. */
  id: string
) => Promise<SheetInitPayloads[E]>

const resolveClientInit: SheetInitResolver<'client'> = async (_user, id) => {
  if (id === NEW_SHEET_VALUE) {
    return { client: null }
  }

  // The billing form self-fetches its reference data (contacts/admins) —
  // it only needs the row (snake_case `DbClient` plus its closer split).
  const rows = await db
    .select({
      id: companies.id,
      companyId: companies.id,
      slug: companies.slug,
      notes: companies.notes,
      state: companies.state,
      createdBy: companies.createdBy,
      createdAt: companies.clientSince,
      updatedAt: companies.updatedAt,
      deletedAt: clientEndedAtSql,
      // Billing type and commission live on the terms; these are the
      // newest terms'.
      name: clientNameSql,
      billingType: currentBillingTypeSql(),
      originationContactId: currentOriginationContactIdSql(),
      originationUserId: currentOriginationUserIdSql(),
    })
    .from(companies)
    .where(
      and(wasClientCompany(), eq(companies.id, id), isNull(clientEndedAtSql))
    )
    .limit(1)

  const row = rows[0]
  if (!row) {
    throw new NotFoundError('Client not found')
  }

  const closersByClient = await fetchLatestClosersByClient([row.id])
  const client: ClientRow = {
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
  // — it only needs the minimal row.
  const contact = await getContactSheetInputById(user, id)
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

/** Old `?user=<id>` links: a sign-in is managed on its person's sheet. */
const resolveUserInit: SheetInitResolver<'user'> = async (_user, id) => {
  if (id === NEW_SHEET_VALUE) return { contactId: null }
  const [person] = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(eq(contacts.userId, id), isNull(contacts.deletedAt)))
    .limit(1)
  return { contactId: person?.id ?? null }
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
    fetchClientDirectory(),
    fetchAdminUsers(),
  ])

  const clientRows = clientDirectory.map(client => ({
    id: client.id,
    name: client.name,
    deleted_at: client.deletedAt,
  }))
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

  const lead = await fetchLeadById(user, id)
  return { lead, assignees, senderName }
}

const resolveTaskInit: SheetInitResolver<'task'> = async (user, id) => {
  // The sheet only reads project identity fields for its selector — no need
  // to hydrate every project's task graph. Assignees come from every CRM
  // user; the save path checks each one can reach the task's project.
  const [admins, liteProjects, salesProjectId] = await Promise.all([
    fetchCrmUsers(),
    fetchProjectsLite(),
    // Opening a sheet never creates projects for non-admins: SALES only
    // read it (null until an admin's sheet or the CLI creates it).
    user.role === 'ADMIN'
      ? getOrCreateSalesProject(user.id)
      : findSalesProjectId(),
  ])
  // Non-admins only see (redacted) projects they can work.
  const allProjects = await scopeProjectsForViewer(user, liteProjects)

  const base = {
    admins,
    projects: allProjects,
    salesProjectId,
    currentUserId: user.id,
  }

  if (id === NEW_SHEET_VALUE) {
    return { task: null, ...base }
  }

  // Resolve the task's project, then hydrate just that project's graph so
  // the sheet gets a full `TaskWithRelations`.
  const holdingProjectId = await getActiveTaskProjectId(id)
  if (!holdingProjectId) {
    throw new NotFoundError('Task not found')
  }
  if (user.role !== 'ADMIN') {
    await ensureTaskWorkAccess(user, id)
  }

  const [hydratedProject] = await scopeProjectsForViewer(
    user,
    await fetchProjectsWithRelationsByIds([holdingProjectId])
  )
  const task = hydratedProject?.tasks.find(item => item.id === id) ?? null

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
  user: resolveUserInit,
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
