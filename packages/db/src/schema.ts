import {
  pgTable,
  index,
  foreignKey,
  unique,
  uuid,
  text,
  timestamp,
  bigint,
  check,
  numeric,
  uniqueIndex,
  date,
  smallint,
  jsonb,
  pgView,
  pgEnum,
  integer,
  primaryKey,
  boolean,
  varchar,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

// =============================================================================
// ENUMS
// =============================================================================

export const taskStatus = pgEnum('task_status', [
  'ON_DECK',
  'IN_PROGRESS',
  'BLOCKED',
  'DONE',
])
export const userRole = pgEnum('user_role', ['ADMIN', 'SALES', 'CLIENT'])
export const activitySource = pgEnum('activity_source', [
  'ADMIN_UI',
  'CLI',
  'MCP',
  'SYSTEM',
])
export const clientBillingType = pgEnum('client_billing_type', [
  'prepaid',
  'net_30',
])
export const projectType = pgEnum('project_type', [
  'CLIENT',
  'PERSONAL',
  'INTERNAL',
])
export const projectStatus = pgEnum('project_status', [
  'ONBOARDING',
  'ACTIVE',
  'ON_HOLD',
  'COMPLETED',
])
export const leadStatus = pgEnum('lead_status', [
  'NEW_OPPORTUNITIES',
  'ACTIVE_OPPORTUNITIES',
  'PROPOSAL_SENT',
  'ON_ICE',
  'CLOSED_WON',
  'CLOSED_LOST',
  'UNQUALIFIED',
])

/**
 * Lead source types.
 * - REFERRAL: Lead came from a referral
 * - WEBSITE: Lead came from the website contact form
 * - EVENT: Reserved for future use (conference, meetup, etc.)
 */
export const leadSourceType = pgEnum('lead_source_type', [
  'REFERRAL',
  'WEBSITE',
  'EVENT', // Reserved: for future event-based lead capture
])

// OAuth enums
export const oauthProvider = pgEnum('oauth_provider', [
  'GOOGLE',
  'GITHUB',
  'VERCEL',
  'SUPABASE',
])

/**
 * Hosting/infra providers a portal project can be linked to. Kept separate
 * from `oauth_provider` because not every OAuth provider hosts projects
 * (Google) and the link table should not accept them.
 */
export const integrationProvider = pgEnum('integration_provider', [
  'VERCEL',
  'SUPABASE',
])

/**
 * OAuth connection status values.
 * - ACTIVE: Connection is valid and tokens are working
 * - EXPIRED: Reserved for future use (currently tokens auto-refresh)
 * - REVOKED: Reserved for future use (currently we soft-delete on disconnect)
 * - PENDING_REAUTH: Reserved for future reauthorization flow
 */
export const oauthConnectionStatus = pgEnum('oauth_connection_status', [
  'ACTIVE',
  'EXPIRED', // Reserved: for explicit token expiry tracking
  'REVOKED', // Reserved: for explicit revocation tracking
  'PENDING_REAUTH', // Reserved: for future reauth prompt flow
])

// Invoice status
export const invoiceStatus = pgEnum('invoice_status', [
  'DRAFT',
  'SENT',
  'VIEWED',
  'PAID',
  'VOID',
])

// Lead loss reason
export const leadLossReason = pgEnum('lead_loss_reason', [
  'BUDGET',
  'TIMING',
  'COMPETITOR',
  'FIT',
  'GHOSTED',
  'OTHER',
])


/**
 * How a logged lead interaction happened.
 * Kept deliberately small at launch — see PRD 005 D3. TEXT_MESSAGE (SMS /
 * iMessage) was added Sep 2026; direction (inbound vs outbound) and
 * artifact-sent types are still deferred to PRD 005 §07.
 */
export const leadUpdateType = pgEnum('lead_update_type', [
  'MEETING',
  'PHONE_CALL',
  'TEXT_MESSAGE',
  'EMAIL',
  'NOTE',
])
export const clientUpdateStatus = pgEnum('client_update_status', [
  'DRAFT',
  'SENT',
])


export const workerStatus = pgEnum('worker_status', [
  'dispatched',
  'working',
  'plan_ready',
  'implementing',
  'pr_created',
  'done_no_changes',
  'error',
  'cancelled',
])

// =============================================================================
// CORE TABLES
// =============================================================================

export const users = pgTable(
  'users',
  {
    id: uuid().primaryKey().notNull(),
    /** The sign-in email (the auth provider's); the person's own email is on their contact. */
    email: text().notNull(),
    // A user is a person's sign-in. Their name is their contact's (0109
    // dropped users.full_name): read it with personNameSql (@pts/db/names).
    role: userRole().default('CLIENT').notNull(),
    avatarUrl: text('avatar_url'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
    // Blocks portal sign-in without archiving: the user stays in active lists
    // and historical reports, but auth rejects them while this is set.
    disabledAt: timestamp('disabled_at', { withTimezone: true, mode: 'string' }),
    onboardingCompletedAt: timestamp('onboarding_completed_at', {
      withTimezone: true,
      mode: 'string',
    }),
  },
  table => [unique('users_email_key').on(table.email)]
)

/**
 * An organization (sales CRM): prospects and customers alike. People belong
 * to it through `memberships` (one of them can be its primary contact) and
 * leads hang under it. A company you bill is a client: `client_since` is set,
 * and `client_ended_at` once billing stops (a former client). Everything
 * billed (projects, invoices, hours, terms, updates) keys on `company_id`.
 */
export const companies = pgTable(
  'companies',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    name: text().notNull(),
    website: text(),
    linkedinUrl: text('linkedin_url'),
    /** Rich text (TipTap HTML). */
    notes: text(),
    /** URL segment for its projects (`/projects/<slug>/…`); set once billed. */
    slug: text(),
    /** Two-letter US state for sales tax on invoices. */
    state: varchar({ length: 2 }),
    /** When it became a client; null for a company never billed. */
    clientSince: timestamp('client_since', {
      withTimezone: true,
      mode: 'string',
    }),
    /** When billing stopped (a former client); null while billed. */
    clientEndedAt: timestamp('client_ended_at', {
      withTimezone: true,
      mode: 'string',
    }),
    createdBy: uuid('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  table => [
    unique('companies_slug_key').on(table.slug),
    index('idx_companies_client')
      .on(table.id)
      .where(sql`(client_since IS NOT NULL AND client_ended_at IS NULL)`),
    // One live company per name (case-insensitive), so pickers and the lead
    // backfill can't fork "Lasso Group" into two records.
    uniqueIndex('idx_companies_name_unique')
      .using('btree', sql`lower(btrim(name))`)
      .where(sql`(deleted_at IS NULL)`),
    index('idx_companies_name_trgm').using('gin', table.name.op('gin_trgm_ops')),
    foreignKey({
      columns: [table.createdBy],
      foreignColumns: [users.id],
      name: 'companies_created_by_fkey',
    }),
  ]
)

export const contacts = pgTable(
  'contacts',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    /** Optional: a contact can be just a name (e.g. from a lead with no email). */
    email: text(),
    name: text().notNull(),
    phone: text(),
    linkedinUrl: text('linkedin_url'),
    /** Their photo: a path in the avatar bucket (anyone can have one). */
    avatarUrl: text('avatar_url'),
    createdBy: uuid('created_by'),
    userId: uuid('user_id'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  table => [
    unique('contacts_email_key').on(table.email),
    unique('contacts_user_id_key').on(table.userId),
    index('idx_contacts_email')
      .using('btree', table.email.asc().nullsLast().op('text_ops'))
      .where(sql`(deleted_at IS NULL)`),
    // Contacts settings and the command palette search with ILIKE '%…%'
    // over name and email.
    index('idx_contacts_name_trgm').using(
      'gin',
      table.name.op('gin_trgm_ops')
    ),
    index('idx_contacts_email_trgm').using(
      'gin',
      table.email.op('gin_trgm_ops')
    ),
    index('idx_contacts_email_domain')
      .using('btree', sql`split_part(email, '@', 2)`)
      .where(sql`(deleted_at IS NULL)`),
    index('idx_contacts_user_id')
      .using('btree', table.userId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(user_id IS NOT NULL)`),
    foreignKey({
      columns: [table.createdBy],
      foreignColumns: [users.id],
      name: 'contacts_created_by_fkey',
    }),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: 'contacts_user_id_fkey',
    }),
  ]
)

/**
 * A person at a company: their title there, whether they're the company's
 * primary contact and whether they can see its client in the client portal.
 * A person can belong to several companies (one current row per pair); the
 * oldest current one is their main company for list columns. Ending a
 * membership (`ended_at`) keeps the history. One current primary per
 * company. Portal access lives only here (see `clientPortalAccess`).
 */
export const memberships = pgTable(
  'memberships',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    contactId: uuid('contact_id').notNull(),
    companyId: uuid('company_id').notNull(),
    /** Job title at this company, e.g. "Head of Marketing". */
    title: text(),
    isPrimary: boolean('is_primary').default(false).notNull(),
    portalAccess: boolean('portal_access').default(false).notNull(),
    startedAt: timestamp('started_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true, mode: 'string' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
  },
  table => [
    uniqueIndex('memberships_one_current_per_contact_company')
      .on(table.contactId, table.companyId)
      .where(sql`(ended_at IS NULL)`),
    uniqueIndex('memberships_one_primary_per_company')
      .on(table.companyId)
      .where(sql`(is_primary AND ended_at IS NULL)`),
    index('idx_memberships_company_current')
      .on(table.companyId)
      .where(sql`(ended_at IS NULL)`),
    check(
      'memberships_ended_has_no_flags',
      sql`ended_at IS NULL OR (NOT is_primary AND NOT portal_access)`
    ),
    foreignKey({
      columns: [table.contactId],
      foreignColumns: [contacts.id],
      name: 'memberships_contact_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.companyId],
      foreignColumns: [companies.id],
      name: 'memberships_company_id_fkey',
    }).onDelete('cascade'),
  ]
)

export const projects = pgTable(
  'projects',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    companyId: uuid('company_id'),
    name: text().notNull(),
    status: projectStatus().default('ACTIVE').notNull(),
    startsOn: date('starts_on'),
    endsOn: date('ends_on'),
    createdBy: uuid('created_by'),
    ownerId: uuid('owner_id'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
    slug: text(),
    type: projectType('type').default('CLIENT').notNull(),
  },
  table => [
    index('idx_projects_company')
      .using('btree', table.companyId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL)`),
    // Every projects listing sorts by name; without this the full table is
    // sorted per request.
    index('idx_projects_name').using(
      'btree',
      table.name.asc().nullsLast().op('text_ops')
    ),
    // Landing/settings search runs ILIKE '%…%' over name and slug —
    // trigram GIN is the only index shape that serves infix matches.
    index('idx_projects_name_trgm').using(
      'gin',
      table.name.op('gin_trgm_ops')
    ),
    index('idx_projects_slug_trgm').using(
      'gin',
      table.slug.op('gin_trgm_ops')
    ),
    index('idx_projects_created_by')
      .using('btree', table.createdBy.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL)`),
    index('idx_projects_owner')
      .using('btree', table.ownerId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL AND owner_id IS NOT NULL)`),
    uniqueIndex('idx_projects_slug')
      .using('btree', table.slug.asc().nullsLast().op('text_ops'))
      .where(sql`(slug IS NOT NULL)`),
    foreignKey({
      columns: [table.companyId],
      foreignColumns: [companies.id],
      name: 'projects_company_id_fkey',
    }),
    foreignKey({
      columns: [table.createdBy],
      foreignColumns: [users.id],
      name: 'projects_created_by_fkey',
    }),
    foreignKey({
      columns: [table.ownerId],
      foreignColumns: [users.id],
      name: 'projects_owner_id_fkey',
    }),
    check(
      'projects_type_company_check',
      sql`(
        (type = 'CLIENT' AND company_id IS NOT NULL)
        OR (
          type IN ('PERSONAL', 'INTERNAL')
          AND company_id IS NULL
        )
      )`
    ),
  ]
)

/**
 * Staff who may see and work a project's tasks. Admins see every project
 * regardless; for everyone else (SALES today) membership is the only way in,
 * apart from their own PERSONAL boards.
 */
export const projectMembers = pgTable(
  'project_members',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    projectId: uuid('project_id').notNull(),
    userId: uuid('user_id').notNull(),
    createdBy: uuid('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  table => [
    unique('project_members_project_user_key').on(table.projectId, table.userId),
    index('idx_project_members_user')
      .using('btree', table.userId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL)`),
    foreignKey({
      columns: [table.projectId],
      foreignColumns: [projects.id],
      name: 'project_members_project_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: 'project_members_user_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.createdBy],
      foreignColumns: [users.id],
      name: 'project_members_created_by_fkey',
    }),
  ]
)

export const tasks = pgTable(
  'tasks',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    projectId: uuid('project_id').notNull(),
    leadId: uuid('lead_id'),
    title: text().notNull(),
    description: text(),
    status: taskStatus().default('ON_DECK').notNull(),
    dueOn: date('due_on'),
    createdBy: uuid('created_by'),
    updatedBy: uuid('updated_by'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
    acceptedAt: timestamp('accepted_at', {
      withTimezone: true,
      mode: 'string',
    }),
    // Stamped when a task enters DONE, cleared when it leaves. updated_at can't
    // stand in for this: any later edit to a finished task would bump it and
    // drag the task back into "completed recently" windows.
    completedAt: timestamp('completed_at', {
      withTimezone: true,
      mode: 'string',
    }),
    rank: text().default('zzzzzzzz').notNull(),
    githubIssueNumber: integer('github_issue_number'),
    githubIssueUrl: text('github_issue_url'),
    workerStatus: workerStatus('worker_status'),
  },
  table => [
    index('idx_tasks_created_by')
      .using('btree', table.createdBy.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL)`),
    index('idx_tasks_project')
      .using('btree', table.projectId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL)`),
    // Archived-task lookups (review/archive tabs) — the active-task partial
    // above can't serve deleted_at IS NOT NULL scans.
    index('idx_tasks_project_archived')
      .using('btree', table.projectId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NOT NULL)`),
    index('idx_tasks_project_status_rank').using(
      'btree',
      table.projectId.asc().nullsLast().op('uuid_ops'),
      table.status.asc().nullsLast().op('enum_ops'),
      table.rank.asc().nullsLast().op('text_ops')
    ),
    index('idx_tasks_status')
      .using('btree', table.status.asc().nullsLast().op('enum_ops'))
      .where(sql`(deleted_at IS NULL)`),
    index('idx_tasks_updated_by')
      .using('btree', table.updatedBy.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL)`),
    index('idx_tasks_lead')
      .using('btree', table.leadId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL AND lead_id IS NOT NULL)`),
    // Serves the My Tasks board's rolling "done in the last N weeks" window.
    index('idx_tasks_completed_at')
      .using('btree', table.completedAt.desc().nullsLast().op('timestamptz_ops'))
      .where(sql`(deleted_at IS NULL AND status = 'DONE'::task_status)`),
    foreignKey({
      columns: [table.projectId],
      foreignColumns: [projects.id],
      name: 'tasks_project_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.leadId],
      foreignColumns: [leads.id],
      name: 'tasks_lead_id_fkey',
    }).onDelete('set null'),
    foreignKey({
      columns: [table.createdBy],
      foreignColumns: [users.id],
      name: 'tasks_created_by_fkey',
    }),
    foreignKey({
      columns: [table.updatedBy],
      foreignColumns: [users.id],
      name: 'tasks_updated_by_fkey',
    }),
  ]
)

