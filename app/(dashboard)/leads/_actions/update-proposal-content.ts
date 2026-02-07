'use server'

import { and, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { addDays, format } from 'date-fns'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { proposals } from '@/lib/db/schema'
import { updateProposal, type Proposal } from '@/lib/queries/proposals'
import {
  DEFAULT_HOURLY_RATE,
  DEFAULT_KICKOFF_DAYS,
  DEFAULT_PROPOSAL_VALIDITY_DAYS,
} from '@/lib/proposals/constants'
import type { ProposalContent, ProposalRisk } from '@/lib/proposals/types'

import type { LeadActionResult } from './types'

// =============================================================================
// Schema
// =============================================================================

const phaseSchema = z.object({
  index: z.number().int().min(1),
  title: z.string().min(1),
  purpose: z.string().min(1),
  deliverables: z.array(z.string().min(1)).min(1),
})

const riskSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
})

const termsSectionSchema = z.object({
  title: z.string(),
  content: z.string(),
})

const updateProposalContentSchema = z.object({
  proposalId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  clientCompany: z.string().trim().min(1),
  clientContactName: z.string().trim().min(1),
  clientContactEmail: z.string().email(),
  clientContact2Name: z.string().trim().optional(),
  clientContact2Email: z.string().email().optional().or(z.literal('')),
  clientSignatoryName: z.string().trim().optional(),
  projectOverviewText: z.string().min(10),
  phases: z.array(phaseSchema).min(1),
  risks: z.array(riskSchema),
  includeFullTerms: z.boolean().default(false),
  termsContent: z.array(termsSectionSchema).optional(),
  termsTemplateId: z.string().uuid().optional(),
  hourlyRate: z.number().min(0).default(200),
  initialCommitmentDescription: z.string().min(1),
  estimatedScopingHours: z.string().min(1),
  proposalValidUntil: z.string().datetime().optional(),
  kickoffDays: z.number().int().min(1).default(10),
  estimatedValue: z.number().min(0).optional(),
})

export type UpdateProposalContentInput = z.infer<typeof updateProposalContentSchema>

export type UpdateProposalContentResult = LeadActionResult & {
  proposal?: Proposal
}

// =============================================================================
// Action
// =============================================================================

export async function updateProposalContent(
  input: UpdateProposalContentInput
): Promise<UpdateProposalContentResult> {
  const user = await requireUser()
  if (!user) return { success: false, error: 'Unauthorized' }
  assertAdmin(user)

  const parsed = updateProposalContentSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid proposal payload.',
    }
  }

  const data = parsed.data

  // Verify proposal exists and is editable (DRAFT only)
  const [existing] = await db
    .select({ id: proposals.id, status: proposals.status })
    .from(proposals)
    .where(and(eq(proposals.id, data.proposalId), isNull(proposals.deletedAt)))
    .limit(1)

  if (!existing) {
    return { success: false, error: 'Proposal not found.' }
  }

  if (existing.status !== 'DRAFT') {
    return { success: false, error: 'Only draft proposals can be edited.' }
  }

  // Build updated content
  const risks: ProposalRisk[] = data.risks.length > 0 ? data.risks : []

  const proposalValidUntil = data.proposalValidUntil
    ? data.proposalValidUntil
    : addDays(new Date(), DEFAULT_PROPOSAL_VALIDITY_DAYS).toISOString()

  const content: ProposalContent = {
    client: {
      companyName: data.clientCompany,
      contactName: data.clientContactName,
      contactEmail: data.clientContactEmail,
      contact2Name: data.clientContact2Name || undefined,
      contact2Email: data.clientContact2Email || undefined,
      signatoryName: data.clientSignatoryName || undefined,
    },
    projectOverviewText: data.projectOverviewText,
    phases: data.phases.map((p, i) => ({
      ...p,
      index: i + 1,
    })),
    risks,
    includeFullTerms: data.includeFullTerms,
    termsContent: data.termsContent,
    termsTemplateId: data.termsTemplateId,
    rates: {
      hourlyRate: data.hourlyRate ?? DEFAULT_HOURLY_RATE,
      initialCommitmentDescription: data.initialCommitmentDescription,
      estimatedScopingHours: data.estimatedScopingHours,
    },
    proposalValidUntil,
    kickoffDays: data.kickoffDays ?? DEFAULT_KICKOFF_DAYS,
  }

  const expirationDate = data.proposalValidUntil
    ? format(new Date(data.proposalValidUntil), 'yyyy-MM-dd')
    : format(addDays(new Date(), DEFAULT_PROPOSAL_VALIDITY_DAYS), 'yyyy-MM-dd')

  try {
    const proposal = await updateProposal(data.proposalId, {
      title: data.title,
      content,
      estimatedValue:
        data.estimatedValue !== undefined ? String(data.estimatedValue) : null,
      expirationDate,
    })

    if (!proposal) {
      return { success: false, error: 'Failed to update proposal.' }
    }

    revalidatePath('/proposals')
    revalidatePath('/leads/board')

    return { success: true, proposal }
  } catch (error) {
    console.error('Failed to update proposal content:', error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to update proposal.',
    }
  }
}
