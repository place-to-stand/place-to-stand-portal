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
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

// =============================================================================
// ENUMS
// =============================================================================

export const taskStatus = pgEnum('task_status', [
  'BACKLOG',
  'ON_DECK',
  'IN_PROGRESS',
  'IN_REVIEW',
  'BLOCKED',
  'DONE',
  'ARCHIVED',
])
export const userRole = pgEnum('user_role', ['ADMIN', 'CLIENT'])
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
export const oauthProvider = pgEnum('oauth_provider', ['GOOGLE', 'GITHUB'])

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

/**
 * Message source types for the unified messaging system.
 * - EMAIL: Gmail/email messages (currently implemented)
 * - CHAT: Reserved for future Slack/Discord integration
 * - VOICE_MEMO: Reserved for future voice message support
 * - DOCUMENT: Reserved for future document-based messages
 * - FORM: Reserved for future form submission messages
 */
export const messageSource = pgEnum('message_source', [
  'EMAIL',
  'CHAT', // Reserved: for future chat integrations
  'VOICE_MEMO', // Reserved: for future voice memo support
  'DOCUMENT', // Reserved: for future document-based messages
  'FORM', // Reserved: for future form submissions
])
export const threadStatus = pgEnum('thread_status', [
  'OPEN',
  'RESOLVED',
  'ARCHIVED',
])

// Unified suggestion enums
export const suggestionType = pgEnum('suggestion_type', ['TASK', 'PR', 'REPLY'])
export const suggestionStatus = pgEnum('suggestion_status', [
  'DRAFT',
  'PENDING',
  'APPROVED',
  'REJECTED',
  'MODIFIED',
  'FAILED',
])

// =============================================================================
// CORE TABLES
// =============================================================================