export const taskAssignees = pgTable(
  'task_assignees',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedByDefaultAsIdentity({
      name: 'task_assignees_id_seq',
      startWith: 1,
      increment: 1,
      minValue: 1,
      maxValue: 9223372036854775807,
      cache: 1,
    }),
    taskId: uuid('task_id').notNull(),
    userId: uuid('user_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  table => [
    index('idx_task_assignees_user')
      .using('btree', table.userId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL)`),
    foreignKey({
      columns: [table.taskId],
      foreignColumns: [tasks.id],
      name: 'task_assignees_task_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: 'task_assignees_user_id_fkey',
    }).onDelete('cascade'),
    unique('task_assignees_task_id_user_id_key').on(table.taskId, table.userId),
    // A task has one (current) assignee (0103).
    uniqueIndex('task_assignees_one_current_per_task')
      .on(table.taskId)
      .where(sql`(deleted_at IS NULL)`),
  ]
)

export const taskAssigneeMetadata = pgTable(
  'task_assignee_metadata',
  {
    taskId: uuid('task_id').notNull(),
    userId: uuid('user_id').notNull(),
    sortOrder: integer('sort_order').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  table => [
    index('idx_task_assignee_metadata_user')
      .using('btree', table.userId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL)`),
    foreignKey({
      columns: [table.taskId],
      foreignColumns: [tasks.id],
      name: 'task_assignee_metadata_task_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: 'task_assignee_metadata_user_id_fkey',
    }).onDelete('cascade'),
    primaryKey({
      name: 'task_assignee_metadata_pkey',
      columns: [table.taskId, table.userId],
    }),
  ]
)

