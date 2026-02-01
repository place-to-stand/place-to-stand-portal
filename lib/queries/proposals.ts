import { and, desc, eq, isNull, isNotNull, sql, inArray } from 'drizzle-orm'

import { db } from '@/lib/db'
import { proposals, users, leads, clients } from '@/lib/db/schema'
import type { ProposalContent } from '@/lib/proposals/types'

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
  content: ProposalContent | Record<string, never>
  createdBy: string
  createdAt: string
  updatedAt: string
  shareToken: string | null
  sharePasswordHash: string | null
  shareEnabled: boolean | null
  viewedAt: string | null
  viewedCount: number | null
  acceptedAt: string | null
  rejectedAt: string | null
  clientComment: string | null
  signerName: string | null
  signerEmail: string | null
  signatureData: string | null
  signerIpAddress: string | null
  signatureConsent: boolean | null
  contentHashAtSigning: string | null
  countersignToken: string | null
  countersignerName: string | null
  countersignerEmail: string | null
  countersignatureData: string | null
  countersignerIpAddress: string | null
  countersignatureConsent: boolean | null
  countersignedAt: string | null
  executedPdfPath: string | null
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
      content: proposals.content,
      shareToken: proposals.shareToken,
      sharePasswordHash: proposals.sharePasswordHash,
      shareEnabled: proposals.shareEnabled,
      viewedAt: proposals.viewedAt,
      viewedCount: proposals.viewedCount,
      acceptedAt: proposals.acceptedAt,
      rejectedAt: proposals.rejectedAt,
      clientComment: proposals.clientComment,
      signerName: proposals.signerName,
      signerEmail: proposals.signerEmail,
      signatureData: proposals.signatureData,
      signerIpAddress: proposals.signerIpAddress,
      signatureConsent: proposals.signatureConsent,
      contentHashAtSigning: proposals.contentHashAtSigning,
      countersignToken: proposals.countersignToken,
      countersignerName: proposals.countersignerName,
      countersignerEmail: proposals.countersignerEmail,
      countersignatureData: proposals.countersignatureData,
      countersignerIpAddress: proposals.countersignerIpAddress,
      countersignatureConsent: proposals.countersignatureConsent,
      countersignedAt: proposals.countersignedAt,
      executedPdfPath: proposals.executedPdfPath,
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
    content: row.content as ProposalContent | Record<string, never>,
    shareToken: row.shareToken,
    sharePasswordHash: row.sharePasswordHash,
    shareEnabled: row.shareEnabled,
    viewedAt: row.viewedAt,
    viewedCount: row.viewedCount,
    acceptedAt: row.acceptedAt,
    rejectedAt: row.rejectedAt,
    clientComment: row.clientComment,
    signerName: row.signerName,
    signerEmail: row.signerEmail,
    signatureData: row.signatureData,
    signerIpAddress: row.signerIpAddress,
    signatureConsent: row.signatureConsent,
    contentHashAtSigning: row.contentHashAtSigning,
    countersignToken: row.countersignToken,
    countersignerName: row.countersignerName,
    countersignerEmail: row.countersignerEmail,
    countersignatureData: row.countersignatureData,
    countersignerIpAddress: row.countersignerIpAddress,
    countersignatureConsent: row.countersignatureConsent,
    countersignedAt: row.countersignedAt,
    executedPdfPath: row.executedPdfPath,
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
      content: proposals.content,
      shareToken: proposals.shareToken,
      sharePasswordHash: proposals.sharePasswordHash,
      shareEnabled: proposals.shareEnabled,
      viewedAt: proposals.viewedAt,
      viewedCount: proposals.viewedCount,
      acceptedAt: proposals.acceptedAt,
      rejectedAt: proposals.rejectedAt,
      clientComment: proposals.clientComment,
      signerName: proposals.signerName,
      signerEmail: proposals.signerEmail,
      signatureData: proposals.signatureData,
      signerIpAddress: proposals.signerIpAddress,
      signatureConsent: proposals.signatureConsent,
      contentHashAtSigning: proposals.contentHashAtSigning,
      countersignToken: proposals.countersignToken,
      countersignerName: proposals.countersignerName,
      countersignerEmail: proposals.countersignerEmail,
      countersignatureData: proposals.countersignatureData,
      countersignerIpAddress: proposals.countersignerIpAddress,
      countersignatureConsent: proposals.countersignatureConsent,
      countersignedAt: proposals.countersignedAt,
      executedPdfPath: proposals.executedPdfPath,
      createdBy: proposals.createdBy,
      createdAt: proposals.createdAt,
      updatedAt: proposals.updatedAt,
    })
    .from(proposals)
    .where(and(eq(proposals.id, proposalId), isNull(proposals.deletedAt)))
    .limit(1)

  if (!row) return null

  return {
    ...row,
    content: row.content as ProposalContent | Record<string, never>,
  }
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
  content?: ProposalContent | Record<string, never>
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
      content: input.content ?? {},
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
    content: inserted.content as ProposalContent | Record<string, never>,
    shareToken: inserted.shareToken,
    sharePasswordHash: inserted.sharePasswordHash,
    shareEnabled: inserted.shareEnabled,
    viewedAt: inserted.viewedAt,
    viewedCount: inserted.viewedCount,
    acceptedAt: inserted.acceptedAt,
    rejectedAt: inserted.rejectedAt,
    clientComment: inserted.clientComment,
    signerName: inserted.signerName,
    signerEmail: inserted.signerEmail,
    signatureData: inserted.signatureData,
    signerIpAddress: inserted.signerIpAddress,
    signatureConsent: inserted.signatureConsent,
    contentHashAtSigning: inserted.contentHashAtSigning,
    countersignToken: inserted.countersignToken,
    countersignerName: inserted.countersignerName,
    countersignerEmail: inserted.countersignerEmail,
    countersignatureData: inserted.countersignatureData,
    countersignerIpAddress: inserted.countersignerIpAddress,
    countersignatureConsent: inserted.countersignatureConsent,
    countersignedAt: inserted.countersignedAt,
    executedPdfPath: inserted.executedPdfPath,
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
  content?: ProposalContent | Record<string, never>
  shareToken?: string | null
  sharePasswordHash?: string | null
  shareEnabled?: boolean
  viewedAt?: string | null
  viewedCount?: number
  acceptedAt?: string | null
  rejectedAt?: string | null
  clientComment?: string | null
  contentHashAtSigning?: string | null
  countersignToken?: string | null
  executedPdfPath?: string | null
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
    content: updated.content as ProposalContent | Record<string, never>,
    shareToken: updated.shareToken,
    sharePasswordHash: updated.sharePasswordHash,
    shareEnabled: updated.shareEnabled,
    viewedAt: updated.viewedAt,
    viewedCount: updated.viewedCount,
    acceptedAt: updated.acceptedAt,
    rejectedAt: updated.rejectedAt,
    clientComment: updated.clientComment,
    signerName: updated.signerName,
    signerEmail: updated.signerEmail,
    signatureData: updated.signatureData,
    signerIpAddress: updated.signerIpAddress,
    signatureConsent: updated.signatureConsent,
    contentHashAtSigning: updated.contentHashAtSigning,
    countersignToken: updated.countersignToken,
    countersignerName: updated.countersignerName,
    countersignerEmail: updated.countersignerEmail,
    countersignatureData: updated.countersignatureData,
    countersignerIpAddress: updated.countersignerIpAddress,
    countersignatureConsent: updated.countersignatureConsent,
    countersignedAt: updated.countersignedAt,
    executedPdfPath: updated.executedPdfPath,
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
      content: proposals.content,
      shareToken: proposals.shareToken,
      sharePasswordHash: proposals.sharePasswordHash,
      shareEnabled: proposals.shareEnabled,
      viewedAt: proposals.viewedAt,
      viewedCount: proposals.viewedCount,
      acceptedAt: proposals.acceptedAt,
      rejectedAt: proposals.rejectedAt,
      clientComment: proposals.clientComment,
      signerName: proposals.signerName,
      signerEmail: proposals.signerEmail,
      signatureData: proposals.signatureData,
      signerIpAddress: proposals.signerIpAddress,
      signatureConsent: proposals.signatureConsent,
      contentHashAtSigning: proposals.contentHashAtSigning,
      countersignToken: proposals.countersignToken,
      countersignerName: proposals.countersignerName,
      countersignerEmail: proposals.countersignerEmail,
      countersignatureData: proposals.countersignatureData,
      countersignerIpAddress: proposals.countersignerIpAddress,
      countersignatureConsent: proposals.countersignatureConsent,
      countersignedAt: proposals.countersignedAt,
      executedPdfPath: proposals.executedPdfPath,
      createdBy: proposals.createdBy,
      createdAt: proposals.createdAt,
      updatedAt: proposals.updatedAt,
    })
    .from(proposals)
    .where(and(eq(proposals.docId, docId), isNull(proposals.deletedAt)))
    .limit(1)

  if (!row) return null

  return {
    ...row,
    content: row.content as ProposalContent | Record<string, never>,
  }
}

