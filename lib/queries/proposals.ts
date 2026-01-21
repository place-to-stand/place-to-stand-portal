import { and, desc, eq, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import { proposals, users } from '@/lib/db/schema'

export type ProposalStatus = 'DRAFT' | 'SENT' | 'VIEWED' | 'ACCEPTED' | 'REJECTED'

export type Proposal = {
  id: string
  leadId: string | null
  clientId: string | null
  title: string
  docUrl: string | null
  docId: string | null
  templateDocId: string | null
  status: ProposalStatus
  estimatedValue: string | null
  expirationDate: string | null
  sentAt: string | null
  sentToEmail: string | null
  createdBy: string
  createdAt: string
  updatedAt: string
}

export type ProposalWithCreator = Proposal & {
  creator: {
    id: string
    fullName: string | null
    email: string | null
    avatarUrl: string | null
  } | null
}

/**
 * Fetch proposals for a specific lead.
 */
export async function fetchProposalsByLeadId(
  leadId: string
): Promise<ProposalWithCreator[]> {
  const rows = await db
    .select({
      id: proposals.id,
      leadId: proposals.leadId,
      clientId: proposals.clientId,
      title: proposals.title,
      docUrl: proposals.docUrl,
      docId: proposals.docId,
      templateDocId: proposals.templateDocId,
      status: proposals.status,
      estimatedValue: proposals.estimatedValue,
      expirationDate: proposals.expirationDate,
      sentAt: proposals.sentAt,
      sentToEmail: proposals.sentToEmail,
      createdBy: proposals.createdBy,
      createdAt: proposals.createdAt,
      updatedAt: proposals.updatedAt,
      creatorId: users.id,
      creatorFullName: users.fullName,
      creatorEmail: users.email,
      creatorAvatarUrl: users.avatarUrl,
    })
    .from(proposals)
    .leftJoin(users, eq(proposals.createdBy, users.id))
    .where(and(eq(proposals.leadId, leadId), isNull(proposals.deletedAt)))
    .orderBy(desc(proposals.createdAt))

  return rows.map(row => ({
    id: row.id,
    leadId: row.leadId,
    clientId: row.clientId,
    title: row.title,
    docUrl: row.docUrl,
    docId: row.docId,
    templateDocId: row.templateDocId,
    status: row.status,
    estimatedValue: row.estimatedValue,
    expirationDate: row.expirationDate,
    sentAt: row.sentAt,
    sentToEmail: row.sentToEmail,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    creator: row.creatorId
      ? {
          id: row.creatorId,
          fullName: row.creatorFullName,
          email: row.creatorEmail,
          avatarUrl: row.creatorAvatarUrl,
        }
      : null,
  }))
}

/**
 * Fetch a single proposal by ID.
 */
export async function fetchProposalById(
  proposalId: string
): Promise<Proposal | null> {
  const [row] = await db
    .select({
      id: proposals.id,
      leadId: proposals.leadId,
      clientId: proposals.clientId,
      title: proposals.title,
      docUrl: proposals.docUrl,
      docId: proposals.docId,
      templateDocId: proposals.templateDocId,
      status: proposals.status,
      estimatedValue: proposals.estimatedValue,
      expirationDate: proposals.expirationDate,
      sentAt: proposals.sentAt,
      sentToEmail: proposals.sentToEmail,
      createdBy: proposals.createdBy,
      createdAt: proposals.createdAt,
      updatedAt: proposals.updatedAt,
    })
    .from(proposals)
    .where(and(eq(proposals.id, proposalId), isNull(proposals.deletedAt)))
    .limit(1)

  return row ?? null
}

export type CreateProposalInput = {
  leadId?: string | null
  clientId?: string | null
  title: string
  docUrl?: string | null
  docId?: string | null
  templateDocId?: string | null
  status?: ProposalStatus
  estimatedValue?: string | null
  expirationDate?: string | null
  sentAt?: string | null
  sentToEmail?: string | null
  createdBy: string
}

/**
 * Create a new proposal.
 */
export async function createProposal(
  input: CreateProposalInput
): Promise<Proposal> {
  const timestamp = new Date().toISOString()

  const [inserted] = await db
    .insert(proposals)
    .values({
      leadId: input.leadId ?? null,
      clientId: input.clientId ?? null,
      title: input.title,
      docUrl: input.docUrl ?? null,
      docId: input.docId ?? null,
      templateDocId: input.templateDocId ?? null,
      status: input.status ?? 'DRAFT',
      estimatedValue: input.estimatedValue ?? null,
      expirationDate: input.expirationDate ?? null,
      sentAt: input.sentAt ?? null,
      sentToEmail: input.sentToEmail ?? null,
      createdBy: input.createdBy,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .returning()

  return {
    id: inserted.id,
    leadId: inserted.leadId,
    clientId: inserted.clientId,
    title: inserted.title,
    docUrl: inserted.docUrl,
    docId: inserted.docId,
    templateDocId: inserted.templateDocId,
    status: inserted.status,
    estimatedValue: inserted.estimatedValue,
    expirationDate: inserted.expirationDate,
    sentAt: inserted.sentAt,
    sentToEmail: inserted.sentToEmail,
    createdBy: inserted.createdBy,
    createdAt: inserted.createdAt,
    updatedAt: inserted.updatedAt,
  }
}

export type UpdateProposalInput = {
  title?: string
  docUrl?: string | null
  docId?: string | null
  status?: ProposalStatus
  estimatedValue?: string | null
  expirationDate?: string | null
  sentAt?: string | null
  sentToEmail?: string | null
}

/**
 * Update an existing proposal.
 */
export async function updateProposal(
  proposalId: string,
  input: UpdateProposalInput
): Promise<Proposal | null> {
  const timestamp = new Date().toISOString()

  const [updated] = await db
    .update(proposals)
    .set({
      ...input,
      updatedAt: timestamp,
    })
    .where(and(eq(proposals.id, proposalId), isNull(proposals.deletedAt)))
    .returning()

  if (!updated) {
    return null
  }

  return {
    id: updated.id,
    leadId: updated.leadId,
    clientId: updated.clientId,
    title: updated.title,
    docUrl: updated.docUrl,
    docId: updated.docId,
    templateDocId: updated.templateDocId,
    status: updated.status,
    estimatedValue: updated.estimatedValue,
    expirationDate: updated.expirationDate,
    sentAt: updated.sentAt,
    sentToEmail: updated.sentToEmail,
    createdBy: updated.createdBy,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  }
}

/**
 * Soft delete a proposal.
 */
export async function deleteProposal(proposalId: string): Promise<boolean> {
  const timestamp = new Date().toISOString()

  const [deleted] = await db
    .update(proposals)
    .set({ deletedAt: timestamp, updatedAt: timestamp })
    .where(and(eq(proposals.id, proposalId), isNull(proposals.deletedAt)))
    .returning({ id: proposals.id })

  return Boolean(deleted)
}

/**
 * Find a proposal by its Google Doc ID.
 */
export async function findProposalByDocId(
  docId: string
): Promise<Proposal | null> {
  const [row] = await db
    .select({
      id: proposals.id,
      leadId: proposals.leadId,
      clientId: proposals.clientId,
      title: proposals.title,
      docUrl: proposals.docUrl,
      docId: proposals.docId,
      templateDocId: proposals.templateDocId,
      status: proposals.status,
      estimatedValue: proposals.estimatedValue,
      expirationDate: proposals.expirationDate,
      sentAt: proposals.sentAt,
      sentToEmail: proposals.sentToEmail,
      createdBy: proposals.createdBy,
      createdAt: proposals.createdAt,
      updatedAt: proposals.updatedAt,
    })
    .from(proposals)
    .where(and(eq(proposals.docId, docId), isNull(proposals.deletedAt)))
    .limit(1)

  return row ?? null
}
