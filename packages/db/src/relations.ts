import { relations } from 'drizzle-orm/relations'
import {
  users,
  clients,
  tasks,
  githubAppInstallations,
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
  meetings,
  proposals,
  leadStageHistory,
  taskDeployments,
  planningSessions,
  planThreads,
  planRevisions,
  planMessages,
  transcripts,
  productCatalogItems,
  taxRates,
  invoices,
  invoiceLineItems,
  projectSows,
  sowSnapshots,
  sowSections,
} from './schema'

export const clientsRelations = relations(clients, ({ one, many }) => ({
  user: one(users, {
    fields: [clients.createdBy],
    references: [users.id],
    relationName: 'clients_createdBy_users_id',
  }),
  originationContact: one(contacts, {
    fields: [clients.originationContactId],
    references: [contacts.id],
  }),
  originationUser: one(users, {
    fields: [clients.originationUserId],
    references: [users.id],
    relationName: 'clients_originationUser_users_id',
  }),
  closerUser: one(users, {
    fields: [clients.closerUserId],
    references: [users.id],
    relationName: 'clients_closerUser_users_id',
  }),
  hourBlocks: many(hourBlocks),
  clientMembers: many(clientMembers),
  projects: many(projects),
  contactClients: many(contactClients),
  threads: many(threads),
  emailDrafts: many(emailDrafts),
  meetings: many(meetings),
  proposals: many(proposals),
  invoices: many(invoices),
  githubAppInstallations: many(githubAppInstallations),
}))

export const usersRelations = relations(users, ({ many }) => ({
  contactsCreated: many(contacts, {
    relationName: 'contacts_createdBy_users_id',
  }),
  contactsLinked: many(contacts, {
    relationName: 'contacts_userId_users_id',
  }),
  clients: many(clients, {
    relationName: 'clients_createdBy_users_id',
  }),
  clientsOriginated: many(clients, {
    relationName: 'clients_originationUser_users_id',
  }),
  clientsClosed: many(clients, {
    relationName: 'clients_closerUser_users_id',
  }),
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
  threads_createdBy: many(threads, {
    relationName: 'threads_createdBy_users_id',
  }),
  threads_classifiedBy: many(threads, {
    relationName: 'threads_classifiedBy_users_id',
  }),
  messages: many(messages),
  emailDrafts: many(emailDrafts),
  emailTemplates: many(emailTemplates),
  meetings: many(meetings),
  proposals: many(proposals),
  leadStageHistory: many(leadStageHistory),
  invoices: many(invoices),
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
  taskDeployments: many(taskDeployments),
  planningSessions: many(planningSessions),
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
  invoice: one(invoices, {
    fields: [hourBlocks.invoiceId],
    references: [invoices.id],
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
  sows: many(projectSows),
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
    relationName: 'contacts_createdBy_users_id',
  }),
  portalUser: one(users, {
    fields: [contacts.userId],
    references: [users.id],
    relationName: 'contacts_userId_users_id',
  }),
  contactClients: many(contactClients),
  contactLeads: many(contactLeads),
  clientsOriginated: many(clients),
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
    relationName: 'threads_createdBy_users_id',
  }),
  classifiedByUser: one(users, {
    fields: [threads.classifiedBy],
    references: [users.id],
    relationName: 'threads_classifiedBy_users_id',
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

export const githubAppInstallationsRelations = relations(
  githubAppInstallations,
  ({ one, many }) => ({
    client: one(clients, {
      fields: [githubAppInstallations.clientId],
      references: [clients.id],
    }),
    installedByUser: one(users, {
      fields: [githubAppInstallations.installedByUserId],
      references: [users.id],
    }),
    githubRepoLinks: many(githubRepoLinks),
  })
)

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
    githubAppInstallation: one(githubAppInstallations, {
      fields: [githubRepoLinks.githubAppInstallationId],
      references: [githubAppInstallations.id],
    }),
    linkedByUser: one(users, {
      fields: [githubRepoLinks.linkedBy],
      references: [users.id],
    }),
    suggestions: many(suggestions),
    taskDeployments: many(taskDeployments),
  })
)

// =============================================================================
// TASK DEPLOYMENTS
// =============================================================================