export const users = pgTable(
  'users',
  {
    id: uuid().primaryKey().notNull(),
    email: text().notNull(),
    fullName: text('full_name'),
    role: userRole().default('CLIENT').notNull(),
    avatarUrl: text('avatar_url'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  table => [unique('users_email_key').on(table.email)]
)

export const clients = pgTable(
  'clients',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    name: text().notNull(),
    slug: text(),
    notes: text(),
    billingType: clientBillingType('billing_type')
      .default('prepaid')
      .notNull(),
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
    index('idx_clients_created_by')
      .using('btree', table.createdBy.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL)`),
    foreignKey({
      columns: [table.createdBy],
      foreignColumns: [users.id],
      name: 'clients_created_by_fkey',
    }),
    unique('clients_slug_key').on(table.slug),
  ]
)

export const contacts = pgTable(
  'contacts',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    email: text().notNull(),
    name: text().notNull(),
    phone: text(),
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
    unique('contacts_email_key').on(table.email),
    index('idx_contacts_email')
      .using('btree', table.email.asc().nullsLast().op('text_ops'))
      .where(sql`(deleted_at IS NULL)`),
    index('idx_contacts_email_domain')
      .using('btree', sql`split_part(email, '@', 2)`)
      .where(sql`(deleted_at IS NULL)`),
    foreignKey({
      columns: [table.createdBy],
      foreignColumns: [users.id],
      name: 'contacts_created_by_fkey',
    }),
  ]
)

export const contactClients = pgTable(
  'contact_clients',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    contactId: uuid('contact_id').notNull(),
    clientId: uuid('client_id').notNull(),
    isPrimary: boolean('is_primary').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
  },
  table => [
    unique('contact_clients_contact_client_key').on(table.contactId, table.clientId),
    index('idx_contact_clients_contact')
      .using('btree', table.contactId.asc().nullsLast().op('uuid_ops')),
    index('idx_contact_clients_client')
      .using('btree', table.clientId.asc().nullsLast().op('uuid_ops')),
    foreignKey({
      columns: [table.contactId],
      foreignColumns: [contacts.id],
      name: 'contact_clients_contact_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.clientId],
      foreignColumns: [clients.id],
      name: 'contact_clients_client_id_fkey',
    }).onDelete('cascade'),
  ]
)

export const contactLeads = pgTable(
  'contact_leads',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    contactId: uuid('contact_id').notNull(),
    leadId: uuid('lead_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
  },
  table => [
    unique('contact_leads_contact_lead_key').on(table.contactId, table.leadId),
    index('idx_contact_leads_contact')
      .using('btree', table.contactId.asc().nullsLast().op('uuid_ops')),
    index('idx_contact_leads_lead')
      .using('btree', table.leadId.asc().nullsLast().op('uuid_ops')),
    foreignKey({
      columns: [table.contactId],
      foreignColumns: [contacts.id],
      name: 'contact_leads_contact_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.leadId],
      foreignColumns: [leads.id],
      name: 'contact_leads_lead_id_fkey',
    }).onDelete('cascade'),
  ]
)

export const clientMembers = pgTable(
  'client_members',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedByDefaultAsIdentity({
      name: 'client_members_id_seq',
      startWith: 1,
      increment: 1,
      minValue: 1,
      maxValue: 9223372036854775807,
      cache: 1,
    }),
    clientId: uuid('client_id').notNull(),
    userId: uuid('user_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  table => [
    index('idx_client_members_client')
      .using('btree', table.clientId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL)`),
    index('idx_client_members_user')
      .using('btree', table.userId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL)`),
    foreignKey({
      columns: [table.clientId],
      foreignColumns: [clients.id],
      name: 'client_members_client_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: 'client_members_user_id_fkey',
    }).onDelete('cascade'),
    unique('client_members_client_id_user_id_key').on(
      table.clientId,
      table.userId
    ),
  ]
)

export const projects = pgTable(
  'projects',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    clientId: uuid('client_id'),
    name: text().notNull(),
    status: projectStatus().default('ACTIVE').notNull(),
    startsOn: date('starts_on'),
    endsOn: date('ends_on'),
    createdBy: uuid('created_by'),
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
    index('idx_projects_client')
      .using('btree', table.clientId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL)`),
    index('idx_projects_created_by')
      .using('btree', table.createdBy.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL)`),
    uniqueIndex('idx_projects_slug')
      .using('btree', table.slug.asc().nullsLast().op('text_ops'))
      .where(sql`(slug IS NOT NULL)`),
    foreignKey({
      columns: [table.clientId],
      foreignColumns: [clients.id],
      name: 'projects_client_id_fkey',
    }),
    foreignKey({
      columns: [table.createdBy],
      foreignColumns: [users.id],
      name: 'projects_created_by_fkey',
    }),
    check(
      'projects_type_client_check',
      sql`(
        (type = 'CLIENT' AND client_id IS NOT NULL)
        OR (
          type IN ('PERSONAL', 'INTERNAL')
          AND client_id IS NULL
        )
      )`
    ),
  ]
)

export const tasks = pgTable(
  'tasks',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    projectId: uuid('project_id').notNull(),
    title: text().notNull(),
    description: text(),
    status: taskStatus().default('BACKLOG').notNull(),
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
    rank: text().default('zzzzzzzz').notNull(),
  },
  table => [
    index('idx_tasks_created_by')
      .using('btree', table.createdBy.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL)`),
    index('idx_tasks_project')
      .using('btree', table.projectId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL)`),
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
    foreignKey({
      columns: [table.projectId],
      foreignColumns: [projects.id],
      name: 'tasks_project_id_fkey',
    }).onDelete('cascade'),
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
    invoiceNumber: text('invoice_number'),
    clientId: uuid('client_id').notNull(),
  },
  table => [
    index('idx_hour_blocks_client_id')
      .using('btree', table.clientId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL)`),
    index('idx_hour_blocks_created_by')
      .using('btree', table.createdBy.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL)`),
    foreignKey({
      columns: [table.createdBy],
      foreignColumns: [users.id],
      name: 'hour_blocks_created_by_fkey',
    }),
    foreignKey({
      columns: [table.clientId],
      foreignColumns: [clients.id],
      name: 'hour_blocks_client_id_fkey',
    }).onDelete('cascade'),
    check(
      'hour_blocks_invoice_number_format',
      sql`(invoice_number IS NULL) OR (invoice_number ~ '^[A-Za-z0-9-]+$'::text)`
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
    contactName: text('contact_name').notNull(),
    status: leadStatus().default('NEW_OPPORTUNITIES').notNull(),
    sourceType: leadSourceType('source_type'),
    sourceDetail: text('source_detail'),
    assigneeId: uuid('assignee_id'),
    contactEmail: text('contact_email'),
    contactPhone: text('contact_phone'),
    companyName: text('company_name'),
    companyWebsite: text('company_website'),
    notes: jsonb('notes').default({}).notNull(),
    rank: text().default('zzzzzzzz').notNull(),
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
    foreignKey({
      columns: [table.assigneeId],
      foreignColumns: [users.id],
      name: 'leads_assignee_id_fkey',
    }),
  ]
)

export const activityLogs = pgTable(
  'activity_logs',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    actorId: uuid('actor_id').notNull(),
    actorRole: userRole('actor_role').notNull(),
    verb: text().notNull(),
    summary: text().notNull(),
    targetType: text('target_type').notNull(),
    targetId: uuid('target_id'),
    targetClientId: uuid('target_client_id'),
    targetProjectId: uuid('target_project_id'),
    contextRoute: text('context_route'),
    metadata: jsonb().default({}).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
    restoredAt: timestamp('restored_at', {
      withTimezone: true,
      mode: 'string',
    }),
  },
  table => [
    index('idx_activity_logs_actor_id')
      .using('btree', table.actorId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL)`),
    index('idx_activity_logs_client')
      .using(
        'btree',
        table.targetClientId.asc().nullsLast().op('uuid_ops'),
        table.createdAt.desc().nullsFirst().op('timestamptz_ops')
      )
      .where(sql`(deleted_at IS NULL)`),
    index('idx_activity_logs_created_at').using(
      'btree',
      table.createdAt.desc().nullsFirst().op('timestamptz_ops')
    ),
    index('idx_activity_logs_project')
      .using(
        'btree',
        table.targetProjectId.asc().nullsLast().op('uuid_ops'),
        table.createdAt.desc().nullsFirst().op('timestamptz_ops')
      )
      .where(sql`(deleted_at IS NULL)`),
    index('idx_activity_logs_target')
      .using(
        'btree',
        table.targetType.asc().nullsLast().op('text_ops'),
        table.targetId.asc().nullsLast().op('uuid_ops')
      )
      .where(sql`(deleted_at IS NULL)`),
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
    summary: text().notNull(),
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
// THREADS & MESSAGES (Phase 5 - Unified Messaging)
// =============================================================================

