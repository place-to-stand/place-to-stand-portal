import type { InferSelectModel, Table } from 'drizzle-orm'

import {
  activitySource,
  clientBillingType,
  projectType,
  taskAttachments,
  taskDeployments,
  tasks,
  projects,
  userRole,
  workerStatus,
} from '@/lib/db/schema'

export type UserRoleValue = (typeof userRole.enumValues)[number]
export type ActivitySourceValue = (typeof activitySource.enumValues)[number]
export type ClientBillingTypeValue =
  (typeof clientBillingType.enumValues)[number]
export type ProjectTypeValue = (typeof projectType.enumValues)[number]
export type WorkerStatusValue = (typeof workerStatus.enumValues)[number]

type SnakeCase<S extends string> = S extends `${infer Head}${infer Tail}`
  ? Head extends Lowercase<Head>
    ? `${Head}${SnakeCase<Tail>}`
    : `_${Lowercase<Head>}${SnakeCase<Tail>}`
  : S

/**
 * A table's row with snake_case keys: the shape the data layer hands to
 * client components. Derived from the Drizzle schema so a column change
 * shows up here instead of drifting from a hand-written copy.
 */
type SnakeRow<T extends Table> = {
  [
    K in keyof InferSelectModel<T> as SnakeCase<K & string>
  ]: InferSelectModel<T>[K]
}

/**
 * A client: a company you bill (0111), read from `companies`. `id` and
 * `company_id` are the same id. `billing_type` and `origination_*` come
 * from the newest terms; `deleted_at` means billing stopped
 * (billing ended, or the company archived).
 */
export type ClientCompanyView = {
  id: string
  name: string
  slug: string | null
  notes: string | null
  state: string | null
  origination_contact_id: string | null
  origination_user_id: string | null
  billing_type: ClientBillingTypeValue
  company_id?: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

/**
 * A client as the project, invoice and hour-block pickers list it (archived
 * ones included, so a record's own archived client still shows).
 */
export type ClientPickerRow = Pick<
  ClientCompanyView,
  'id' | 'name' | 'deleted_at'
>

/** A portal login with access to a client (from `client_portal_access`). */
export type DbClientMember = {
  /** The contact behind the login. */
  id: string
  /** The billed company they can see. */
  company_id: string
  user_id: string
  created_at: string
  deleted_at: string | null
}

export type DbProject = SnakeRow<typeof projects>

export type DbTask = SnakeRow<typeof tasks>

export type DbUser = {
  id: string
  email: string
  full_name: string | null
  role: UserRoleValue
  avatar_url: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  // Optional: only populated where sign-in access matters (settings/users).
  // NULL/undefined means the user may sign in; set means auth rejects them.
  disabled_at?: string | null
  // Optional: only populated by the settings/users list (from auth.users).
  last_sign_in_at?: string | null
}

type DbTaskComment = {
  id: string
  task_id: string
  author_id: string
  body: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

type DbTimeLog = {
  id: string
  project_id: string
  user_id: string
  hours: number
  logged_on: string
  note: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}
export type DbTaskAttachment = SnakeRow<typeof taskAttachments>

export type DbTaskDeployment = SnakeRow<typeof taskDeployments>

// A person who can see a project in the client portal: a current member with
// portal access at the project's client company (`client_portal_access`).
// `id` is their contact id; `project_id` is filled in per project, since
// access is granted per company, not per project.
export type ProjectMemberWithUser = {
  id: string
  project_id: string
  user_id: string
  created_at: string
  deleted_at: string | null
  user: DbUser
}

export type TaskWithRelations = DbTask & {
  assignees: { user_id: string }[]
  commentCount: number
  attachmentCount: number
  /**
   * Sum of every time log linked to this task. A log split across N tasks
   * counts its full hours toward each, matching the total the task sheet
   * already shows — so card and sheet never disagree.
   */
  loggedHours: number
  attachments?: DbTaskAttachment[]
  /** The lead the task is linked to, while that lead is live. */
  lead?: TaskLead | null
}

/** A lead as the task sheet's "Project or lead" picker lists it. */
export type TaskLeadOption = {
  id: string
  name: string
  companyName: string | null
  status: LeadStatusValue
}

/** A task's linked lead, as its card and sheet show it. */
export type TaskLead = {
  id: string
  name: string
  status: LeadStatusValue
  assigneeName: string | null
}
export type TaskCommentAuthor = {
  id: string
  full_name: string | null
  email: string | null
  avatar_url: string | null
}

export type TaskCommentWithAuthor = DbTaskComment & {
  author: TaskCommentAuthor | null
}

export type TimeLogWithUser = DbTimeLog & {
  user: DbUser | null
}

type ProjectBurndownSummary = {
  totalClientPurchasedHours: number
  totalClientLoggedHours: number
  totalClientRemainingHours: number
  totalProjectLoggedHours: number
  projectMonthToDateLoggedHours: number
  lastLogAt: string | null
}

import type { LeadStatusValue } from '@/lib/leads/constants'
import type { ProjectIntegrationLinkSummary } from '@/lib/types/integrations'

export type GitHubRepoLinkSummary = {
  id: string
  repoFullName: string
  defaultBranch: string
}

export type ProjectOwner = {
  id: string
  /** Their person record: the Owner link opens it. */
  contact_id: string | null
  full_name: string | null
  avatar_url: string | null
}

export type ProjectWithRelations = DbProject & {
  client: ClientCompanyView | null
  owner: ProjectOwner | null
  members: ProjectMemberWithUser[]
  tasks: TaskWithRelations[]
  archivedTasks: TaskWithRelations[]
  acceptedTasks: TaskWithRelations[]
  burndown: ProjectBurndownSummary
  githubRepos: GitHubRepoLinkSummary[]
  integrationLinks: ProjectIntegrationLinkSummary[]
}