// =============================================================================
// Sharing queries
// =============================================================================

/**
 * Fetch a proposal by its public share token.
 * Only returns if sharing is enabled and not soft-deleted.
 */
export async function fetchProposalByShareToken(
  token: string
): Promise<Proposal | null> {
  const [row] = await db
    .select()
    .from(proposals)
    .where(
      and(
        eq(proposals.shareToken, token),
        eq(proposals.shareEnabled, true),
        isNull(proposals.deletedAt)
      )
    )
    .limit(1)

  if (!row) return null

  return {
    ...row,
    content: row.content as ProposalContent | Record<string, never>,
  }
}

/**
 * Record a view on a shared proposal. Increments count and sets viewed_at.
 * Also updates status to VIEWED if currently SENT.
 */
export async function recordProposalView(proposalId: string): Promise<number> {
  const now = new Date().toISOString()

  // Get current count before incrementing
  const [current] = await db
    .select({ viewedCount: proposals.viewedCount })
    .from(proposals)
    .where(eq(proposals.id, proposalId))
    .limit(1)

  const previousCount = current?.viewedCount ?? 0

  await db
    .update(proposals)
    .set({
      viewedAt: now,
      viewedCount: sql`COALESCE(${proposals.viewedCount}, 0) + 1`,
      updatedAt: now,
    })
    .where(eq(proposals.id, proposalId))

  // Upgrade status from SENT → VIEWED
  await db
    .update(proposals)
    .set({ status: 'VIEWED', updatedAt: now })
    .where(and(eq(proposals.id, proposalId), eq(proposals.status, 'SENT')))

  return previousCount
}

