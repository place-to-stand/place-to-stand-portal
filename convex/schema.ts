import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// ============================================================
// VALIDATORS (Enum equivalents)
// ============================================================

export const taskStatusValidator = v.union(
  v.literal("BACKLOG"),
  v.literal("ON_DECK"),
  v.literal("IN_PROGRESS"),
  v.literal("IN_REVIEW"),
  v.literal("BLOCKED"),
  v.literal("DONE"),
  v.literal("ARCHIVED")
);

export const userRoleValidator = v.union(
  v.literal("ADMIN"),
  v.literal("CLIENT")
);

export const clientBillingTypeValidator = v.union(
  v.literal("prepaid"),
  v.literal("net_30")
);

export const projectTypeValidator = v.union(
  v.literal("CLIENT"),
  v.literal("PERSONAL"),
  v.literal("INTERNAL")
);

export const projectStatusValidator = v.union(
  v.literal("ONBOARDING"),
  v.literal("ACTIVE"),
  v.literal("ON_HOLD"),
  v.literal("COMPLETED")
);

export const leadStatusValidator = v.union(
  v.literal("NEW_OPPORTUNITIES"),
  v.literal("ACTIVE_OPPORTUNITIES"),
  v.literal("PROPOSAL_SENT"),
  v.literal("ON_ICE"),
  v.literal("CLOSED_WON"),
  v.literal("CLOSED_LOST"),
  v.literal("UNQUALIFIED")
);

export const leadSourceTypeValidator = v.union(
  v.literal("REFERRAL"),
  v.literal("WEBSITE"),
  v.literal("EVENT")
);

export const oauthProviderValidator = v.union(
  v.literal("GOOGLE"),
  v.literal("GITHUB")
);

export const oauthConnectionStatusValidator = v.union(
  v.literal("ACTIVE"),
  v.literal("EXPIRED"),
  v.literal("REVOKED"),
  v.literal("PENDING_REAUTH")
);

export const messageSourceValidator = v.union(
  v.literal("EMAIL"),
  v.literal("CHAT"),
  v.literal("VOICE_MEMO"),
  v.literal("DOCUMENT"),
  v.literal("FORM")
);

export const threadStatusValidator = v.union(
  v.literal("OPEN"),
  v.literal("RESOLVED"),
  v.literal("ARCHIVED")
);

export const suggestionTypeValidator = v.union(
  v.literal("TASK"),
  v.literal("PR"),
  v.literal("REPLY")
);

export const suggestionStatusValidator = v.union(
  v.literal("DRAFT"),
  v.literal("PENDING"),
  v.literal("APPROVED"),
  v.literal("REJECTED"),
  v.literal("MODIFIED"),
  v.literal("FAILED")
);

export const migrationRunStatusValidator = v.union(
  v.literal("running"),
  v.literal("completed"),
  v.literal("failed"),
  v.literal("rolled_back")
);

// ============================================================
// SCHEMA DEFINITION
// ============================================================

