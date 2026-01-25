'use server'

import { and, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { leads } from '@/lib/db/schema'
import { generateProposalFromScratch } from '@/lib/proposals/generate-from-scratch'
import type { Proposal } from '@/lib/queries/proposals'

import { revalidateLeadsPath } from './utils'
import type { LeadActionResult } from './types'

// =============================================================================
// Schema
// =============================================================================

const phaseSchema = z.object({
  index: z.number().int().min(1),
  title: z.string().min(1, 'Phase title is required'),
  purpose: z.string().min(1, 'Phase purpose is required'),
  deliverables: z.array(z.string().min(1)).min(1, 'At least one deliverable is required'),
})

const riskSchema = z.object({
  title: z.string().min(1, 'Risk title is required'),
  description: z.string().min(1, 'Risk description is required'),
})

const buildProposalSchema = z.object({
  leadId: z.string().uuid(),
  title: z.string().trim().min(1, 'Proposal title is required').max(200),

  // Client info
  clientCompany: z.string().trim().min(1, 'Client company name is required'),
  clientContactName: z.string().trim().min(1, 'Client contact name is required'),
  clientContactEmail: z.string().email('Valid client email is required'),
  clientContact2Name: z.string().trim().optional(),
  clientContact2Email: z.string().email().optional().or(z.literal('')),
  clientSignatoryName: z.string().trim().optional(),

  // Project content
  projectOverviewText: z.string().min(10, 'Project overview must be at least 10 characters'),
  phases: z.array(phaseSchema).min(1, 'At least one phase is required'),

  // Risks
  includeDefaultRisks: z.boolean().default(true),
  customRisks: z.array(riskSchema).optional(),

  // Rates
  hourlyRate: z.number().min(0).default(200),
  initialCommitmentDescription: z.string().min(1, 'Initial commitment description is required'),
  estimatedScopingHours: z.string().min(1, 'Estimated scoping hours is required'),

  // Dates
  proposalValidUntil: z.string().datetime().optional(),
  kickoffDays: z.number().int().min(1).default(10),

  // Estimated value
  estimatedValue: z.number().min(0).optional(),
})

export type BuildProposalFromScratchInput = z.infer<typeof buildProposalSchema>

export type BuildProposalFromScratchResult = LeadActionResult & {
  proposal?: Proposal
  docUrl?: string
}

// =============================================================================
// Action
// =============================================================================

export async function buildProposalFromScratch(
  input: BuildProposalFromScratchInput
): Promise<BuildProposalFromScratchResult> {
  const user = await requireUser()
  if (!user) return { success: false, error: 'Unauthorized' }
  assertAdmin(user)

  const parsed = buildProposalSchema.safeParse(input)

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid proposal payload.',
    }
  }

  const data = parsed.data

  // Verify lead exists
  const leadRows = await db
    .select({ id: leads.id })
    .from(leads)
    .where(and(eq(leads.id, data.leadId), isNull(leads.deletedAt)))
    .limit(1)

  if (leadRows.length === 0) {
    return { success: false, error: 'Lead not found.' }
  }

  // Clean up optional empty strings
  const cleanedInput = {
    ...data,
    clientContact2Email: data.clientContact2Email || undefined,
    clientContact2Name: data.clientContact2Name || undefined,
    clientSignatoryName: data.clientSignatoryName || undefined,
  }

  try {
    const result = await generateProposalFromScratch({
      userId: user.id,
      input: cleanedInput,
    })

    revalidateLeadsPath()

    return {
      success: true,
      proposal: result.proposal,
      docUrl: result.docUrl,
    }
  } catch (error) {
    console.error('Failed to build proposal from scratch:', error)

    const message =
      error instanceof Error
        ? error.message
        : 'Failed to create proposal. Please check your Google connection.'

    return {
      success: false,
      error: message,
    }
  }
}
