import { relations } from 'drizzle-orm/relations'
import {
  users,
  billingTerms,
  commissionTerms,
  commissionTermClosers,
  monthlyCloseSnapshots,
  tasks,
  githubAppInstallations,
  taskAssignees,
  taskAssigneeMetadata,
  hourBlocks,
  projects,
  taskComments,
  timeLogs,
  timeLogTasks,
  taskAttachments,
  activityOverviewCache,
  activityLogs,
  leads,
  oauthConnections,
  userDashboardLayouts,
  notifications,
  contacts,
  companies,
  projectMembers,
  memberships,
  githubRepoLinks,
  projectIntegrationLinks,
  leadStageHistory,
  leadUpdates,
  clientUpdates,
  taskDeployments,
  planningSessions,
  planThreads,
  planRevisions,
  planMessages,
  productCatalogItems,
  taxRates,
  invoices,
  invoiceLineItems,
  formSubmissions,
} from './schema'


export const usersRelations = relations(users, ({ one, many }) => ({
  contactsCreated: many(contacts, {
    relationName: 'contacts_createdBy_users_id',
  }),
  contactsLinked: many(contacts, {
    relationName: 'contacts_userId_users_id',
  }),
  taskAssignees: many(taskAssignees),
  taskAssigneeMetadata: many(taskAssigneeMetadata),
  hourBlocks: many(hourBlocks),
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
  dashboardLayout: one(userDashboardLayouts),
  leadStageHistory: many(leadStageHistory),
  leadUpdates: many(leadUpdates),
  clientUpdatesCreated: many(clientUpdates, {
    relationName: 'client_updates_createdBy_users_id',
  }),
  clientUpdatesSent: many(clientUpdates, {
    relationName: 'client_updates_sentBy_users_id',
  }),
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
  contact: one(contacts, {
    fields: [leads.contactId],
    references: [contacts.id],
    relationName: 'leads_contactId_contacts_id',
  }),
  assignee: one(users, {
    fields: [leads.assigneeId],
    references: [users.id],
  }),
  company: one(companies, {
    fields: [leads.companyId],
    references: [companies.id],
  }),
  tasks: many(tasks),
  stageHistory: many(leadStageHistory),
  updates: many(leadUpdates),
}))

export const leadUpdatesRelations = relations(leadUpdates, ({ one }) => ({
  lead: one(leads, {
    fields: [leadUpdates.leadId],
    references: [leads.id],
  }),
  author: one(users, {
    fields: [leadUpdates.authorId],
    references: [users.id],
  }),
}))

export const clientUpdatesRelations = relations(clientUpdates, ({ one }) => ({
  company: one(companies, {
    fields: [clientUpdates.companyId],
    references: [companies.id],
  }),
  createdBy: one(users, {
    fields: [clientUpdates.createdById],
    references: [users.id],
    relationName: 'client_updates_createdBy_users_id',
  }),
  sentBy: one(users, {
    fields: [clientUpdates.sentById],
    references: [users.id],
    relationName: 'client_updates_sentBy_users_id',
  }),
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
  company: one(companies, {
    fields: [hourBlocks.companyId],
    references: [companies.id],
  }),
  invoiceLineItem: one(invoiceLineItems, {
    fields: [hourBlocks.invoiceLineItemId],
    references: [invoiceLineItems.id],
  }),
}))

export const monthlyCloseSnapshotsRelations = relations(
  monthlyCloseSnapshots,
  ({ one }) => ({
    closedByUser: one(users, {
      fields: [monthlyCloseSnapshots.closedBy],
      references: [users.id],
    }),
  })
)

export const billingTermsRelations = relations(
  billingTerms,
  ({ one }) => ({
    company: one(companies, {
      fields: [billingTerms.companyId],
      references: [companies.id],
    }),
    createdByUser: one(users, {
      fields: [billingTerms.createdBy],
      references: [users.id],
    }),
  })
)

