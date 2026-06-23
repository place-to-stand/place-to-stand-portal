import type { InferSelectModel, InferInsertModel } from 'drizzle-orm'
import type {
  users,
  clients,
  projects,
  tasks,
  leads,
  timeLogs,
  hourBlocks,
  taskComments,
  taskAttachments,
  taskAssignees,
  taskAssigneeMetadata,
  clientMembers,
  activityLogs,
  oauthConnections,
  githubRepoLinks,
  githubAppInstallations,
  taskDeployments,
  planningSessions,
  planThreads,
  planRevisions,
  planMessages,
  contacts,
  contactClients,
  contactLeads,
  invoices,
  invoiceLineItems,
  productCatalogItems,
  taxRates,
  timeLogTasks,
  leadStageHistory,
  activityOverviewCache,
} from './schema'

// Select types (for reading from DB)
export type User = InferSelectModel<typeof users>
export type Client = InferSelectModel<typeof clients>
export type Project = InferSelectModel<typeof projects>
export type Task = InferSelectModel<typeof tasks>
export type Lead = InferSelectModel<typeof leads>
export type TimeLog = InferSelectModel<typeof timeLogs>
export type HourBlock = InferSelectModel<typeof hourBlocks>
export type TaskComment = InferSelectModel<typeof taskComments>
export type TaskAttachment = InferSelectModel<typeof taskAttachments>
export type TaskAssignee = InferSelectModel<typeof taskAssignees>
export type TaskAssigneeMetadata = InferSelectModel<typeof taskAssigneeMetadata>
export type ClientMember = InferSelectModel<typeof clientMembers>
export type ActivityLog = InferSelectModel<typeof activityLogs>
export type OauthConnection = InferSelectModel<typeof oauthConnections>
export type GithubAppInstallation = InferSelectModel<typeof githubAppInstallations>
export type GithubRepoLink = InferSelectModel<typeof githubRepoLinks>
export type TaskDeployment = InferSelectModel<typeof taskDeployments>
export type PlanningSession = InferSelectModel<typeof planningSessions>
export type PlanThread = InferSelectModel<typeof planThreads>
export type PlanRevision = InferSelectModel<typeof planRevisions>
export type PlanMessage = InferSelectModel<typeof planMessages>
export type Contact = InferSelectModel<typeof contacts>
export type ContactClient = InferSelectModel<typeof contactClients>
export type ContactLead = InferSelectModel<typeof contactLeads>
export type Invoice = InferSelectModel<typeof invoices>
export type InvoiceLineItem = InferSelectModel<typeof invoiceLineItems>
export type ProductCatalogItem = InferSelectModel<typeof productCatalogItems>
export type TaxRate = InferSelectModel<typeof taxRates>
export type TimeLogTask = InferSelectModel<typeof timeLogTasks>
export type LeadStageHistory = InferSelectModel<typeof leadStageHistory>
export type ActivityOverviewCache = InferSelectModel<typeof activityOverviewCache>

// Insert types (for writing to DB)
export type NewUser = InferInsertModel<typeof users>
export type NewClient = InferInsertModel<typeof clients>
export type NewProject = InferInsertModel<typeof projects>
export type NewTask = InferInsertModel<typeof tasks>
export type NewLead = InferInsertModel<typeof leads>
export type NewTimeLog = InferInsertModel<typeof timeLogs>
export type NewHourBlock = InferInsertModel<typeof hourBlocks>
export type NewTaskComment = InferInsertModel<typeof taskComments>
export type NewTaskAttachment = InferInsertModel<typeof taskAttachments>
export type NewTaskAssignee = InferInsertModel<typeof taskAssignees>
export type NewClientMember = InferInsertModel<typeof clientMembers>
export type NewActivityLog = InferInsertModel<typeof activityLogs>
export type NewOauthConnection = InferInsertModel<typeof oauthConnections>
export type NewGithubAppInstallation = InferInsertModel<typeof githubAppInstallations>
export type NewGithubRepoLink = InferInsertModel<typeof githubRepoLinks>
export type NewTaskDeployment = InferInsertModel<typeof taskDeployments>
export type NewPlanningSession = InferInsertModel<typeof planningSessions>
export type NewContact = InferInsertModel<typeof contacts>
export type NewInvoice = InferInsertModel<typeof invoices>
export type NewInvoiceLineItem = InferInsertModel<typeof invoiceLineItems>