export const threads = pgTable(
  'threads',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    clientId: uuid('client_id'),
    projectId: uuid('project_id'),
    subject: text(),
    status: threadStatus().default('OPEN').notNull(),
    source: messageSource().notNull(),
    externalThreadId: text('external_thread_id'),
    participantEmails: text('participant_emails').array().default([]).notNull(),
    lastMessageAt: timestamp('last_message_at', { withTimezone: true, mode: 'string' }),
    messageCount: integer('message_count').default(0).notNull(),
    metadata: jsonb().default({}).notNull(),
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
    index('idx_threads_client')
      .using('btree', table.clientId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL AND client_id IS NOT NULL)`),
    index('idx_threads_project')
      .using('btree', table.projectId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL AND project_id IS NOT NULL)`),
    index('idx_threads_external')
      .using('btree', table.externalThreadId.asc().nullsLast().op('text_ops'))
      .where(sql`(deleted_at IS NULL AND external_thread_id IS NOT NULL)`),
    index('idx_threads_last_message')
      .using('btree', table.lastMessageAt.desc().nullsFirst())
      .where(sql`(deleted_at IS NULL)`),
    foreignKey({
      columns: [table.clientId],
      foreignColumns: [clients.id],
      name: 'threads_client_id_fkey',
    }),
    foreignKey({
      columns: [table.projectId],
      foreignColumns: [projects.id],
      name: 'threads_project_id_fkey',
    }),
    foreignKey({
      columns: [table.createdBy],
      foreignColumns: [users.id],
      name: 'threads_created_by_fkey',
    }),
  ]
)

