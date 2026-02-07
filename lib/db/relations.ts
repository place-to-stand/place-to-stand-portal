import { relations } from 'drizzle-orm/relations'
import {
  users,
  clients,
  tasks,
  taskAssignees,
  taskAssigneeMetadata,
  hourBlocks,
  clientMembers,
  projects,
  taskComments,
  timeLogs,
  timeLogTasks,
  taskAttachments,
  activityOverviewCache,
  activityLogs,
  leads,
  oauthConnections,
  contacts,
  contactClients,
  contactLeads,
  threads,
  messages,
  githubRepoLinks,
  suggestions,
  emailDrafts,
  emailTemplates,
  proposalTemplates,
  meetings,
  proposals,
  leadStageHistory,
} from './schema'

export const clientsRelations = relations(clients, ({ one, many }) => ({
  user: one(users, {
    fields: [clients.createdBy],
    references: [users.id],
  }),
  referredByContact: one(contacts, {
    fields: [clients.referredBy],
    references: [contacts.id],
  }),
  hourBlocks: many(hourBlocks),
  clientMembers: many(clientMembers),
  projects: many(projects),
  contactClients: many(contactClients),
  threads: many(threads),
  emailDrafts: many(emailDrafts),
  meetings: many(meetings),
  proposals: many(proposals),
}))

export const usersRelations = relations(users, ({ many }) => ({
  clients: many(clients),
  taskAssignees: many(taskAssignees),
  taskAssigneeMetadata: many(taskAssigneeMetadata),
  hourBlocks: many(hourBlocks),
  clientMembers: many(clientMembers),
  projects: many(projects),
  projectsOwned: many(projects, {
    relationName: 'projects_owner_users_id',
  }),
  taskComments: many(taskComments),
  timeLogs: many(timeLogs),
  taskAttachments: many(taskAttachments),
  activityOverviewCaches: many(activityOverviewCache),
  leads: many(leads),
  tasks_createdBy: many(tasks, {
    relationName: 'tasks_createdBy_users_id',
  }),
  tasks_updatedBy: many(tasks, {
    relationName: 'tasks_updatedBy_users_id',
  }),
  activityLogs: many(activityLogs),
  oauthConnections: many(oauthConnections),
  threads: many(threads),
  messages: many(messages),
  emailDrafts: many(emailDrafts),
  emailTemplates: many(emailTemplates),
  meetings: many(meetings),
  proposals: many(proposals),
  leadStageHistory: many(leadStageHistory),
}))

export const taskAssigneesRelations = relations(taskAssignees, ({ one }) => ({
  task: one(tasks, {
    fields: [taskAssignees.taskId],
    references: [tasks.id],
  }),
  user: one(users, {
    fields: [taskAssignees.userId],
    references: [users.id],
  }),
}))

export const taskAssigneeMetadataRelations = relations(
  taskAssigneeMetadata,
  ({ one }) => ({
    task: one(tasks, {
      fields: [taskAssigneeMetadata.taskId],
      references: [tasks.id],
    }),
    user: one(users, {
      fields: [taskAssigneeMetadata.userId],
      references: [users.id],
    }),
  })
)

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  taskAssignees: many(taskAssignees),
  taskAssigneeMetadata: many(taskAssigneeMetadata),
  taskComments: many(taskComments),
  timeLogTasks: many(timeLogTasks),
  taskAttachments: many(taskAttachments),
  project: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id],
  }),
  lead: one(leads, {
    fields: [tasks.leadId],
    references: [leads.id],
  }),
  user_createdBy: one(users, {
    fields: [tasks.createdBy],
    references: [users.id],
    relationName: 'tasks_createdBy_users_id',
  }),
  user_updatedBy: one(users, {
    fields: [tasks.updatedBy],
    references: [users.id],
    relationName: 'tasks_updatedBy_users_id',
  }),
  suggestions: many(suggestions),
}))

export const leadsRelations = relations(leads, ({ one, many }) => ({
  assignee: one(users, {
    fields: [leads.assigneeId],
    references: [users.id],
  }),
  convertedToClient: one(clients, {
    fields: [leads.convertedToClientId],
    references: [clients.id],
  }),
  contactLeads: many(contactLeads),
  threads: many(threads),
  suggestions: many(suggestions),
  emailDrafts: many(emailDrafts),
  tasks: many(tasks),
  meetings: many(meetings),
  proposals: many(proposals),
  stageHistory: many(leadStageHistory),
}))

