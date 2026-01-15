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
  // CONVEX AUTH TABLES
  // Required by @convex-dev/auth for authentication
  // Schema matches authTables from @convex-dev/auth/server
  // ----------------------------------------------------------

  /**
   * Auth sessions - Active user sessions
   */
  authSessions: defineTable({
    userId: v.id("users"),
    expirationTime: v.number(),
  }).index("userId", ["userId"]),

  /**
   * Auth accounts - OAuth provider accounts linked to users
   */
  authAccounts: defineTable({
    userId: v.id("users"),
    provider: v.string(),
    providerAccountId: v.string(),
    secret: v.optional(v.string()),
    emailVerified: v.optional(v.string()),
    phoneVerified: v.optional(v.string()),
  })
    .index("userIdAndProvider", ["userId", "provider"])
    .index("providerAndAccountId", ["provider", "providerAccountId"]),

  /**
   * Auth refresh tokens - Token refresh management
   */
  authRefreshTokens: defineTable({
    sessionId: v.id("authSessions"),
    expirationTime: v.number(),
    firstUsedTime: v.optional(v.number()),
    parentRefreshTokenId: v.optional(v.id("authRefreshTokens")),
  })
    .index("sessionId", ["sessionId"])
    .index("sessionIdAndParentRefreshTokenId", ["sessionId", "parentRefreshTokenId"]),

  /**
   * Auth verification codes - OTP, magic links, OAuth codes
   */
  authVerificationCodes: defineTable({
    accountId: v.id("authAccounts"),
    provider: v.string(),
    code: v.string(),
    expirationTime: v.number(),
    verifier: v.optional(v.string()),
    emailVerified: v.optional(v.string()),
    phoneVerified: v.optional(v.string()),
  })
    .index("accountId", ["accountId"])
    .index("code", ["code"]),

  /**
   * Auth verifiers - PKCE verifiers for OAuth
   */
  authVerifiers: defineTable({
    sessionId: v.optional(v.id("authSessions")),
    signature: v.optional(v.string()),
  }).index("signature", ["signature"]),

  /**
   * Auth rate limits - Rate limiting for OTP and password sign-in
   */
  authRateLimits: defineTable({
    identifier: v.string(),
    lastAttemptTime: v.number(),
    attemptsLeft: v.number(),
  }).index("identifier", ["identifier"]),

  // ----------------------------------------------------------
  // CORE DOMAIN
  // ----------------------------------------------------------

  /**
   * Users table
   * - Stores user accounts with roles
   * - Soft deletes via deletedAt
   * - Email is unique (enforced at application layer)
   * - Field names match Supabase schema exactly for 1:1 migration
   */
  users: defineTable({
    // Auth linkage (from Convex Auth)
    authId: v.optional(v.string()),

    // Profile fields (matching Supabase: full_name column)
    email: v.string(),
    fullName: v.optional(v.string()), // Matches Supabase full_name
    avatarUrl: v.optional(v.string()), // Matches Supabase avatar_url (storage path)

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
   * - Field names match Supabase schema exactly for 1:1 migration
   */
  clients: defineTable({
    name: v.string(),
    slug: v.optional(v.string()), // Matches Supabase (nullable)
    billingType: clientBillingTypeValidator,

    // Optional fields (matching Supabase exactly)
    notes: v.optional(v.string()),
    createdBy: v.optional(v.id("users")), // Matches Supabase created_by

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
   * - Field names match Supabase schema exactly for 1:1 migration
   */
  projects: defineTable({
    name: v.string(),
    slug: v.optional(v.string()), // Matches Supabase (nullable)

    type: projectTypeValidator,
    status: projectStatusValidator,

    // Date range (matching Supabase starts_on, ends_on)
    startsOn: v.optional(v.string()), // ISO date string
    endsOn: v.optional(v.string()), // ISO date string

    // CLIENT projects link to a client
    clientId: v.optional(v.id("clients")),

    // Creator (owner for PERSONAL projects) - matches Supabase created_by
    createdBy: v.optional(v.id("users")),

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
    .index("by_createdBy", ["createdBy"])
    .index("by_deleted", ["deletedAt"])
    .index("by_client_deleted", ["clientId", "deletedAt"])
    .index("by_supabaseId", ["supabaseId"]),

  /**
   * Tasks table
   * - Kanban board items with status workflow
   * - rank field for ordering within status column
   * - Field names match Supabase schema exactly for 1:1 migration
   */
  tasks: defineTable({
    title: v.string(),
    description: v.optional(v.string()),

    status: taskStatusValidator,
    rank: v.string(),

    projectId: v.id("projects"),

    // Scheduling (matching Supabase due_on - stored as ISO date string)
    dueOn: v.optional(v.string()), // Matches Supabase due_on

    // Audit fields (matching Supabase)
    createdBy: v.optional(v.id("users")), // Matches Supabase created_by
    updatedBy: v.optional(v.id("users")), // Matches Supabase updated_by
    acceptedAt: v.optional(v.number()), // Matches Supabase accepted_at

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
    .index("by_dueOn", ["dueOn"])
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
   * - Field names match Supabase schema exactly for 1:1 migration
   */
  taskComments: defineTable({
    taskId: v.id("tasks"),
    authorId: v.id("users"),

    body: v.string(), // Matches Supabase body (not content)

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
    .index("by_task_deleted", ["taskId", "deletedAt"])
    .index("by_supabaseId", ["supabaseId"]),

  /**
   * Task attachments - File references for tasks
   * - Field names match Supabase schema exactly for 1:1 migration
   */
  taskAttachments: defineTable({
    taskId: v.id("tasks"),
    uploadedBy: v.id("users"), // Matches Supabase uploaded_by

    // File info (matching Supabase)
    storagePath: v.string(), // Matches Supabase storage_path
    originalName: v.string(), // Matches Supabase original_name
    mimeType: v.string(),
    fileSize: v.number(),

    // Soft delete
    deletedAt: v.optional(v.number()),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),

    // Migration tracking
    supabaseId: v.optional(v.string()),
  })
    .index("by_task", ["taskId"])
    .index("by_uploadedBy", ["uploadedBy"])
    .index("by_supabaseId", ["supabaseId"]),

  // ----------------------------------------------------------
  // TIME TRACKING
  // ----------------------------------------------------------

  /**
   * Time logs - Time entries for projects
   * - Can be associated with multiple tasks via timeLogTasks
   * - Field names match Supabase schema exactly for 1:1 migration
   */
  timeLogs: defineTable({
    projectId: v.id("projects"),
    userId: v.id("users"),

    // Time entry (matching Supabase)
    loggedOn: v.string(), // Matches Supabase logged_on (ISO date string)
    hours: v.number(), // Stored as number, Supabase uses numeric
    note: v.optional(v.string()), // Matches Supabase note (not description)

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
    .index("by_loggedOn", ["loggedOn"])
    .index("by_project_loggedOn", ["projectId", "loggedOn"])
    .index("by_user_loggedOn", ["userId", "loggedOn"])
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
   * - Field names match Supabase schema exactly for 1:1 migration
   */
  hourBlocks: defineTable({
    clientId: v.id("clients"),

    // Hours (matching Supabase)
    hoursPurchased: v.number(), // Matches Supabase hours_purchased (decimal)
    invoiceNumber: v.optional(v.string()), // Matches Supabase invoice_number

    // Creator
    createdBy: v.optional(v.id("users")), // Matches Supabase created_by

    // Soft delete
    deletedAt: v.optional(v.number()),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),

    // Migration tracking
    supabaseId: v.optional(v.string()),
  })
    .index("by_client", ["clientId"])
    .index("by_supabaseId", ["supabaseId"]),

  // ----------------------------------------------------------
  // CRM / LEADS
  // ----------------------------------------------------------

  /**
   * Leads - Sales pipeline
   * - Kanban board with status workflow
   * - Field names match Supabase schema exactly for 1:1 migration
   */
  leads: defineTable({
    // Contact info (matching Supabase field names)
    contactName: v.string(), // Matches Supabase contact_name
    contactEmail: v.optional(v.string()), // Matches Supabase contact_email
    contactPhone: v.optional(v.string()), // Matches Supabase contact_phone

    // Company info
    companyName: v.optional(v.string()), // Matches Supabase company_name
    companyWebsite: v.optional(v.string()), // Matches Supabase company_website

    status: leadStatusValidator,
    sourceType: v.optional(leadSourceTypeValidator), // Matches Supabase source_type (nullable)
    sourceDetail: v.optional(v.string()),

    // Notes (stored as any to match Supabase jsonb)
    notes: v.any(), // Matches Supabase notes (jsonb)

    // Ordering
    rank: v.string(), // Matches Supabase rank

    // Assignment
    assigneeId: v.optional(v.id("users")), // Matches Supabase assignee_id

    // Soft delete
    deletedAt: v.optional(v.number()),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),

    // Migration tracking
    supabaseId: v.optional(v.string()),
  })
    .index("by_status", ["status"])
    .index("by_contactEmail", ["contactEmail"])
    .index("by_assignee", ["assigneeId"])
    .index("by_deleted", ["deletedAt"])
    .index("by_supabaseId", ["supabaseId"]),

  /**
   * Contacts - Contact management
   * - Field names match Supabase schema exactly for 1:1 migration
   */
  contacts: defineTable({
    // Contact info (matching Supabase)
    email: v.string(), // Matches Supabase (required, unique)
    name: v.string(), // Matches Supabase name
    phone: v.optional(v.string()), // Matches Supabase phone

    // Creator
    createdBy: v.optional(v.id("users")), // Matches Supabase created_by

    // Soft delete
    deletedAt: v.optional(v.number()),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),

    // Migration tracking
    supabaseId: v.optional(v.string()),
  })
    .index("by_email", ["email"])
    .index("by_deleted", ["deletedAt"])
    .index("by_supabaseId", ["supabaseId"]),

  /**
   * Contact-Client relationships
   * - Field names match Supabase schema exactly for 1:1 migration
   */
  contactClients: defineTable({
    contactId: v.id("contacts"),
    clientId: v.id("clients"),
    isPrimary: v.boolean(), // Matches Supabase is_primary

    // Timestamps
    createdAt: v.number(),

    // Migration tracking
    supabaseId: v.optional(v.string()),
  })
    .index("by_contact", ["contactId"])
    .index("by_client", ["clientId"])
    .index("by_supabaseId", ["supabaseId"]),

  /**
   * Contact-Lead relationships
   * - Field names match Supabase schema exactly for 1:1 migration
   */
  contactLeads: defineTable({
    contactId: v.id("contacts"),
    leadId: v.id("leads"),

    // Timestamps (Supabase only has createdAt)
    createdAt: v.number(),

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