export const messages = pgTable(
  'messages',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    threadId: uuid('thread_id').notNull(),
    userId: uuid('user_id').notNull(),
    source: messageSource().notNull(),
    externalMessageId: text('external_message_id'),
    subject: text(),
    bodyText: text('body_text'),
    bodyHtml: text('body_html'),
    snippet: text(),
    fromEmail: text('from_email').notNull(),
    fromName: text('from_name'),
    toEmails: text('to_emails').array().default([]).notNull(),
    ccEmails: text('cc_emails').array().default([]).notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true, mode: 'string' }).notNull(),
    isInbound: boolean('is_inbound').default(true).notNull(),
    isRead: boolean('is_read').default(false).notNull(),
    hasAttachments: boolean('has_attachments').default(false).notNull(),
    analyzedAt: timestamp('analyzed_at', { withTimezone: true, mode: 'string' }),
    analysisVersion: text('analysis_version'),
    providerMetadata: jsonb('provider_metadata').default({}).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  table => [
    unique('messages_user_external_key').on(table.userId, table.externalMessageId),
    index('idx_messages_thread')
      .using('btree', table.threadId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL)`),
    index('idx_messages_user')
      .using('btree', table.userId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL)`),
    index('idx_messages_sent_at')
      .using('btree', table.sentAt.desc().nullsFirst())
      .where(sql`(deleted_at IS NULL)`),
    index('idx_messages_unanalyzed')
      .using('btree', table.userId.asc().nullsLast())
      .where(sql`(deleted_at IS NULL AND analyzed_at IS NULL)`),
    index('idx_messages_from_email')
      .using('btree', table.fromEmail.asc().nullsLast().op('text_ops'))
      .where(sql`(deleted_at IS NULL)`),
    foreignKey({
      columns: [table.threadId],
      foreignColumns: [threads.id],
      name: 'messages_thread_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: 'messages_user_id_fkey',
    }).onDelete('cascade'),
  ]
)


// =============================================================================
// GITHUB INTEGRATION
// =============================================================================

export const githubRepoLinks = pgTable(
  'github_repo_links',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    projectId: uuid('project_id').notNull(),
    oauthConnectionId: uuid('oauth_connection_id').notNull(),
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
      .where(sql`(deleted_at IS NULL)`),
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
      columns: [table.linkedBy],
      foreignColumns: [users.id],
      name: 'github_repo_links_linked_by_fkey',
    }),
  ]
)

// =============================================================================
// UNIFIED SUGGESTIONS (Phase 5 - Polymorphic)
// =============================================================================

export const suggestions = pgTable(
  'suggestions',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    messageId: uuid('message_id'),
    threadId: uuid('thread_id'),
    type: suggestionType().notNull(),
    status: suggestionStatus().default('PENDING').notNull(),
    projectId: uuid('project_id'),
    confidence: numeric({ precision: 3, scale: 2 }).notNull(),
    reasoning: text(),
    aiModelVersion: text('ai_model_version'),
    promptTokens: integer('prompt_tokens'),
    completionTokens: integer('completion_tokens'),
    suggestedContent: jsonb('suggested_content').default({}).notNull(),
    reviewedBy: uuid('reviewed_by'),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true, mode: 'string' }),
    createdTaskId: uuid('created_task_id'),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  table => [
    check('suggestions_confidence_range', sql`confidence >= 0 AND confidence <= 1`),
    index('idx_suggestions_pending_type')
      .using('btree', table.type.asc().nullsLast(), table.status.asc().nullsLast())
      .where(sql`(deleted_at IS NULL AND status IN ('PENDING', 'DRAFT'))`),
    index('idx_suggestions_message')
      .using('btree', table.messageId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL AND message_id IS NOT NULL)`),
    index('idx_suggestions_thread')
      .using('btree', table.threadId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL AND thread_id IS NOT NULL)`),
    index('idx_suggestions_project')
      .using('btree', table.projectId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL AND project_id IS NOT NULL)`),
    foreignKey({
      columns: [table.messageId],
      foreignColumns: [messages.id],
      name: 'suggestions_message_id_fkey',
    }),
    foreignKey({
      columns: [table.threadId],
      foreignColumns: [threads.id],
      name: 'suggestions_thread_id_fkey',
    }),
    foreignKey({
      columns: [table.projectId],
      foreignColumns: [projects.id],
      name: 'suggestions_project_id_fkey',
    }),
    foreignKey({
      columns: [table.reviewedBy],
      foreignColumns: [users.id],
      name: 'suggestions_reviewed_by_fkey',
    }),
    foreignKey({
      columns: [table.createdTaskId],
      foreignColumns: [tasks.id],
      name: 'suggestions_created_task_id_fkey',
    }),
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