export const taskComments = pgTable(
  'task_comments',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    taskId: uuid('task_id').notNull(),
    authorId: uuid('author_id').notNull(),
    body: text().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  table => [
    index('idx_task_comments_author_id')
      .using('btree', table.authorId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL)`),
    index('idx_task_comments_task')
      .using('btree', table.taskId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL)`),
    foreignKey({
      columns: [table.taskId],
      foreignColumns: [tasks.id],
      name: 'task_comments_task_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.authorId],
      foreignColumns: [users.id],
      name: 'task_comments_author_id_fkey',
    }).onDelete('cascade'),
  ]
)

export const taskAttachments = pgTable(
  'task_attachments',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    taskId: uuid('task_id').notNull(),
    storagePath: text('storage_path').notNull(),
    originalName: text('original_name').notNull(),
    mimeType: text('mime_type').notNull(),
    fileSize: bigint('file_size', { mode: 'number' }).notNull(),
    uploadedBy: uuid('uploaded_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  table => [
    index('idx_task_attachments_task')
      .using('btree', table.taskId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL)`),
    index('idx_task_attachments_uploaded_by')
      .using('btree', table.uploadedBy.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL)`),
    foreignKey({
      columns: [table.taskId],
      foreignColumns: [tasks.id],
      name: 'task_attachments_task_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.uploadedBy],
      foreignColumns: [users.id],
      name: 'task_attachments_uploaded_by_fkey',
    }).onDelete('cascade'),
  ]
)

export const hourBlocks = pgTable(
  'hour_blocks',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    hoursPurchased: numeric('hours_purchased', {
      precision: 6,
      scale: 2,
    }).notNull(),
    createdBy: uuid('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
    companyId: uuid('company_id').notNull(),
    /**
     * The invoice line that created this block (blocks made by hand have
     * none). Its invoice is read through the line (0108 dropped the copied
     * invoice_id).
     */
    invoiceLineItemId: uuid('invoice_line_item_id'),
    notes: text('notes'),
    /**
     * Month this block's hours are billed in (always the 1st). Defaults to the
     * creation month but is clamped forward to the client's first prepaid
     * month when the block is created before a billing-type cutover — a block
     * attributed to a net_30-resolving month would never count in Billing In.
     */
    billingMonth: date('billing_month').notNull(),
  },
  table => [
    index('idx_hour_blocks_billing_month')
      .using('btree', table.billingMonth.asc())
      .where(sql`(deleted_at IS NULL)`),
    index('idx_hour_blocks_company_id')
      .using('btree', table.companyId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL)`),
    index('idx_hour_blocks_created_by')
      .using('btree', table.createdBy.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL)`),
    uniqueIndex('idx_hour_blocks_invoice_line_item_unique')
      .on(table.invoiceLineItemId)
      .where(sql`(deleted_at IS NULL AND invoice_line_item_id IS NOT NULL)`),
    foreignKey({
      columns: [table.createdBy],
      foreignColumns: [users.id],
      name: 'hour_blocks_created_by_fkey',
    }),
    foreignKey({
      columns: [table.companyId],
      foreignColumns: [companies.id],
      name: 'hour_blocks_company_id_fkey',
    }).onDelete('cascade'),
    check(
      'chk_hour_blocks_billing_month_month_start',
      sql`billing_month = date_trunc('month', billing_month)::date`
    ),
    // Note: FK constraint for
    // invoiceLineItemId -> invoice_line_items.id added in migration
    // to avoid forward reference (invoices table defined later in this file)
  ]
)

export const monthlyCloseSnapshots = pgTable(
  'monthly_close_snapshots',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    year: integer().notNull(),
    month: integer().notNull(), // 1-indexed (1 = January)
    /** Fully assembled MonthlyCloseReport wrapped as { schemaVersion, report }. */
    report: jsonb().notNull(),
    /**
     * Cutoff captured BEFORE report derivation, so any record committed after
     * it is by definition detectable as late (created_at > closed_at).
     */
    closedAt: timestamp('closed_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    closedBy: uuid('closed_by'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  table => [
    // One ACTIVE close per month; reopen soft-deletes, re-close inserts.
    uniqueIndex('uq_monthly_close_snapshots_period')
      .on(table.year, table.month)
      .where(sql`(deleted_at IS NULL)`),
    foreignKey({
      columns: [table.closedBy],
      foreignColumns: [users.id],
      name: 'monthly_close_snapshots_closed_by_fkey',
    }).onDelete('set null'),
    check(
      'chk_monthly_close_snapshots_month_range',
      sql`month BETWEEN 1 AND 12`
    ),
  ]
)

export const billingTerms = pgTable(
  'billing_terms',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    companyId: uuid('company_id').notNull(),
    billingType: clientBillingType('billing_type').notNull(),
    /** First day of the month this billing type takes effect (month-start CHECK). */
    effectiveFrom: date('effective_from').notNull(),
    createdBy: uuid('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  table => [
    // One active term per client per boundary; re-editing a boundary upserts.
    uniqueIndex('uq_billing_terms_company_effective')
      .on(table.companyId, table.effectiveFrom)
      .where(sql`(deleted_at IS NULL)`),
    // Resolution path: latest effective_from <= period start for a client.
    index('idx_billing_terms_resolution')
      .using('btree', table.companyId.asc(), table.effectiveFrom.desc())
      .where(sql`(deleted_at IS NULL)`),
    foreignKey({
      columns: [table.companyId],
      foreignColumns: [companies.id],
      name: 'billing_terms_company_id_fkey',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.createdBy],
      foreignColumns: [users.id],
      name: 'billing_terms_created_by_fkey',
    }).onDelete('set null'),
    check(
      'chk_billing_terms_month_start',
      sql`effective_from = date_trunc('month', effective_from)::date`
    ),
  ]
)

export const commissionTerms = pgTable(
  'commission_terms',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    companyId: uuid('company_id').notNull(),
    /** First day of the month this commission split takes effect (month-start CHECK). */
    effectiveFrom: date('effective_from').notNull(),
    // Closers (20%, split by percentage) are child rows in
    // `client_commission_term_closers`. No rows means no closer for the
    // period: the share is not paid and is reported under House (estimated).
    /** Origination (10%): at most ONE of user / contact per the mutex CHECK. */
    originationUserId: uuid('origination_user_id'),
    originationContactId: uuid('origination_contact_id'),
    createdBy: uuid('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  table => [
    // One active term per client per boundary; re-editing a boundary upserts.
    uniqueIndex('uq_commission_terms_company_effective')
      .on(table.companyId, table.effectiveFrom)
      .where(sql`(deleted_at IS NULL)`),
    // Resolution path: latest effective_from <= period start for a client.
    index('idx_commission_terms_resolution')
      .using('btree', table.companyId.asc(), table.effectiveFrom.desc())
      .where(sql`(deleted_at IS NULL)`),
    foreignKey({
      columns: [table.companyId],
      foreignColumns: [companies.id],
      name: 'commission_terms_company_id_fkey',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.originationUserId],
      foreignColumns: [users.id],
      name: 'commission_terms_origination_user_id_fkey',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.originationContactId],
      foreignColumns: [contacts.id],
      name: 'commission_terms_origination_contact_id_fkey',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.createdBy],
      foreignColumns: [users.id],
      name: 'commission_terms_created_by_fkey',
    }).onDelete('set null'),
    check(
      'chk_commission_terms_month_start',
      sql`effective_from = date_trunc('month', effective_from)::date`
    ),
    check(
      'chk_commission_terms_origination_mutex',
      sql`NOT (origination_user_id IS NOT NULL AND origination_contact_id IS NOT NULL)`
    ),
  ]
)