/**
 * Record a client's accept/reject response on a shared proposal.
 */
export type SignatureData = {
  signerName: string
  signerEmail: string
  signatureData: string
  signerIpAddress: string
  signatureConsent: boolean
}

export async function recordProposalResponse(
  proposalId: string,
  action: 'ACCEPTED' | 'REJECTED',
  comment?: string | null,
  signature?: SignatureData | null
): Promise<Proposal | null> {
  const now = new Date().toISOString()

  const [updated] = await db
    .update(proposals)
    .set({
      status: action,
      ...(action === 'ACCEPTED' ? { acceptedAt: now } : { rejectedAt: now }),
      clientComment: comment ?? null,
      ...(signature
        ? {
            signerName: signature.signerName,
            signerEmail: signature.signerEmail,
            signatureData: signature.signatureData,
            signerIpAddress: signature.signerIpAddress,
            signatureConsent: signature.signatureConsent,
          }
        : {}),
      updatedAt: now,
    })
    .where(
      and(
        eq(proposals.id, proposalId),
        isNull(proposals.deletedAt),
        isNull(proposals.acceptedAt),
        isNull(proposals.rejectedAt)
      )
    )
    .returning()

  if (!updated) return null

  return {
    ...updated,
    content: updated.content as ProposalContent | Record<string, never>,
  }
}

