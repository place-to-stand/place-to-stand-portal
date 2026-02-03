'use server'

import { and, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { leads, users } from '@/lib/db/schema'
import {
  copyDocument,
  replaceTextInDocument,
  getDocUrl,
  extractDocIdFromUrl,
} from '@/lib/google/docs'
import {
  createProposal as createProposalRecord,
  type Proposal,
} from '@/lib/queries/proposals'

import { logActivity } from '@/lib/activity/logger'
import { proposalCreatedEvent } from '@/lib/activity/events'
import { revalidateLeadsPath } from './utils'
import type { LeadActionResult } from './types'

const createProposalSchema = z.object({
  leadId: z.string().uuid(),
  /** Google Doc URL or ID to use as template */
  templateDocUrl: z.string().min(1, 'Template document URL is required'),
  /** Title for the new proposal document */
  title: z.string().trim().min(1, 'Proposal title is required').max(200),
  /** Optional estimated value for the proposal */
  estimatedValue: z.number().optional(),
  /** Optional expiration date for the proposal */
  expirationDate: z.string().datetime().optional(),
})

export type CreateProposalInput = z.infer<typeof createProposalSchema>

export type CreateProposalResult = LeadActionResult & {
  proposal?: Proposal
  warning?: string
}

export async function createProposal(
  input: CreateProposalInput
): Promise<CreateProposalResult> {
  const user = await requireUser()
  if (!user) return { success: false, error: 'Unauthorized' }
  assertAdmin(user)

  const parsed = createProposalSchema.safeParse(input)

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid proposal payload.',
    }
  }

  const { leadId, templateDocUrl, title, estimatedValue, expirationDate } = parsed.data

  // Extract template doc ID
  const templateDocId = extractDocIdFromUrl(templateDocUrl)

  if (!templateDocId) {
    return {
      success: false,
      error: 'Invalid Google Doc URL. Please provide a valid document URL.',
    }
  }

  // Fetch the lead with full details for variable substitution
  const leadRows = await db
    .select({
      id: leads.id,
      contactName: leads.contactName,
      contactEmail: leads.contactEmail,
      companyName: leads.companyName,
    })
    .from(leads)
    .where(and(eq(leads.id, leadId), isNull(leads.deletedAt)))
    .limit(1)

  const lead = leadRows[0]

  if (!lead) {
    return { success: false, error: 'Lead not found.' }
  }

  // Get user info for sender variables
  const userRows = await db
    .select({
      fullName: users.fullName,
      email: users.email,
    })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1)

  const senderUser = userRows[0]

  // Copy the template document
  let newDoc

  try {
    newDoc = await copyDocument(user.id, {
      sourceDocId: templateDocId,
      name: title,
    })
  } catch (error) {
    console.error('Failed to copy template document', error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to copy template document. Please check your Google connection.',
    }
  }

  // Build template variable replacements
  const firstName = lead.contactName.split(' ')[0] ?? lead.contactName
  const now = new Date()

  const replacements: Record<string, string> = {
    '{{contact_name}}': lead.contactName,
    '{{first_name}}': firstName,
    '{{company_name}}': lead.companyName ?? '',
    '{{sender_name}}': senderUser?.fullName ?? 'Team',
    '{{sender_email}}': senderUser?.email ?? '',
    '{{proposal_date}}': now.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
  }

  if (expirationDate) {
    const expDate = new Date(expirationDate)
    replacements['{{expiration_date}}'] = expDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  if (estimatedValue !== undefined) {
    replacements['{{proposed_value}}'] = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(estimatedValue)
  }

  // Replace template variables - track if this fails for user warning
  let templateReplacementFailed = false
  try {
    await replaceTextInDocument(user.id, {
      docId: newDoc.id,
      replacements,
    })
  } catch (error) {
    console.error('Failed to replace template variables', error)
    templateReplacementFailed = true
    // Continue - doc was created, variables just weren't replaced
  }

  // Build and save the proposal record
  let proposal: Proposal

  try {
    proposal = await createProposalRecord({
      leadId,
      title,
      docUrl: getDocUrl(newDoc.id),
      docId: newDoc.id,
      templateDocId,
      status: 'DRAFT',
      estimatedValue: estimatedValue !== undefined ? String(estimatedValue) : null,
      expirationDate: expirationDate ?? null,
      createdBy: user.id,
    })
  } catch (error) {
    console.error('Failed to save proposal to database', error)
    return {
      success: false,
      error: 'Proposal was created but failed to save to database.',
    }
  }

  // Log activity
  const event = proposalCreatedEvent({
    title,
    leadName: lead.contactName,
    estimatedValue: estimatedValue !== undefined ? String(estimatedValue) : null,
  })
  await logActivity({
    actorId: user.id,
    verb: event.verb,
    summary: event.summary,
    targetType: 'PROPOSAL',
    targetId: proposal.id,
    metadata: event.metadata,
  })

  revalidateLeadsPath()

  return {
    success: true,
    proposal,
    warning: templateReplacementFailed
      ? 'Proposal created but template variables could not be replaced. Please edit the document manually.'
      : undefined,
  }
}