/**
 * One closer's share of a commission term's closer pool. A term has zero or
 * more closers whose `share_percent` totals 100 (enforced in the app layer —
 * a cross-row sum can't be a CHECK). Each row is an admin user OR a contact
 * (mutex CHECK): an insider at the client can help close a deal too. Rows are
 * replaced as a set when a term's split is re-edited (old rows soft-deleted).
 */
export const commissionTermClosers = pgTable(
  'commission_term_closers',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    termId: uuid('term_id').notNull(),
    closerUserId: uuid('closer_user_id'),
    closerContactId: uuid('closer_contact_id'),
    /** Share of the closer rate, 0 < share <= 100. */
    sharePercent: numeric('share_percent', { precision: 5, scale: 2 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  table => [
    index('idx_commission_term_closers_term')
      .using('btree', table.termId.asc())
      .where(sql`(deleted_at IS NULL)`),
    uniqueIndex('uq_commission_term_closers_user')
      .on(table.termId, table.closerUserId)
      .where(sql`(deleted_at IS NULL AND closer_user_id IS NOT NULL)`),
    uniqueIndex('uq_commission_term_closers_contact')
      .on(table.termId, table.closerContactId)
      .where(sql`(deleted_at IS NULL AND closer_contact_id IS NOT NULL)`),
    foreignKey({
      columns: [table.termId],
      foreignColumns: [commissionTerms.id],
      name: 'commission_term_closers_term_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.closerUserId],
      foreignColumns: [users.id],
      name: 'commission_term_closers_closer_user_id_fkey',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.closerContactId],
      foreignColumns: [contacts.id],
      name: 'commission_term_closers_closer_contact_id_fkey',
    }).onDelete('restrict'),
    check(
      'chk_commission_term_closers_one_party',
      sql`(closer_user_id IS NULL) <> (closer_contact_id IS NULL)`
    ),
    check(
      'chk_commission_term_closers_share',
      sql`share_percent > 0 AND share_percent <= 100`
    ),
  ]
)

export const timeLogs = pgTable(
  'time_logs',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    projectId: uuid('project_id').notNull(),
    userId: uuid('user_id').notNull(),
    hours: numeric({ precision: 8, scale: 2 }).notNull(),
    loggedOn: date('logged_on')
      .default(sql`timezone('utc'::text, now())::date`)
      .notNull(),
    note: text(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  table => [
    index('idx_time_logs_project')
      .using('btree', table.projectId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL)`),
    index('idx_time_logs_user_id')
      .using('btree', table.userId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL)`),
    // Every hours aggregate (client burndown, dashboard snapshot, monthly
    // close) filters live logs by logged_on, alone or per project.
    index('idx_time_logs_logged_on')
      .using('btree', table.loggedOn.asc().nullsLast())
      .where(sql`(deleted_at IS NULL)`),
    index('idx_time_logs_project_logged_on')
      .using(
        'btree',
        table.projectId.asc().nullsLast().op('uuid_ops'),
        table.loggedOn.asc().nullsLast()
      )
      .where(sql`(deleted_at IS NULL)`),
    foreignKey({
      columns: [table.projectId],
      foreignColumns: [projects.id],
      name: 'time_logs_project_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: 'time_logs_user_id_fkey',
    }).onDelete('cascade'),
    check('time_logs_hours_check', sql`hours > (0)::numeric`),
  ]
)

export const timeLogTasks = pgTable(
  'time_log_tasks',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    timeLogId: uuid('time_log_id').notNull(),
    taskId: uuid('task_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  table => [
    index('idx_time_log_tasks_task_id')
      .using('btree', table.taskId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL)`),
    uniqueIndex('idx_time_log_tasks_unique')
      .using(
        'btree',
        table.timeLogId.asc().nullsLast().op('uuid_ops'),
        table.taskId.asc().nullsLast().op('uuid_ops')
      )
      .where(sql`(deleted_at IS NULL)`),
    foreignKey({
      columns: [table.timeLogId],
      foreignColumns: [timeLogs.id],
      name: 'time_log_tasks_time_log_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.taskId],
      foreignColumns: [tasks.id],
      name: 'time_log_tasks_task_id_fkey',
    }).onDelete('cascade'),
    check(
      'time_log_tasks_project_match',
      sql`CHECK (time_log_task_matches_project(time_log_id, task_id))`
    ),
  ]
)

export const leads = pgTable(
  'leads',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    status: leadStatus().default('NEW_OPPORTUNITIES').notNull(),
    sourceType: leadSourceType('source_type'),
    sourceDetail: text('source_detail'),
    assigneeId: uuid('assignee_id'),
    /** The lead's company (optional: a lead can be just a person). */
    companyId: uuid('company_id'),
    /** The lead's person; their name, email and phone are read from it. */
    contactId: uuid('contact_id').notNull(),
    notes: jsonb('notes').default({}).notNull(),
    rank: text().default('zzzzzzzz').notNull(),

    // Activity Tracking
    lastContactAt: timestamp('last_contact_at', { withTimezone: true, mode: 'string' }),
    awaitingReply: boolean('awaiting_reply').default(false),

    // Predictions
    expectedCloseDate: date('expected_close_date'),

    // Pipeline tracking
    resolvedAt: timestamp('resolved_at', { withTimezone: true, mode: 'string' }),
    lossReason: leadLossReason('loss_reason'),
    lossNotes: text('loss_notes'),
    currentStageEnteredAt: timestamp('current_stage_entered_at', { withTimezone: true, mode: 'string' }),

    // Conversion
    convertedAt: timestamp('converted_at', { withTimezone: true, mode: 'string' }),

    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  table => [
    index('idx_leads_status')
      .using('btree', table.status.asc().nullsLast().op('enum_ops'))
      .where(sql`(deleted_at IS NULL)`),
    index('idx_leads_assignee')
      .using('btree', table.assigneeId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL)`),
    // One person per email is the contacts table's job now (a contact can
    // have several leads), so live leads no longer need unique emails.
    foreignKey({
      columns: [table.assigneeId],
      foreignColumns: [users.id],
      name: 'leads_assignee_id_fkey',
    }),
    index('idx_leads_company')
      .using('btree', table.companyId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL AND company_id IS NOT NULL)`),
    foreignKey({
      columns: [table.companyId],
      foreignColumns: [companies.id],
      name: 'leads_company_id_fkey',
    }).onDelete('set null'),
    index('idx_leads_contact')
      .using('btree', table.contactId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL AND contact_id IS NOT NULL)`),
    foreignKey({
      columns: [table.contactId],
      foreignColumns: [contacts.id],
      name: 'leads_contact_id_fkey',
    }).onDelete('restrict'),
  ]
)

export const leadStageHistory = pgTable(
  'lead_stage_history',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    leadId: uuid('lead_id').notNull(),
    fromStatus: leadStatus('from_status'),
    toStatus: leadStatus('to_status').notNull(),
    changedAt: timestamp('changed_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    changedBy: uuid('changed_by'),
  },
  table => [
    index('idx_lead_stage_history_lead')
      .using('btree', table.leadId.asc().nullsLast().op('uuid_ops')),
    index('idx_lead_stage_history_changed_at')
      .using('btree', table.changedAt.asc().nullsLast()),
    foreignKey({
      columns: [table.leadId],
      foreignColumns: [leads.id],
      name: 'lead_stage_history_lead_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.changedBy],
      foreignColumns: [users.id],
      name: 'lead_stage_history_changed_by_fkey',
    }),
  ]
)