export const leadStageHistoryRelations = relations(
  leadStageHistory,
  ({ one }) => ({
    lead: one(leads, {
      fields: [leadStageHistory.leadId],
      references: [leads.id],
    }),
    changedByUser: one(users, {
      fields: [leadStageHistory.changedBy],
      references: [users.id],
    }),
  })
)

export const hourBlocksRelations = relations(hourBlocks, ({ one }) => ({
  user: one(users, {
    fields: [hourBlocks.createdBy],
    references: [users.id],
  }),
  client: one(clients, {
    fields: [hourBlocks.clientId],
    references: [clients.id],
  }),
}))

export const clientMembersRelations = relations(clientMembers, ({ one }) => ({
  client: one(clients, {
    fields: [clientMembers.clientId],
    references: [clients.id],
  }),
  user: one(users, {
    fields: [clientMembers.userId],
    references: [users.id],
  }),
}))

export const projectsRelations = relations(projects, ({ one, many }) => ({
  client: one(clients, {
    fields: [projects.clientId],
    references: [clients.id],
  }),
  user: one(users, {
    fields: [projects.createdBy],
    references: [users.id],
  }),
  owner: one(users, {
    fields: [projects.ownerId],
    references: [users.id],
    relationName: 'projects_owner_users_id',
  }),
  timeLogs: many(timeLogs),
  tasks: many(tasks),
  githubRepos: many(githubRepoLinks),
  threads: many(threads),
  suggestions: many(suggestions),
  emailDrafts: many(emailDrafts),
}))

export const taskCommentsRelations = relations(taskComments, ({ one }) => ({
  task: one(tasks, {
    fields: [taskComments.taskId],
    references: [tasks.id],
  }),
  user: one(users, {
    fields: [taskComments.authorId],
    references: [users.id],
  }),
}))

export const timeLogsRelations = relations(timeLogs, ({ one, many }) => ({
  project: one(projects, {
    fields: [timeLogs.projectId],
    references: [projects.id],
  }),
  user: one(users, {
    fields: [timeLogs.userId],
    references: [users.id],
  }),
  timeLogTasks: many(timeLogTasks),
}))

export const timeLogTasksRelations = relations(timeLogTasks, ({ one }) => ({
  timeLog: one(timeLogs, {
    fields: [timeLogTasks.timeLogId],
    references: [timeLogs.id],
  }),
  task: one(tasks, {
    fields: [timeLogTasks.taskId],
    references: [tasks.id],
  }),
}))

export const taskAttachmentsRelations = relations(
  taskAttachments,
  ({ one }) => ({
    task: one(tasks, {
      fields: [taskAttachments.taskId],
      references: [tasks.id],
    }),
    user: one(users, {
      fields: [taskAttachments.uploadedBy],
      references: [users.id],
    }),
  })
)

export const activityOverviewCacheRelations = relations(
  activityOverviewCache,
  ({ one }) => ({
    user: one(users, {
      fields: [activityOverviewCache.userId],
      references: [users.id],
    }),
  })
)

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  user: one(users, {
    fields: [activityLogs.actorId],
    references: [users.id],
  }),
}))

export const oauthConnectionsRelations = relations(
  oauthConnections,
  ({ one, many }) => ({
    user: one(users, {
      fields: [oauthConnections.userId],
      references: [users.id],
    }),
    githubRepoLinks: many(githubRepoLinks),
    emailDrafts: many(emailDrafts),
  })
)

export const contactsRelations = relations(contacts, ({ one, many }) => ({
  createdByUser: one(users, {
    fields: [contacts.createdBy],
    references: [users.id],
  }),
  contactClients: many(contactClients),
  contactLeads: many(contactLeads),
  clientsReferredBy: many(clients),
}))

export const contactClientsRelations = relations(contactClients, ({ one }) => ({
  contact: one(contacts, {
    fields: [contactClients.contactId],
    references: [contacts.id],
  }),
  client: one(clients, {
    fields: [contactClients.clientId],
    references: [clients.id],
  }),
}))

export const contactLeadsRelations = relations(contactLeads, ({ one }) => ({
  contact: one(contacts, {
    fields: [contactLeads.contactId],
    references: [contacts.id],
  }),
  lead: one(leads, {
    fields: [contactLeads.leadId],
    references: [leads.id],
  }),
}))

// =============================================================================
// THREADS & MESSAGES (Phase 5 - Unified Messaging)
// =============================================================================