export const taskDeploymentsRelations = relations(
  taskDeployments,
  ({ one }) => ({
    task: one(tasks, {
      fields: [taskDeployments.taskId],
      references: [tasks.id],
    }),
    repoLink: one(githubRepoLinks, {
      fields: [taskDeployments.repoLinkId],
      references: [githubRepoLinks.id],
    }),
    createdByUser: one(users, {
      fields: [taskDeployments.createdBy],
      references: [users.id],
    }),
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

// =============================================================================
// AI PLANNING SESSIONS
// =============================================================================

export const planningSessionsRelations = relations(
  planningSessions,
  ({ one, many }) => ({
    task: one(tasks, {
      fields: [planningSessions.taskId],
      references: [tasks.id],
    }),
    repoLink: one(githubRepoLinks, {
      fields: [planningSessions.repoLinkId],
      references: [githubRepoLinks.id],
    }),
    createdByUser: one(users, {
      fields: [planningSessions.createdBy],
      references: [users.id],
    }),
    threads: many(planThreads),
  })
)

export const planThreadsRelations = relations(
  planThreads,
  ({ one, many }) => ({
    session: one(planningSessions, {
      fields: [planThreads.sessionId],
      references: [planningSessions.id],
    }),
    revisions: many(planRevisions),
    messages: many(planMessages),
  })
)

export const planRevisionsRelations = relations(
  planRevisions,
  ({ one }) => ({
    thread: one(planThreads, {
      fields: [planRevisions.threadId],
      references: [planThreads.id],
    }),
  })
)

export const planMessagesRelations = relations(
  planMessages,
  ({ one }) => ({
    thread: one(planThreads, {
      fields: [planMessages.threadId],
      references: [planThreads.id],
    }),
  })
)

// =============================================================================
// TAX RATES
// =============================================================================

export const taxRatesRelations = relations(taxRates, () => ({}))

// =============================================================================
// INVOICING (Invoices, Line Items, Product Catalog)
// =============================================================================

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  client: one(clients, {
    fields: [invoices.clientId],
    references: [clients.id],
  }),
  creator: one(users, {
    fields: [invoices.createdBy],
    references: [users.id],
  }),
  proposal: one(proposals, {
    fields: [invoices.proposalId],
    references: [proposals.id],
  }),
  lineItems: many(invoiceLineItems),
}))

export const invoiceLineItemsRelations = relations(
  invoiceLineItems,
  ({ one }) => ({
    invoice: one(invoices, {
      fields: [invoiceLineItems.invoiceId],
      references: [invoices.id],
    }),
    productCatalogItem: one(productCatalogItems, {
      fields: [invoiceLineItems.productCatalogItemId],
      references: [productCatalogItems.id],
    }),
  })
)

export const productCatalogItemsRelations = relations(
  productCatalogItems,
  ({ many }) => ({
    lineItems: many(invoiceLineItems),
  })
)

// =============================================================================
// SOW (SCOPE OF WORK) INTEGRATION
// =============================================================================

export const projectSowsRelations = relations(
  projectSows,
  ({ one, many }) => ({
    project: one(projects, {
      fields: [projectSows.projectId],
      references: [projects.id],
    }),
    linkedByUser: one(users, {
      fields: [projectSows.linkedBy],
      references: [users.id],
    }),
    snapshots: many(sowSnapshots),
    sections: many(sowSections),
  })
)

export const sowSnapshotsRelations = relations(
  sowSnapshots,
  ({ one, many }) => ({
    sow: one(projectSows, {
      fields: [sowSnapshots.sowId],
      references: [projectSows.id],
    }),
    snappedByUser: one(users, {
      fields: [sowSnapshots.snappedBy],
      references: [users.id],
    }),
    sections: many(sowSections),
  })
)

export const sowSectionsRelations = relations(sowSections, ({ one }) => ({
  snapshot: one(sowSnapshots, {
    fields: [sowSections.snapshotId],
    references: [sowSnapshots.id],
  }),
  sow: one(projectSows, {
    fields: [sowSections.sowId],
    references: [projectSows.id],
  }),
}))

export const transcriptsRelations = relations(transcripts, ({ one }) => ({
  client: one(clients, {
    fields: [transcripts.clientId],
    references: [clients.id],
  }),
  project: one(projects, {
    fields: [transcripts.projectId],
    references: [projects.id],
  }),
  lead: one(leads, {
    fields: [transcripts.leadId],
    references: [leads.id],
  }),
  classifiedByUser: one(users, {
    fields: [transcripts.classifiedBy],
    references: [users.id],
    relationName: 'transcripts_classifiedBy_users_id',
  }),
  syncedByUser: one(users, {
    fields: [transcripts.syncedBy],
    references: [users.id],
    relationName: 'transcripts_syncedBy_users_id',
  }),
}))