export const leadUpdates = pgTable(
  'lead_updates',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    leadId: uuid('lead_id').notNull(),
    type: leadUpdateType().notNull(),
    /**
     * The interaction's description, as TipTap HTML — the same convention as
     * `task_comments`: the dialog sanitizes before send and the timeline
     * renderer sanitizes again before injecting. Rows written before the RTE
     * landed hold plain text, which renders unchanged.
     */
    body: text().notNull(),
    /**
     * When the interaction actually happened — NOT when the row was written.
     * Cadence math uses this; created_at would measure data-entry lag instead.
     * Defaults to now() so quick same-day logging needs no extra input.
     */
    occurredAt: timestamp('occurred_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    authorId: uuid('author_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  table => [
    // Serves both the timeline render (ordered by occurred_at desc) and the
    // derived last-touch aggregate in §03. Partial on deleted_at IS NULL, so
    // soft-deleted rows are excluded by the index itself rather than filtered
    // after the fact.
    index('idx_lead_updates_lead_occurred')
      .using(
        'btree',
        table.leadId.asc().nullsLast().op('uuid_ops'),
        table.occurredAt.desc().nullsLast().op('timestamptz_ops')
      )
      .where(sql`(deleted_at IS NULL)`),
    index('idx_lead_updates_author')
      .using('btree', table.authorId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL)`),
    foreignKey({
      columns: [table.leadId],
      foreignColumns: [leads.id],
      name: 'lead_updates_lead_id_fkey',
    }).onDelete('cascade'),
    // RESTRICT, not CASCADE: an update is an audit record of who contacted
    // whom, and users are disabled (`disabled_at`) rather than deleted in this
    // codebase. Deliberately stricter than task_comments — see PRD 005 W2.
    foreignKey({
      columns: [table.authorId],
      foreignColumns: [users.id],
      name: 'lead_updates_author_id_fkey',
    }).onDelete('restrict'),
  ]
)

/**
 * A client-facing status email, drafted in the portal and sent through the
 * admin's own Gmail. The draft is the row itself — Gmail is only touched at
 * send time — and the email is rendered from `items` plus a generated frame
 * (greeting, hours balance, footer) rather than stored as HTML.
 */
export const clientUpdates = pgTable(
  'client_updates',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    companyId: uuid('company_id').notNull(),
    status: clientUpdateStatus().default('DRAFT').notNull(),
    subject: text().notNull(),
    /** Opening line under the greeting. The greeting itself is derived at render. */
    intro: text().default('').notNull(),
    /**
     * The substance: one entry per thing we want to tell the client, usually
     * anchored to a task so the email can link to it in the client portal.
     * `ClientUpdateItem[]` — `{ id, taskId, label, body }`, body in the
     * minimal markdown `lib/updates/markdown.ts` accepts.
     */
    items: jsonb().default([]).notNull(),
    /** Sign-off line(s) above the branded footer. */
    closing: text().default('').notNull(),
    /**
     * The reporting window the scaffold was generated from. Informational —
     * editing items does not move these — but the next draft for the same
     * client starts the day after the last sent `period_end`.
     */
    periodStart: date('period_start').notNull(),
    periodEnd: date('period_end').notNull(),
    /** `{ to: string[]; cc: string[] }` — email addresses, resolved at draft time. */
    recipients: jsonb().default({ to: [], cc: [] }).notNull(),
    createdById: uuid('created_by_id').notNull(),
    sentById: uuid('sent_by_id'),
    sentAt: timestamp('sent_at', { withTimezone: true, mode: 'string' }),
    gmailMessageId: text('gmail_message_id'),
    gmailThreadId: text('gmail_thread_id'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  table => [
    // Serves the client page's recent-updates list and the "last sent" lookup
    // that seeds the next draft's window.
    index('idx_client_updates_company_created')
      .using(
        'btree',
        table.companyId.asc().nullsLast().op('uuid_ops'),
        table.createdAt.desc().nullsLast().op('timestamptz_ops')
      )
      .where(sql`(deleted_at IS NULL)`),
    foreignKey({
      columns: [table.companyId],
      foreignColumns: [companies.id],
      name: 'client_updates_company_id_fkey',
    }).onDelete('cascade'),
    // RESTRICT for the same reason as lead_updates: a sent update is a record
    // of who told the client what, and users are disabled rather than deleted.
    foreignKey({
      columns: [table.createdById],
      foreignColumns: [users.id],
      name: 'client_updates_created_by_id_fkey',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.sentById],
      foreignColumns: [users.id],
      name: 'client_updates_sent_by_id_fkey',
    }).onDelete('restrict'),
  ]
)

export const activityLogs = pgTable(
  'activity_logs',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    actorId: uuid('actor_id'),
    actorRole: userRole('actor_role'),
    source: activitySource('source').default('ADMIN_UI').notNull(),
    verb: text().notNull(),
    summary: text().notNull(),
    targetType: text('target_type').notNull(),
    targetId: uuid('target_id'),
    targetCompanyId: uuid('target_company_id'),
    targetProjectId: uuid('target_project_id'),
    contextRoute: text('context_route'),
    metadata: jsonb().default({}).notNull(),
    // Append-only: rows are never updated or soft-deleted, only pruned by the
    // retention cron, so there is no updated_at / deleted_at pair here.
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
  },
  table => [
    index('idx_activity_logs_created_at').using(
      'btree',
      table.createdAt.desc().nullsFirst().op('timestamptz_ops')
    ),
    // Global per-entity feeds (/projects/activity, /clients/activity, …)
    // filter on target_type alone and page by created_at.
    index('idx_activity_logs_type_created_at').using(
      'btree',
      table.targetType.asc().nullsLast().op('text_ops'),
      table.createdAt.desc().nullsFirst().op('timestamptz_ops')
    ),
    index('idx_activity_logs_project').using(
      'btree',
      table.targetProjectId.asc().nullsLast().op('uuid_ops'),
      table.createdAt.desc().nullsFirst().op('timestamptz_ops')
    ),
    index('idx_activity_logs_target').using(
      'btree',
      table.targetType.asc().nullsLast().op('text_ops'),
      table.targetId.asc().nullsLast().op('uuid_ops')
    ),
    foreignKey({
      columns: [table.actorId],
      foreignColumns: [users.id],
      name: 'activity_logs_actor_id_fkey',
    }).onDelete('cascade'),
  ]
)

export const activityOverviewCache = pgTable(
  'activity_overview_cache',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    userId: uuid('user_id').notNull(),
    timeframeDays: smallint('timeframe_days').notNull(),
    summary: jsonb().notNull(),
    cachedAt: timestamp('cached_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    expiresAt: timestamp('expires_at', {
      withTimezone: true,
      mode: 'string',
    }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
  },
  table => [
    uniqueIndex('activity_overview_cache_user_timeframe_idx').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
      table.timeframeDays.asc().nullsLast().op('int2_ops')
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: 'activity_overview_cache_user_id_fkey',
    }).onDelete('cascade'),
    check(
      'activity_overview_cache_timeframe_days_check',
      sql`timeframe_days = ANY (ARRAY[1, 7, 14, 28])`
    ),
  ]
)

// =============================================================================
// OAUTH CONNECTIONS
// =============================================================================

export const oauthConnections = pgTable(
  'oauth_connections',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    userId: uuid('user_id').notNull(),
    provider: oauthProvider().notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    accessToken: text('access_token').notNull(),
    refreshToken: text('refresh_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', {
      withTimezone: true,
      mode: 'string',
    }),
    scopes: text('scopes').array().notNull(),
    status: oauthConnectionStatus().default('ACTIVE').notNull(),
    providerEmail: text('provider_email'),
    displayName: text('display_name'),
    providerMetadata: jsonb('provider_metadata').default({}).notNull(),
    syncState: jsonb('sync_state').default({}).notNull(), // Provider-specific sync checkpoint (e.g., Gmail historyId)
    lastSyncAt: timestamp('last_sync_at', { withTimezone: true, mode: 'string' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  table => [
    unique('oauth_connections_user_provider_account_key').on(
      table.userId,
      table.provider,
      table.providerAccountId
    ),
    index('idx_oauth_connections_user')
      .using('btree', table.userId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL)`),
    index('idx_oauth_connections_provider')
      .using('btree', table.provider.asc().nullsLast())
      .where(sql`(deleted_at IS NULL AND status = 'ACTIVE')`),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: 'oauth_connections_user_id_fkey',
    }).onDelete('cascade'),
  ]
)

// =============================================================================
// GITHUB INTEGRATION
// =============================================================================

export const githubAppInstallationStatus = pgEnum(
  'github_app_installation_status',
  ['ACTIVE', 'SUSPENDED', 'REMOVED']
)