export default defineSchema({
  // ----------------------------------------------------------
  // CORE DOMAIN
  // ----------------------------------------------------------

  /**
   * Users table
   * - Stores user accounts with roles
   * - Soft deletes via deletedAt
   * - Email is unique (enforced at application layer)
   */
  users: defineTable({
    // Auth linkage (from Convex Auth)
    authId: v.optional(v.string()),

    // Profile fields
    email: v.string(),
    name: v.optional(v.string()),
    avatarStorageId: v.optional(v.id("_storage")),

    // Role & access
    role: userRoleValidator,

    // Soft delete
    deletedAt: v.optional(v.number()),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),

    // Migration tracking (remove after migration complete)
    supabaseId: v.optional(v.string()),
  })
    .index("by_email", ["email"])
    .index("by_authId", ["authId"])
    .index("by_deleted", ["deletedAt"])
    .index("by_supabaseId", ["supabaseId"]),

  /**
   * Clients table
   * - Client organizations
   * - Billing type determines invoicing
   */
  clients: defineTable({
    name: v.string(),
    slug: v.string(),
    billingType: clientBillingTypeValidator,

    // Optional fields
    website: v.optional(v.string()),
    notes: v.optional(v.string()),

    // Soft delete
    deletedAt: v.optional(v.number()),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),

    // Migration tracking
    supabaseId: v.optional(v.string()),
  })
    .index("by_slug", ["slug"])
    .index("by_deleted", ["deletedAt"])
    .index("by_supabaseId", ["supabaseId"]),

  /**
   * Client members - User to Client membership
   * - Determines data access for non-admin users
   * - Single membership per user per client
   */
  clientMembers: defineTable({
    clientId: v.id("clients"),
    userId: v.id("users"),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),

    // Migration tracking
    supabaseId: v.optional(v.string()),
  })
    .index("by_client", ["clientId"])
    .index("by_user", ["userId"])
    .index("by_client_user", ["clientId", "userId"])
    .index("by_supabaseId", ["supabaseId"]),

  /**
   * Projects table
   * - CLIENT: linked to client, uses client's billing
   * - PERSONAL: individual user, only creator sees
   * - INTERNAL: team projects, all users see
   */
  projects: defineTable({
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),

    type: projectTypeValidator,
    status: projectStatusValidator,

    // CLIENT projects link to a client
    clientId: v.optional(v.id("clients")),

    // Creator (owner for PERSONAL projects)
    createdById: v.id("users"),

    // Soft delete
    deletedAt: v.optional(v.number()),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),

    // Migration tracking
    supabaseId: v.optional(v.string()),
  })
    .index("by_client", ["clientId"])
    .index("by_slug", ["slug"])
    .index("by_type", ["type"])
    .index("by_status", ["status"])
    .index("by_createdBy", ["createdById"])
    .index("by_deleted", ["deletedAt"])
    .index("by_client_deleted", ["clientId", "deletedAt"])
    .index("by_supabaseId", ["supabaseId"]),

  /**
   * Tasks table
   * - Kanban board items with status workflow
   * - rank field for ordering within status column
   */
  tasks: defineTable({
    title: v.string(),
    description: v.optional(v.string()),

    status: taskStatusValidator,
    rank: v.string(),

    projectId: v.id("projects"),

    // Scheduling
    dueDate: v.optional(v.number()),
    startDate: v.optional(v.number()),

    // Priority/metadata
    priority: v.optional(v.number()),
    estimate: v.optional(v.number()),

    // Soft delete
    deletedAt: v.optional(v.number()),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),

    // Migration tracking
    supabaseId: v.optional(v.string()),
  })
    .index("by_project", ["projectId"])
    .index("by_project_status", ["projectId", "status"])
    .index("by_project_status_rank", ["projectId", "status", "rank"])
    .index("by_dueDate", ["dueDate"])
    .index("by_deleted", ["deletedAt"])
    .index("by_supabaseId", ["supabaseId"]),

  /**
   * Task assignees - Many-to-many: tasks to users
   * - Soft delete to preserve assignment history
   */
  taskAssignees: defineTable({
    taskId: v.id("tasks"),
    userId: v.id("users"),

    // Soft delete
    deletedAt: v.optional(v.number()),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),

    // Migration tracking
    supabaseId: v.optional(v.string()),
  })
    .index("by_task", ["taskId"])
    .index("by_user", ["userId"])
    .index("by_task_user", ["taskId", "userId"])
    .index("by_user_deleted", ["userId", "deletedAt"])
    .index("by_supabaseId", ["supabaseId"]),

  /**
   * Task assignee metadata - Custom sort order per task
   * - Preserves display order of assignees
   */
  taskAssigneeMetadata: defineTable({
    taskId: v.id("tasks"),
    assigneeId: v.id("taskAssignees"),
    sortOrder: v.number(),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),

    // Migration tracking
    supabaseId: v.optional(v.string()),
  })
    .index("by_task", ["taskId"])
    .index("by_assignee", ["assigneeId"])
    .index("by_supabaseId", ["supabaseId"]),

  /**
   * Task comments - Discussion threads on tasks
   * - parentId enables threading (replies)
   */
  taskComments: defineTable({
    taskId: v.id("tasks"),
    authorId: v.id("users"),

    content: v.string(),

    // Threading support
    parentId: v.optional(v.id("taskComments")),

    // Soft delete
    deletedAt: v.optional(v.number()),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),

    // Migration tracking
    supabaseId: v.optional(v.string()),
  })
    .index("by_task", ["taskId"])
    .index("by_author", ["authorId"])
    .index("by_parent", ["parentId"])
    .index("by_task_deleted", ["taskId", "deletedAt"])
    .index("by_supabaseId", ["supabaseId"]),

  /**
   * Task attachments - File references for tasks
   * - storageId links to Convex file storage
   */
  taskAttachments: defineTable({
    taskId: v.id("tasks"),
    uploadedById: v.id("users"),

    // File info
    fileName: v.string(),
    mimeType: v.string(),
    fileSize: v.number(),

    // Convex storage reference
    storageId: v.id("_storage"),

    // Soft delete
    deletedAt: v.optional(v.number()),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),

    // Migration tracking
    supabaseId: v.optional(v.string()),
  })
    .index("by_task", ["taskId"])
    .index("by_uploadedBy", ["uploadedById"])
    .index("by_storageId", ["storageId"])
    .index("by_supabaseId", ["supabaseId"]),

  // ----------------------------------------------------------
  // TIME TRACKING
  // ----------------------------------------------------------

  /**
   * Time logs - Time entries for projects
   * - Can be associated with multiple tasks via timeLogTasks
   */
  timeLogs: defineTable({
    projectId: v.id("projects"),
    userId: v.id("users"),

    // Time entry
    date: v.string(),
    hours: v.number(),
    description: v.optional(v.string()),

    // Billing
    billable: v.boolean(),

    // Soft delete
    deletedAt: v.optional(v.number()),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),

    // Migration tracking
    supabaseId: v.optional(v.string()),
  })
    .index("by_project", ["projectId"])
    .index("by_user", ["userId"])
    .index("by_date", ["date"])
    .index("by_project_date", ["projectId", "date"])
    .index("by_user_date", ["userId", "date"])
    .index("by_deleted", ["deletedAt"])
    .index("by_supabaseId", ["supabaseId"]),

  /**
   * Time log tasks - Junction: time logs to tasks
   * - Allows one time entry to span multiple tasks
   */
  timeLogTasks: defineTable({
    timeLogId: v.id("timeLogs"),
    taskId: v.id("tasks"),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),

    // Migration tracking
    supabaseId: v.optional(v.string()),
  })
    .index("by_timeLog", ["timeLogId"])
    .index("by_task", ["taskId"])
    .index("by_supabaseId", ["supabaseId"]),

  /**
   * Hour blocks - Prepaid hour contracts
   * - Linked to clients for burn-down tracking
   */
  hourBlocks: defineTable({
    clientId: v.id("clients"),

    // Hours
    totalHours: v.number(),
    usedHours: v.number(),

    // Contract period
    startDate: v.string(),
    endDate: v.optional(v.string()),

    // Status
    isActive: v.boolean(),

    // Notes
    notes: v.optional(v.string()),

    // Soft delete
    deletedAt: v.optional(v.number()),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),

    // Migration tracking
    supabaseId: v.optional(v.string()),
  })
    .index("by_client", ["clientId"])
    .index("by_active", ["isActive"])
    .index("by_client_active", ["clientId", "isActive"])
    .index("by_supabaseId", ["supabaseId"]),

  // ----------------------------------------------------------
  // CRM / LEADS
  // ----------------------------------------------------------

  /**
   * Leads - Sales pipeline
   * - Kanban board with status workflow
   */
  leads: defineTable({
    name: v.string(),
    email: v.optional(v.string()),
    company: v.optional(v.string()),
    website: v.optional(v.string()),
    phone: v.optional(v.string()),

    status: leadStatusValidator,
    source: leadSourceTypeValidator,
    sourceDetail: v.optional(v.string()),

    // Opportunity details
    estimatedValue: v.optional(v.number()),
    notes: v.optional(v.string()),

    // Assignment
    assignedToId: v.optional(v.id("users")),

    // Soft delete
    deletedAt: v.optional(v.number()),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),

    // Migration tracking
    supabaseId: v.optional(v.string()),
  })
    .index("by_status", ["status"])
    .index("by_email", ["email"])
    .index("by_assignedTo", ["assignedToId"])
    .index("by_deleted", ["deletedAt"])
    .index("by_supabaseId", ["supabaseId"]),

  /**
   * Contacts - Contact management
   */
  contacts: defineTable({
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    company: v.optional(v.string()),
    title: v.optional(v.string()),

    notes: v.optional(v.string()),

    // Soft delete
    deletedAt: v.optional(v.number()),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),

    // Migration tracking
    supabaseId: v.optional(v.string()),
  })
    .index("by_email", ["email"])
    .index("by_company", ["company"])
    .index("by_deleted", ["deletedAt"])
    .index("by_supabaseId", ["supabaseId"]),

  /**
   * Contact-Client relationships
   */
  contactClients: defineTable({
    contactId: v.id("contacts"),
    clientId: v.id("clients"),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),

    // Migration tracking
    supabaseId: v.optional(v.string()),
  })
    .index("by_contact", ["contactId"])
    .index("by_client", ["clientId"])
    .index("by_supabaseId", ["supabaseId"]),

  /**
   * Contact-Lead relationships
   */
  contactLeads: defineTable({
    contactId: v.id("contacts"),
    leadId: v.id("leads"),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),

    // Migration tracking
    supabaseId: v.optional(v.string()),
  })
    .index("by_contact", ["contactId"])
    .index("by_lead", ["leadId"])
    .index("by_supabaseId", ["supabaseId"]),

  // ----------------------------------------------------------
  // INTEGRATIONS
  // ----------------------------------------------------------

  /**
   * OAuth connections - External service tokens
   * - Tokens are encrypted at rest
   */
  oauthConnections: defineTable({
    userId: v.id("users"),

    provider: oauthProviderValidator,
    providerAccountId: v.string(),

    // Encrypted token data
    encryptedAccessToken: v.string(),
    encryptedRefreshToken: v.optional(v.string()),
    tokenExpiresAt: v.optional(v.number()),

    // Connection status
    status: oauthConnectionStatusValidator,

    // Sync state
    lastSyncAt: v.optional(v.number()),
    syncError: v.optional(v.string()),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),

    // Migration tracking
    supabaseId: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_provider", ["provider"])
    .index("by_user_provider", ["userId", "provider"])
    .index("by_status", ["status"])
    .index("by_supabaseId", ["supabaseId"]),

  /**
   * GitHub repo links - Project to repo associations
   */
  githubRepoLinks: defineTable({
    projectId: v.id("projects"),

    repoFullName: v.string(),
    repoId: v.number(),

    // Sync settings
    syncEnabled: v.boolean(),
    lastSyncAt: v.optional(v.number()),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),

    // Migration tracking
    supabaseId: v.optional(v.string()),
  })
    .index("by_project", ["projectId"])
    .index("by_repoFullName", ["repoFullName"])
    .index("by_project_repo", ["projectId", "repoFullName"])
    .index("by_supabaseId", ["supabaseId"]),

  // ----------------------------------------------------------
  // ACTIVITY & AUDIT
  // ----------------------------------------------------------

  /**
   * Activity logs - Audit trail
   * - metadata stores event-specific data
   */
  activityLogs: defineTable({
    // Actor (who did it)
    actorId: v.optional(v.id("users")),

    // Event type
    eventType: v.string(),

    // Target entity
    entityType: v.string(),
    entityId: v.string(),

    // Event data (typed in separate validator file)
    metadata: v.optional(v.any()),

    // Timestamps
    createdAt: v.number(),

    // Migration tracking
    supabaseId: v.optional(v.string()),
  })
    .index("by_actor", ["actorId"])
    .index("by_entityType", ["entityType"])
    .index("by_entityId", ["entityId"])
    .index("by_eventType", ["eventType"])
    .index("by_createdAt", ["createdAt"])
    .index("by_supabaseId", ["supabaseId"]),

  /**
   * Activity overview cache - Pre-computed summaries
   * - Performance optimization for dashboard
   */
  activityCache: defineTable({
    // Scope
    userId: v.optional(v.id("users")),
    clientId: v.optional(v.id("clients")),
    projectId: v.optional(v.id("projects")),

    // Time window
    windowDays: v.number(),

    // Cached data
    data: v.any(),

    // Cache metadata
    computedAt: v.number(),
    expiresAt: v.number(),

    // Migration tracking
    supabaseId: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_client", ["clientId"])
    .index("by_project", ["projectId"])
    .index("by_window", ["windowDays"])
    .index("by_expiresAt", ["expiresAt"])
    .index("by_supabaseId", ["supabaseId"]),

  // ----------------------------------------------------------
  // MESSAGING (Phase 5)
  // ----------------------------------------------------------

  /**
   * Threads - Email/message threads
   */
  threads: defineTable({
    subject: v.optional(v.string()),
    status: threadStatusValidator,

    // External provider info
    providerId: v.optional(v.string()),
    providerType: v.optional(v.string()),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),

    // Migration tracking
    supabaseId: v.optional(v.string()),
  })
    .index("by_status", ["status"])
    .index("by_providerId", ["providerId"])
    .index("by_supabaseId", ["supabaseId"]),

  /**
   * Messages - Individual messages within threads
   */
  messages: defineTable({
    threadId: v.id("threads"),

    source: messageSourceValidator,

    // Content
    subject: v.optional(v.string()),
    body: v.optional(v.string()),
    snippet: v.optional(v.string()),

    // Participants
    fromAddress: v.optional(v.string()),
    toAddresses: v.optional(v.array(v.string())),
    ccAddresses: v.optional(v.array(v.string())),

    // External provider info
    providerId: v.optional(v.string()),
    providerMetadata: v.optional(v.any()),

    // Timestamps
    sentAt: v.optional(v.number()),
    receivedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),

    // Migration tracking
    supabaseId: v.optional(v.string()),
  })
    .index("by_thread", ["threadId"])
    .index("by_source", ["source"])
    .index("by_sentAt", ["sentAt"])
    .index("by_providerId", ["providerId"])
    .index("by_supabaseId", ["supabaseId"]),

  /**
   * Suggestions - AI-generated suggestions
   * - Polymorphic: can suggest tasks, PRs, or replies
   */
  suggestions: defineTable({
    messageId: v.optional(v.id("messages")),
    taskId: v.optional(v.id("tasks")),

    type: suggestionTypeValidator,
    status: suggestionStatusValidator,

    // Suggestion content
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    metadata: v.optional(v.any()),

    // Review
    reviewedById: v.optional(v.id("users")),
    reviewedAt: v.optional(v.number()),
    reviewNotes: v.optional(v.string()),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),

    // Migration tracking
    supabaseId: v.optional(v.string()),
  })
    .index("by_message", ["messageId"])
    .index("by_task", ["taskId"])
    .index("by_type", ["type"])
    .index("by_status", ["status"])
    .index("by_type_status", ["type", "status"])
    .index("by_supabaseId", ["supabaseId"]),

  // ----------------------------------------------------------
  // MIGRATION & OBSERVABILITY
  // ----------------------------------------------------------

  /**
   * Migration runs - Audit trail for data migrations
   * - Tracks who ran what, when, and the results
   */
  migrationRuns: defineTable({
    // What was migrated
    phase: v.string(),
    table: v.optional(v.string()),

    // Execution details
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    status: migrationRunStatusValidator,

    // Results
    recordsProcessed: v.number(),
    recordsSkipped: v.number(),
    errors: v.array(
      v.object({
        recordId: v.string(),
        error: v.string(),
      })
    ),

    // Who ran it
    runBy: v.string(),
    environment: v.string(),

    // Notes
    notes: v.optional(v.string()),
  })
    .index("by_phase", ["phase"])
    .index("by_status", ["status"])
    .index("by_startedAt", ["startedAt"]),

  /**
   * Activity archives - Compressed old activity logs
   * - Stores batches of archived logs in file storage
   */
  activityArchives: defineTable({
    // File reference
    storageId: v.id("_storage"),

    // Archive metadata
    logCount: v.number(),
    oldestLog: v.number(),
    newestLog: v.number(),
    archivedAt: v.number(),

    // Compression info
    compressedSize: v.optional(v.number()),
    originalSize: v.optional(v.number()),
  })
    .index("by_archivedAt", ["archivedAt"])
    .index("by_oldestLog", ["oldestLog"]),
});