export const threadsRelations = relations(threads, ({ one, many }) => ({
  client: one(clients, {
    fields: [threads.clientId],
    references: [clients.id],
  }),
  project: one(projects, {
    fields: [threads.projectId],
    references: [projects.id],
  }),
  lead: one(leads, {
    fields: [threads.leadId],
    references: [leads.id],
  }),
  createdByUser: one(users, {
    fields: [threads.createdBy],
    references: [users.id],
  }),
  messages: many(messages),
  suggestions: many(suggestions),
  emailDrafts: many(emailDrafts),
}))

export const messagesRelations = relations(messages, ({ one, many }) => ({
  thread: one(threads, {
    fields: [messages.threadId],
    references: [threads.id],
  }),
  user: one(users, {
    fields: [messages.userId],
    references: [users.id],
  }),
  suggestions: many(suggestions),
}))


// =============================================================================
// GITHUB INTEGRATION
// =============================================================================

export const githubRepoLinksRelations = relations(
  githubRepoLinks,
  ({ one, many }) => ({
    project: one(projects, {
      fields: [githubRepoLinks.projectId],
      references: [projects.id],
    }),
    oauthConnection: one(oauthConnections, {
      fields: [githubRepoLinks.oauthConnectionId],
      references: [oauthConnections.id],
    }),
    linkedByUser: one(users, {
      fields: [githubRepoLinks.linkedBy],
      references: [users.id],
    }),
    suggestions: many(suggestions),
  })
)

// =============================================================================
// UNIFIED SUGGESTIONS (Phase 5 - Polymorphic)
// =============================================================================

export const suggestionsRelations = relations(suggestions, ({ one }) => ({
  message: one(messages, {
    fields: [suggestions.messageId],
    references: [messages.id],
  }),
  thread: one(threads, {
    fields: [suggestions.threadId],
    references: [threads.id],
  }),
  lead: one(leads, {
    fields: [suggestions.leadId],
    references: [leads.id],
  }),
  project: one(projects, {
    fields: [suggestions.projectId],
    references: [projects.id],
  }),
  reviewedByUser: one(users, {
    fields: [suggestions.reviewedBy],
    references: [users.id],
  }),
  createdTask: one(tasks, {
    fields: [suggestions.createdTaskId],
    references: [tasks.id],
  }),
}))

// =============================================================================
// EMAIL DRAFTS (Compose, Reply, Forward, Scheduled Send)
// =============================================================================

export const emailDraftsRelations = relations(emailDrafts, ({ one }) => ({
  user: one(users, {
    fields: [emailDrafts.userId],
    references: [users.id],
  }),
  connection: one(oauthConnections, {
    fields: [emailDrafts.connectionId],
    references: [oauthConnections.id],
  }),
  thread: one(threads, {
    fields: [emailDrafts.threadId],
    references: [threads.id],
  }),
  lead: one(leads, {
    fields: [emailDrafts.leadId],
    references: [leads.id],
  }),
  client: one(clients, {
    fields: [emailDrafts.clientId],
    references: [clients.id],
  }),
  project: one(projects, {
    fields: [emailDrafts.projectId],
    references: [projects.id],
  }),
}))

// =============================================================================
// EMAIL TEMPLATES
// =============================================================================

export const emailTemplatesRelations = relations(emailTemplates, ({ one }) => ({
  createdByUser: one(users, {
    fields: [emailTemplates.createdBy],
    references: [users.id],
  }),
}))

// =============================================================================
// MEETINGS (Lead & Client meetings)
// =============================================================================

export const meetingsRelations = relations(meetings, ({ one }) => ({
  lead: one(leads, {
    fields: [meetings.leadId],
    references: [leads.id],
  }),
  client: one(clients, {
    fields: [meetings.clientId],
    references: [clients.id],
  }),
  createdByUser: one(users, {
    fields: [meetings.createdBy],
    references: [users.id],
  }),
}))

// =============================================================================
// PROPOSALS (Lead & Client proposals)
// =============================================================================

export const proposalsRelations = relations(proposals, ({ one }) => ({
  lead: one(leads, {
    fields: [proposals.leadId],
    references: [leads.id],
  }),
  client: one(clients, {
    fields: [proposals.clientId],
    references: [clients.id],
  }),
  createdByUser: one(users, {
    fields: [proposals.createdBy],
    references: [users.id],
  }),
}))