export const githubAppInstallations = pgTable(
  'github_app_installations',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    companyId: uuid('company_id').notNull(),
    installedByUserId: uuid('installed_by_user_id').notNull(),
    installationId: bigint('installation_id', { mode: 'number' }).notNull(),
    accountLogin: text('account_login').notNull(),
    accountId: bigint('account_id', { mode: 'number' }).notNull(),
    accountType: text('account_type').notNull(), // 'Organization' | 'User'
    accountAvatarUrl: text('account_avatar_url'),
    repositorySelection: text('repository_selection').notNull(), // 'all' | 'selected'
    status: githubAppInstallationStatus().default('ACTIVE').notNull(),
    permissions: jsonb().default({}).notNull(),
    events: text().array().default([]).notNull(),
    suspendedAt: timestamp('suspended_at', {
      withTimezone: true,
      mode: 'string',
    }),
    // Set when a live GitHub check last confirmed this installation still
    // exists — distinct from updatedAt, which changes on any field edit
    // (including webhook-driven metadata refreshes that aren't a liveness
    // check). Null means never verified.
    lastVerifiedAt: timestamp('last_verified_at', {
      withTimezone: true,
      mode: 'string',
    }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  table => [
    unique('github_app_installations_installation_id_key').on(
      table.installationId
    ),
    index('idx_github_app_installations_company')
      .using('btree', table.companyId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL)`),
    index('idx_github_app_installations_status')
      .using('btree', table.status.asc().nullsLast())
      .where(sql`(deleted_at IS NULL)`),
    foreignKey({
      columns: [table.companyId],
      foreignColumns: [companies.id],
      name: 'github_app_installations_company_id_fkey',
    }),
    foreignKey({
      columns: [table.installedByUserId],
      foreignColumns: [users.id],
      name: 'github_app_installations_installed_by_user_id_fkey',
    }),
  ]
)

export const githubRepoLinks = pgTable(
  'github_repo_links',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    projectId: uuid('project_id').notNull(),
    oauthConnectionId: uuid('oauth_connection_id'),
    githubAppInstallationId: uuid('github_app_installation_id'),
    repoOwner: text('repo_owner').notNull(),
    repoName: text('repo_name').notNull(),
    repoFullName: text('repo_full_name').notNull(),
    repoId: bigint('repo_id', { mode: 'number' }).notNull(),
    defaultBranch: text('default_branch').default('main').notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    linkedBy: uuid('linked_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  table => [
    unique('github_repo_links_project_repo_key').on(table.projectId, table.repoFullName),
    index('idx_github_repo_links_project')
      .using('btree', table.projectId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL)`),
    index('idx_github_repo_links_repo')
      .using('btree', table.repoFullName.asc().nullsLast().op('text_ops'))
      .where(sql`(deleted_at IS NULL)`),
    index('idx_github_repo_links_oauth')
      .using('btree', table.oauthConnectionId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL AND oauth_connection_id IS NOT NULL)`),
    index('idx_github_repo_links_installation')
      .using(
        'btree',
        table.githubAppInstallationId.asc().nullsLast().op('uuid_ops')
      )
      .where(
        sql`(deleted_at IS NULL AND github_app_installation_id IS NOT NULL)`
      ),
    foreignKey({
      columns: [table.projectId],
      foreignColumns: [projects.id],
      name: 'github_repo_links_project_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.oauthConnectionId],
      foreignColumns: [oauthConnections.id],
      name: 'github_repo_links_oauth_connection_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.githubAppInstallationId],
      foreignColumns: [githubAppInstallations.id],
      name: 'github_repo_links_github_app_installation_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.linkedBy],
      foreignColumns: [users.id],
      name: 'github_repo_links_linked_by_fkey',
    }),
    check(
      'github_repo_links_auth_source_check',
      sql`(
        (oauth_connection_id IS NOT NULL AND github_app_installation_id IS NULL)
        OR (oauth_connection_id IS NULL AND github_app_installation_id IS NOT NULL)
      )`
    ),
  ]
)

// =============================================================================
// PROJECT INTEGRATION LINKS (Vercel / Supabase projects tagged onto projects)
// =============================================================================

/**
 * A portal project's link to an external hosting project (a Vercel project,
 * a Supabase project). Rows store only external identifiers, never the
 * credential used to find them: staff members' personal tokens reach
 * different sets of teams/orgs, so access is resolved per viewer at read
 * time rather than pinned to whoever created the link.
 */
export const projectIntegrationLinks = pgTable(
  'project_integration_links',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    projectId: uuid('project_id').notNull(),
    provider: integrationProvider().notNull(),
    // Vercel: project id (prj_…). Supabase: project ref.
    externalId: text('external_id').notNull(),
    externalName: text('external_name').notNull(),
    // Vercel: team id (null for a personal scope). Supabase: organization id.
    ownerId: text('owner_id'),
    ownerSlug: text('owner_slug'),
    ownerName: text('owner_name'),
    url: text().notNull(),
    // Provider-specific extras (framework, region, repo, production domain).
    metadata: jsonb().default({}).notNull(),
    linkedBy: uuid('linked_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  table => [
    unique('project_integration_links_project_provider_external_key').on(
      table.projectId,
      table.provider,
      table.externalId
    ),
    index('idx_project_integration_links_project')
      .using('btree', table.projectId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL)`),
    index('idx_project_integration_links_external')
      .using(
        'btree',
        table.provider.asc().nullsLast(),
        table.externalId.asc().nullsLast().op('text_ops')
      )
      .where(sql`(deleted_at IS NULL)`),
    foreignKey({
      columns: [table.projectId],
      foreignColumns: [projects.id],
      name: 'project_integration_links_project_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.linkedBy],
      foreignColumns: [users.id],
      name: 'project_integration_links_linked_by_fkey',
    }),
  ]
)

// =============================================================================
// TASK DEPLOYMENTS (GitHub issue-based worker deployments per task)
// =============================================================================

export const taskDeployments = pgTable(
  'task_deployments',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    taskId: uuid('task_id').notNull(),
    repoLinkId: uuid('repo_link_id').notNull(),
    githubIssueNumber: integer('github_issue_number').notNull(),
    githubIssueUrl: text('github_issue_url').notNull(),
    workerStatus: workerStatus('worker_status').notNull(),
    prUrl: text('pr_url'),
    planId: text('plan_id').notNull(),
    planThreadId: uuid('plan_thread_id'),
    planVersion: integer('plan_version'),
    model: text(),
    mode: text(),
    createdBy: uuid('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
  },
  table => [
    uniqueIndex('idx_task_deployments_plan_id')
      .using('btree', table.planId.asc().nullsLast().op('text_ops')),
    index('idx_task_deployments_task')
      .using('btree', table.taskId.asc().nullsLast().op('uuid_ops')),
    foreignKey({
      columns: [table.taskId],
      foreignColumns: [tasks.id],
      name: 'task_deployments_task_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.repoLinkId],
      foreignColumns: [githubRepoLinks.id],
      name: 'task_deployments_repo_link_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.createdBy],
      foreignColumns: [users.id],
      name: 'task_deployments_created_by_fkey',
    }),
  ]
)

// =============================================================================
// AI PLANNING SESSIONS
// =============================================================================

export const planningSessionStatus = pgEnum('planning_session_status', [
  'active',
  'deployed',
])

export const planThreadGenerationStatus = pgEnum('plan_thread_generation_status', [
  'idle',
  'streaming',
  'error',
])

export const planningSessions = pgTable(
  'planning_sessions',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    taskId: uuid('task_id').notNull(),
    repoLinkId: uuid('repo_link_id').notNull(),
    status: planningSessionStatus().default('active').notNull(),
    createdBy: uuid('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
  },
  table => [
    index('idx_planning_sessions_task')
      .using('btree', table.taskId.asc().nullsLast().op('uuid_ops')),
    foreignKey({
      columns: [table.taskId],
      foreignColumns: [tasks.id],
      name: 'planning_sessions_task_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.repoLinkId],
      foreignColumns: [githubRepoLinks.id],
      name: 'planning_sessions_repo_link_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.createdBy],
      foreignColumns: [users.id],
      name: 'planning_sessions_created_by_fkey',
    }),
  ]
)

export const planThreads = pgTable(
  'plan_threads',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    sessionId: uuid('session_id').notNull(),
    model: text().notNull(),
    modelLabel: text('model_label').notNull(),
    currentVersion: integer('current_version').default(0).notNull(),
    generationStatus: planThreadGenerationStatus('generation_status')
      .default('idle')
      .notNull(),
    generatingVersion: integer('generating_version'),
    partialContent: text('partial_content'),
    generationError: text('generation_error'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
  },
  table => [
    index('idx_plan_threads_session')
      .using('btree', table.sessionId.asc().nullsLast().op('uuid_ops')),
    foreignKey({
      columns: [table.sessionId],
      foreignColumns: [planningSessions.id],
      name: 'plan_threads_session_id_fkey',
    }).onDelete('cascade'),
  ]
)