// =============================================================================
// Dashboard queries
// =============================================================================

export type ProposalWithRelations = Proposal & {
  leadName: string | null
  clientName: string | null
  creatorName: string | null
}

/**
 * Fetch all proposals for the dashboard with lead/client/creator names.
 */
export async function fetchAllProposals(
  statusFilter?: ProposalStatus[]
): Promise<ProposalWithRelations[]> {
  const conditions = [isNull(proposals.deletedAt)]

  if (statusFilter && statusFilter.length > 0) {
    conditions.push(inArray(proposals.status, statusFilter))
  }

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
      content: proposals.content,
      shareToken: proposals.shareToken,
      sharePasswordHash: proposals.sharePasswordHash,
      shareEnabled: proposals.shareEnabled,
      viewedAt: proposals.viewedAt,
      viewedCount: proposals.viewedCount,
      acceptedAt: proposals.acceptedAt,
      rejectedAt: proposals.rejectedAt,
      clientComment: proposals.clientComment,
      signerName: proposals.signerName,
      signerEmail: proposals.signerEmail,
      signatureData: proposals.signatureData,
      signerIpAddress: proposals.signerIpAddress,
      signatureConsent: proposals.signatureConsent,
      contentHashAtSigning: proposals.contentHashAtSigning,
      countersignToken: proposals.countersignToken,
      countersignerName: proposals.countersignerName,
      countersignerEmail: proposals.countersignerEmail,
      countersignatureData: proposals.countersignatureData,
      countersignerIpAddress: proposals.countersignerIpAddress,
      countersignatureConsent: proposals.countersignatureConsent,
      countersignedAt: proposals.countersignedAt,
      executedPdfPath: proposals.executedPdfPath,
      createdBy: proposals.createdBy,
      createdAt: proposals.createdAt,
      updatedAt: proposals.updatedAt,
      leadName: leads.contactName,
      clientName: clients.name,
      creatorName: users.fullName,
    })
    .from(proposals)
    .leftJoin(leads, eq(proposals.leadId, leads.id))
    .leftJoin(clients, eq(proposals.clientId, clients.id))
    .leftJoin(users, eq(proposals.createdBy, users.id))
    .where(and(...conditions))
    .orderBy(desc(proposals.createdAt))

  return rows.map(row => ({
    ...row,
    content: row.content as ProposalContent | Record<string, never>,
  }))
}

// =============================================================================
// Countersign queries
// =============================================================================

/**
 * Fetch a proposal by its countersign token.
 */
export async function fetchProposalByCountersignToken(
  token: string
): Promise<Proposal | null> {
  const [row] = await db
    .select()
    .from(proposals)
    .where(
      and(
        eq(proposals.countersignToken, token),
        isNull(proposals.deletedAt)
      )
    )
    .limit(1)

  if (!row) return null

  return {
    ...row,
    content: row.content as ProposalContent | Record<string, never>,
  }
}

export type CountersignatureData = {
  countersignerName: string
  countersignerEmail: string
  countersignatureData: string
  countersignerIpAddress: string
  countersignatureConsent: boolean
}

/**
 * Record a countersignature on an accepted proposal.
 */
export async function recordCountersignature(
  proposalId: string,
  data: CountersignatureData
): Promise<Proposal | null> {
  const now = new Date().toISOString()

  const [updated] = await db
    .update(proposals)
    .set({
      countersignerName: data.countersignerName,
      countersignerEmail: data.countersignerEmail,
      countersignatureData: data.countersignatureData,
      countersignerIpAddress: data.countersignerIpAddress,
      countersignatureConsent: data.countersignatureConsent,
      countersignedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(proposals.id, proposalId),
        eq(proposals.status, 'ACCEPTED'),
        isNull(proposals.countersignedAt),
        isNull(proposals.deletedAt)
      )
    )
    .returning()

  if (!updated) return null

  return {
    ...updated,
    content: updated.content as ProposalContent | Record<string, never>,
  }
}
