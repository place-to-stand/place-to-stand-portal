import { z } from 'zod'

export const proposalPhaseSchema = z.object({
  title: z.string().describe('Phase title (e.g., "Discovery & Scoping", "Design & Prototyping")'),
  purpose: z.string().describe('One paragraph explaining the purpose and activities of this phase'),
  deliverables: z
    .array(z.string())
    .min(1)
    .max(5)
    .describe('List of 2-5 concrete deliverables for this phase'),
})

export const proposalDraftSchema = z.object({
  projectOverviewText: z
    .string()
    .describe(
      'A professional project overview summarizing the client need, proposed approach, and expected outcomes. 2-4 paragraphs.'
    ),
  phases: z
    .array(proposalPhaseSchema)
    .min(1)
    .max(6)
    .describe(
      'Proposed phases for the project. Typically 2-4 phases. First phase is usually Discovery/Scoping.'
    ),
  suggestedInitialCommitment: z
    .string()
    .describe(
      'Suggested initial commitment description (e.g., "10-hour minimum retainer for discovery phase")'
    ),
  estimatedScopingHours: z
    .string()
    .describe('Estimated hours for the scoping/discovery phase (e.g., "8-12 hours")'),
  customRisks: z
    .array(
      z.object({
        title: z.string().describe('Risk title'),
        description: z.string().describe('Risk description and mitigation'),
      })
    )
    .optional()
    .describe('2-4 project-specific risks tailored to this engagement. These replace generic defaults when provided.'),
  estimatedValue: z
    .number()
    .optional()
    .describe('Estimated total project value in USD if determinable from context'),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe('Confidence level in this draft (0-1) based on available context'),
  notes: z
    .string()
    .optional()
    .describe('Any notes or caveats about the generated draft for the user'),
})

export type ProposalPhase = z.infer<typeof proposalPhaseSchema>
export type ProposalDraft = z.infer<typeof proposalDraftSchema>