export const planRevisions = pgTable(
  'plan_revisions',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    threadId: uuid('thread_id').notNull(),
    version: integer().notNull(),
    content: text().notNull(),
    feedback: text(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
  },
  table => [
    index('idx_plan_revisions_thread')
      .using('btree', table.threadId.asc().nullsLast().op('uuid_ops')),
    unique('plan_revisions_thread_version_key').on(table.threadId, table.version),
    foreignKey({
      columns: [table.threadId],
      foreignColumns: [planThreads.id],
      name: 'plan_revisions_thread_id_fkey',
    }).onDelete('cascade'),
  ]
)

export const planMessages = pgTable(
  'plan_messages',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    threadId: uuid('thread_id').notNull(),
    role: text().notNull(),
    content: text().notNull(),
    metadata: jsonb(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
  },
  table => [
    index('idx_plan_messages_thread')
      .using('btree', table.threadId.asc().nullsLast().op('uuid_ops'), table.createdAt.asc().nullsLast()),
    foreignKey({
      columns: [table.threadId],
      foreignColumns: [planThreads.id],
      name: 'plan_messages_thread_id_fkey',
    }).onDelete('cascade'),
  ]
)

// =============================================================================
// INVOICING (Product Catalog, Invoices, Line Items)
// =============================================================================

export const productCatalogItems = pgTable(
  'product_catalog_items',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    name: text().notNull(),
    description: text(),
    unitPrice: numeric('unit_price', { precision: 12, scale: 2 }).notNull(),
    unitLabel: text('unit_label').notNull().default('unit'),
    createsHourBlockDefault: boolean('creates_hour_block_default')
      .notNull()
      .default(false),
    isActive: boolean('is_active').notNull().default(true),
    minQuantity: integer('min_quantity'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  table => [
    index('idx_product_catalog_items_active')
      .using('btree', table.sortOrder.asc())
      .where(sql`(deleted_at IS NULL AND is_active = true)`),
  ]
)

export const taxRates = pgTable(
  'tax_rates',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    state: varchar({ length: 2 }).notNull().unique(),
    rate: numeric({ precision: 5, scale: 4 }).notNull(),
    label: varchar({ length: 100 }).notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
  },
  table => [
    index('idx_tax_rates_state')
      .using('btree', table.state.asc())
      .where(sql`(is_active = true)`),
  ]
)

export const invoices = pgTable(
  'invoices',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    invoiceNumber: text('invoice_number').unique(),
    status: invoiceStatus().notNull().default('DRAFT'),
    companyId: uuid('company_id').notNull(),
    createdBy: uuid('created_by'),
    issuedDate: date('issued_date'),
    dueDate: date('due_date'),
    subtotal: numeric({ precision: 12, scale: 2 }).notNull().default('0'),
    taxRate: numeric('tax_rate', { precision: 5, scale: 4 }).default('0'),
    taxAmount: numeric('tax_amount', { precision: 12, scale: 2 })
      .notNull()
      .default('0'),
    total: numeric({ precision: 12, scale: 2 }).notNull().default('0'),
    notes: text(),
    shareToken: varchar('share_token', { length: 64 }).unique(),
    shareEnabled: boolean('share_enabled').notNull().default(false),
    viewedAt: timestamp('viewed_at', { withTimezone: true, mode: 'string' }),
    viewedCount: integer('viewed_count').notNull().default(0),
    billingType: clientBillingType('billing_type'),
    stripeCheckoutSessionId: text('stripe_checkout_session_id'),
    stripePaymentIntentId: text('stripe_payment_intent_id'),
    paidAt: timestamp('paid_at', { withTimezone: true, mode: 'string' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  table => [
    index('idx_invoices_company_id')
      .using('btree', table.companyId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL)`),
    index('idx_invoices_status')
      .using('btree', table.status.asc())
      .where(sql`(deleted_at IS NULL)`),
    index('idx_invoices_created_by')
      .using('btree', table.createdBy.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL)`),
    index('idx_invoices_share_token')
      .using('btree', table.shareToken.asc())
      .where(
        sql`(deleted_at IS NULL AND share_token IS NOT NULL AND share_enabled = true)`
      ),
    index('idx_invoices_stripe_checkout_session')
      .using('btree', table.stripeCheckoutSessionId.asc())
      .where(sql`(stripe_checkout_session_id IS NOT NULL)`),
    foreignKey({
      columns: [table.companyId],
      foreignColumns: [companies.id],
      name: 'invoices_company_id_fkey',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.createdBy],
      foreignColumns: [users.id],
      name: 'invoices_created_by_fkey',
    }),
  ]
)