export const commissionTermsRelations = relations(
  commissionTerms,
  ({ one, many }) => ({
    company: one(companies, {
      fields: [commissionTerms.companyId],
      references: [companies.id],
    }),
    closers: many(commissionTermClosers),
    originationUser: one(users, {
      fields: [commissionTerms.originationUserId],
      references: [users.id],
    }),
    originationContact: one(contacts, {
      fields: [commissionTerms.originationContactId],
      references: [contacts.id],
    }),
    createdByUser: one(users, {
      fields: [commissionTerms.createdBy],
      references: [users.id],
    }),
  })
)

export const commissionTermClosersRelations = relations(
  commissionTermClosers,
  ({ one }) => ({
    term: one(commissionTerms, {
      fields: [commissionTermClosers.termId],
      references: [commissionTerms.id],
    }),
    closerUser: one(users, {
      fields: [commissionTermClosers.closerUserId],
      references: [users.id],
    }),
    closerContact: one(contacts, {
      fields: [commissionTermClosers.closerContactId],
      references: [contacts.id],
    }),
  })
)

export const projectsRelations = relations(projects, ({ one, many }) => ({
  company: one(companies, {
    fields: [projects.companyId],
    references: [companies.id],
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
  members: many(projectMembers),
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
  memberships: many(memberships),
}))

export const companiesRelations = relations(companies, ({ one, many }) => ({
  createdByUser: one(users, {
    fields: [companies.createdBy],
    references: [users.id],
    relationName: 'companies_createdBy_users_id',
  }),
  billingTerms: many(billingTerms),
  commissionTerms: many(commissionTerms),
  memberships: many(memberships),
  leads: many(leads),
}))

export const projectMembersRelations = relations(projectMembers, ({ one }) => ({
  project: one(projects, {
    fields: [projectMembers.projectId],
    references: [projects.id],
  }),
  user: one(users, {
    fields: [projectMembers.userId],
    references: [users.id],
    relationName: 'projectMembers_userId_users_id',
  }),
}))

export const membershipsRelations = relations(memberships, ({ one }) => ({
  contact: one(contacts, {
    fields: [memberships.contactId],
    references: [contacts.id],
  }),
  company: one(companies, {
    fields: [memberships.companyId],
    references: [companies.id],
  }),
}))

// =============================================================================
// GITHUB INTEGRATION
// =============================================================================

export const githubAppInstallationsRelations = relations(
  githubAppInstallations,
  ({ one, many }) => ({
    company: one(companies, {
      fields: [githubAppInstallations.companyId],
      references: [companies.id],
    }),
    installedByUser: one(users, {
      fields: [githubAppInstallations.installedByUserId],
      references: [users.id],
    }),
    githubRepoLinks: many(githubRepoLinks),
    integrationLinks: many(projectIntegrationLinks),
  })
)

export const projectIntegrationLinksRelations = relations(
  projectIntegrationLinks,
  ({ one }) => ({
    project: one(projects, {
      fields: [projectIntegrationLinks.projectId],
      references: [projects.id],
    }),
    linkedByUser: one(users, {
      fields: [projectIntegrationLinks.linkedBy],
      references: [users.id],
    }),
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
  company: one(companies, {
    fields: [invoices.companyId],
    references: [companies.id],
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

export const formSubmissionsRelations = relations(formSubmissions, ({ one }) => ({
  acknowledgedByUser: one(users, {
    fields: [formSubmissions.acknowledgedBy],
    references: [users.id],
  }),
}))

export const userDashboardLayoutsRelations = relations(
  userDashboardLayouts,
  ({ one }) => ({
    user: one(users, {
      fields: [userDashboardLayouts.userId],
      references: [users.id],
    }),
  })
)

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
    relationName: 'notifications_userId_users_id',
  }),
  actor: one(users, {
    fields: [notifications.actorId],
    references: [users.id],
    relationName: 'notifications_actorId_users_id',
  }),
}))
