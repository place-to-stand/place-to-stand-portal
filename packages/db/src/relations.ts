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
  githubRepoLinks,
  leadStageHistory,
  taskDeployments,
  planningSessions,
  planThreads,
  planRevisions,
  planMessages,
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
  tasks: many(tasks),
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