export const invoiceLineItems = pgTable(
  'invoice_line_items',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    invoiceId: uuid('invoice_id').notNull(),
    productCatalogItemId: uuid('product_catalog_item_id'),
    description: text().notNull(),
    quantity: numeric({ precision: 8, scale: 2 }).notNull(),
    unitPrice: numeric('unit_price', { precision: 12, scale: 2 }).notNull(),
    amount: numeric({ precision: 12, scale: 2 }).notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    createsHourBlock: boolean('creates_hour_block').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  table => [
    index('idx_invoice_line_items_invoice_id')
      .using('btree', table.invoiceId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL)`),
    index('idx_invoice_line_items_product_catalog')
      .using(
        'btree',
        table.productCatalogItemId.asc().nullsLast().op('uuid_ops')
      )
      .where(sql`(deleted_at IS NULL AND product_catalog_item_id IS NOT NULL)`),
    foreignKey({
      columns: [table.invoiceId],
      foreignColumns: [invoices.id],
      name: 'invoice_line_items_invoice_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.productCatalogItemId],
      foreignColumns: [productCatalogItems.id],
      name: 'invoice_line_items_product_catalog_item_id_fkey',
    }).onDelete('set null'),
  ]
)

// =============================================================================
// MARKETING FORM SUBMISSIONS
// =============================================================================

export const formSubmissionKind = pgEnum('form_submission_kind', [
  'audit',
  'contact',
])

/**
 * Declaration order IS the rank order. The intake upsert uses
 * `GREATEST(form_submissions.status, excluded.status)` to enforce "status only
 * advances, never downgrades" — Postgres compares enum values by declaration
 * order, so reordering these values silently breaks that guarantee.
 *
 * Do not reorder. Append only.
 */
export const formSubmissionStatus = pgEnum('form_submission_status', [
  'in_progress',
  'abandoned',
  'completed',
  'captured',
])

/**
 * Raw inbox for marketing-site form submissions — both the multi-step
 * Opportunity Audit (including partial and abandoned attempts) and the contact
 * form. Rows are promoted to `leads` manually from the Submissions view.
 *
 * Audit sessions are upserted many times as beacons arrive; contact
 * submissions are one-shot. Both share `session_key` as the idempotency key.
 * See `apps/internal/lib/queries/form-submissions.ts` for the upsert rules.
 */
export const formSubmissions = pgTable(
  'form_submissions',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    kind: formSubmissionKind().notNull(),
    // Client-generated idempotency key: audit sessionId or contact submissionId
    sessionKey: text('session_key').notNull(),
    status: formSubmissionStatus().notNull(),
    // Diagnostic only (which beacon wrote last) — text, not an enum
    lastTrigger: text('last_trigger'),
    sourceDetail: text('source_detail').notNull(),

    // Timing. `last_activity_at` is the client-side ordering key used to
    // discard stale beacons — distinct from the `updated_at` row audit column.
    startedAt: timestamp('started_at', { withTimezone: true, mode: 'string' })
      .notNull(),
    lastActivityAt: timestamp('last_activity_at', {
      withTimezone: true,
      mode: 'string',
    }).notNull(),
    completedAt: timestamp('completed_at', {
      withTimezone: true,
      mode: 'string',
    }),
    capturedAt: timestamp('captured_at', {
      withTimezone: true,
      mode: 'string',
    }),
    durationMs: integer('duration_ms'),

    // Audit progress
    furthestStepIndex: integer('furthest_step_index'),
    stepsTotal: integer('steps_total'),
    answeredCount: integer('answered_count'),
    questionsTotal: integer('questions_total'),
    percentComplete: integer('percent_complete'),

    // Audit payload
    responses: jsonb('responses'),
    result: jsonb('result'),
    phaseId: text('phase_id'),
    topServiceId: text('top_service_id'),

    // Contact details (populated on capture, or immediately for contact forms)
    contactName: text('contact_name'),
    contactEmail: text('contact_email'),
    contactCompany: text('contact_company'),
    contactWebsite: text('contact_website'),
    // Contact form only: a preset ("Referral Program") or the visitor's own
    // free-form subject. Audit rows leave it null.
    subject: text('subject'),
    // Free text from the visitor: the contact form's message, or the optional
    // "anything else we should know" note on the audit capture step.
    message: text('message'),
    marketingConsent: boolean('marketing_consent'),

    // Results-page feedback (audit only). Two optional questions shown under
    // the scored result; either may be answered alone, so both are nullable.
    // `feedback_at` is the visitor's submit time as stamped by the beacon.
    feedbackHelpful: boolean('feedback_helpful'),
    feedbackComment: text('feedback_comment'),
    feedbackAt: timestamp('feedback_at', {
      withTimezone: true,
      mode: 'string',
    }),

    // Analytics
    posthogDistinctId: text('posthog_distinct_id'),
    posthogSessionId: text('posthog_session_id'),
    posthogReplayUrl: text('posthog_replay_url'),

    // Attribution
    utmSource: text('utm_source'),
    utmMedium: text('utm_medium'),
    utmCampaign: text('utm_campaign'),
    utmTerm: text('utm_term'),
    utmContent: text('utm_content'),
    gclid: text('gclid'),
    referrer: text('referrer'),
    landingPath: text('landing_path'),

    // Client environment
    viewport: text('viewport'),
    screenWidth: integer('screen_width'),
    timezone: text('timezone'),
    language: text('language'),
    userAgent: text('user_agent'),

    // Acknowledgement — a human has reviewed this row from the Submissions
    // screen. NULL = unread (for rows that warrant attention; see the unread
    // predicate in apps/internal/lib/form-submissions/constants.ts). Cleared
    // by the intake upsert when status advances, so an acknowledged
    // `completed` audit that later becomes `captured` re-flags as unread.
    acknowledgedAt: timestamp('acknowledged_at', {
      withTimezone: true,
      mode: 'string',
    }),
    acknowledgedBy: uuid('acknowledged_by').references(() => users.id, {
      onDelete: 'set null',
    }),

    // Tombstone for "Delete forever": the row is PII-stripped rather than
    // DELETEd so its unique session_key stays occupied — a late intake
    // beacon conflicts with the tombstone and is discarded instead of
    // resurrecting the "deleted" submission as a fresh row. Tombstones are
    // excluded from every list/count and can never be restored.
    destroyedAt: timestamp('destroyed_at', {
      withTimezone: true,
      mode: 'string',
    }),

    // Email delivery (PRD 008). `delivery_requested_at` is set only when the
    // marketing site opts in with `deliver: true`, so rows that predate the
    // cutover can never be picked up by the retry sweep.
    //
    // Each email has a lease and a stamp. A sender takes the lease first
    // (`*_email_claimed_at`, expiring so a crash mid-send is recoverable),
    // writes the stamp (`*_sent_at` / `team_notified_at`) only once the
    // provider has accepted the message, and clears the lease on failure. The
    // stamp is the record of delivery; the lease is what stops two requests
    // sending the same email at once. None of these is PII, so a tombstone
    // keeps them.
    deliveryRequestedAt: timestamp('delivery_requested_at', {
      withTimezone: true,
      mode: 'string',
    }),
    teamEmailClaimedAt: timestamp('team_email_claimed_at', {
      withTimezone: true,
      mode: 'string',
    }),
    teamNotifiedAt: timestamp('team_notified_at', {
      withTimezone: true,
      mode: 'string',
    }),
    confirmationEmailClaimedAt: timestamp('confirmation_email_claimed_at', {
      withTimezone: true,
      mode: 'string',
    }),
    confirmationSentAt: timestamp('confirmation_sent_at', {
      withTimezone: true,
      mode: 'string',
    }),

    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  table => [
    unique('form_submissions_session_key_key').on(table.sessionKey),
    index('idx_form_submissions_unread')
      .using(
        'btree',
        table.kind.asc().nullsLast().op('enum_ops'),
        table.status.asc().nullsLast().op('enum_ops')
      )
      .where(sql`(deleted_at IS NULL AND acknowledged_at IS NULL)`),
    index('idx_form_submissions_kind_status')
      .using(
        'btree',
        table.kind.asc().nullsLast().op('enum_ops'),
        table.status.asc().nullsLast().op('enum_ops')
      )
      .where(sql`(deleted_at IS NULL)`),
    index('idx_form_submissions_last_activity_at')
      .using('btree', table.lastActivityAt.desc().nullsLast())
      .where(sql`(deleted_at IS NULL)`),
    index('idx_form_submissions_contact_email')
      .using('btree', table.contactEmail.asc().nullsLast().op('text_ops'))
      .where(sql`(deleted_at IS NULL AND contact_email IS NOT NULL)`),
  ]
)

// =============================================================================
// RATE LIMITING
// =============================================================================

/**
 * Fixed-window counters for throttling unauthenticated actions (auth email
 * dispatch). Keyed by a caller-chosen string such as `auth-email:<address>`
 * or `auth-email-ip:<ip>`. Rows are transient: `consumeRateLimit` in
 * `@pts/db/rate-limit` resets expired windows in place and sweeps stale rows.
 */
export const rateLimitBuckets = pgTable(
  'rate_limit_buckets',
  {
    key: text().primaryKey().notNull(),
    windowStart: timestamp('window_start', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    count: integer().default(0).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
  },
  table => [
    index('idx_rate_limit_buckets_window_start').using(
      'btree',
      table.windowStart.asc().nullsLast()
    ),
  ]
)

/**
 * In-app notifications: one row per recipient. Shown in the home
 * Notifications widget. `type` is a plain string (validated in the app) so
 * a new kind of notification needs no migration. `dedupeKey` stops the same
 * event notifying twice (e.g. "task due today" once per task per date).
 */
export const notifications = pgTable(
  'notifications',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    userId: uuid('user_id').notNull(),
    type: text().notNull(),
    title: text().notNull(),
    body: text(),
    /** In-app link to the record, e.g. `/leads?lead=<id>`. */
    href: text(),
    /** Who caused it, when a person did. */
    actorId: uuid('actor_id'),
    dedupeKey: text('dedupe_key'),
    readAt: timestamp('read_at', { withTimezone: true, mode: 'string' }),
    /** Cleared from the widget; kept for history. */
    clearedAt: timestamp('cleared_at', { withTimezone: true, mode: 'string' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
  },
  table => [
    index('idx_notifications_user_feed')
      .using('btree', table.userId.asc().nullsLast().op('uuid_ops'), table.createdAt.desc().nullsFirst().op('timestamptz_ops'))
      .where(sql`(cleared_at IS NULL)`),
    uniqueIndex('idx_notifications_user_dedupe')
      .using('btree', table.userId.asc().nullsLast().op('uuid_ops'), table.dedupeKey.asc().nullsLast().op('text_ops'))
      .where(sql`(dedupe_key IS NOT NULL)`),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: 'notifications_user_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.actorId],
      foreignColumns: [users.id],
      name: 'notifications_actor_id_fkey',
    }).onDelete('set null'),
  ]
)

/**
 * Per-user home dashboard widget arrangement. One row per user; absent row
 * means the default layout. `layout` is validated/normalized in
 * apps/internal/lib/dashboard/layout.ts (unknown widget ids are dropped,
 * missing ones appended), so stale JSON never breaks rendering.
 */
export const userDashboardLayouts = pgTable(
  'user_dashboard_layouts',
  {
    userId: uuid('user_id').primaryKey().notNull(),
    layout: jsonb().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
  },
  table => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: 'user_dashboard_layouts_user_id_fkey',
    }).onDelete('cascade'),
  ]
)

// =============================================================================
// VIEWS
// =============================================================================

export const currentUserWithRole = pgView('current_user_with_role', {
  id: uuid(),
  role: userRole(),
}).as(
  sql`SELECT id, role FROM users u WHERE id = auth.uid() AND deleted_at IS NULL`
)

/**
 * Who can see which client in the client portal, derived from memberships:
 * a current, portal-enabled membership at the client's company. The one
 * source both portals read; there is nothing to keep in sync.
 */
export const clientPortalAccess = pgView('client_portal_access', {
  companyId: uuid('company_id').notNull(),
  contactId: uuid('contact_id').notNull(),
  /** The contact's portal login (always set: access needs a login). */
  userId: uuid('user_id'),
}).existing()
