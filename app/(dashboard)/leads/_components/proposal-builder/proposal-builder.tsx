'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { addDays, format } from 'date-fns'
import { z } from 'zod'

import { Form } from '@/components/ui/form'
import { useToast } from '@/components/ui/use-toast'
import type { LeadRecord } from '@/lib/leads/types'
import {
  DEFAULT_HOURLY_RATE,
  DEFAULT_KICKOFF_DAYS,
  DEFAULT_RISKS,
} from '@/lib/proposals/constants'
import {
  DEFAULT_DOCUMENT_SETTINGS,
  type DocumentSettings,
} from '@/lib/proposals/document-styles'
import { htmlToPlainText } from '@/lib/proposals/html-to-text'
import type { ProposalPhase, ProposalRisk } from '@/lib/proposals/types'

import { buildProposalFromScratch } from '../../_actions'
import { ContextPanel } from './context/context-panel'
import { EditorPanel } from './editor/editor-panel'
import { PreviewPanel } from './preview/preview-panel'

// =============================================================================
// Form Schema
// =============================================================================

const phaseSchema = z.object({
  index: z.number(),
  title: z.string(),
  purpose: z.string(),
  deliverables: z.array(z.string()),
  isOpen: z.boolean().optional(),
})

const riskSchema = z.object({
  title: z.string(),
  description: z.string(),
})

export const proposalFormSchema = z.object({
  // Proposal metadata
  title: z.string().min(1, 'Title is required'),

  // Client info
  clientCompany: z.string().min(1, 'Company name is required'),
  clientContactName: z.string().min(1, 'Contact name is required'),
  clientContactEmail: z.string().email('Valid email is required'),
  clientContact2Name: z.string().optional(),
  clientContact2Email: z.string().optional(),
  clientSignatoryName: z.string().optional(),

  // Project content
  projectOverviewText: z.string().min(1, 'Project overview is required'),
  phases: z.array(phaseSchema).min(1, 'At least one phase is required'),

  // Risks - editable array, starts with defaults
  risks: z.array(riskSchema),

  // Terms
  includeFullTerms: z.boolean(),

  // Rates & terms
  hourlyRate: z.number().min(0),
  initialCommitmentDescription: z
    .string()
    .min(1, 'Initial commitment is required'),
  estimatedScopingHours: z.string().min(1, 'Scoping hours is required'),
  kickoffDays: z.number().min(1),
  proposalValidUntil: z.string(),
  estimatedValue: z.number().optional(),
})

export type ProposalFormValues = z.infer<typeof proposalFormSchema>

// =============================================================================
// Component Props
// =============================================================================

type ProposalBuilderProps = {
  lead: LeadRecord
  onDirtyChange: (isDirty: boolean) => void
  onClose: () => void
  onSuccess: () => void
}

// =============================================================================
// Component
// =============================================================================

export function ProposalBuilder({
  lead,
  onDirtyChange,
  onClose,
  onSuccess,
}: ProposalBuilderProps) {
  const { toast } = useToast()
  const [isBuilding, startBuildTransition] = useTransition()
  const [documentSettings, setDocumentSettings] = useState<DocumentSettings>(
    DEFAULT_DOCUMENT_SETTINGS
  )

  // Default form values
  const defaultValues = useMemo<ProposalFormValues>(
    () => ({
      title: `Proposal for ${lead.companyName || lead.contactName}`,
      clientCompany: lead.companyName ?? '',
      clientContactName: lead.contactName,
      clientContactEmail: lead.contactEmail ?? '',
      clientContact2Name: '',
      clientContact2Email: '',
      clientSignatoryName: '',
      projectOverviewText: '',
      phases: [
        {
          index: 1,
          title: 'Discovery & Scoping',
          purpose: '',
          deliverables: [''],
          isOpen: true,
        },
      ],
      risks: DEFAULT_RISKS.map(r => ({ title: r.title, description: r.description })),
      includeFullTerms: false,
      hourlyRate: DEFAULT_HOURLY_RATE,
      initialCommitmentDescription: '',
      estimatedScopingHours: '',
      kickoffDays: DEFAULT_KICKOFF_DAYS,
      proposalValidUntil: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
      estimatedValue: lead.estimatedValue ?? undefined,
    }),
    [lead]
  )

  // Form setup
  const form = useForm<ProposalFormValues>({
    resolver: zodResolver(proposalFormSchema),
    defaultValues,
    mode: 'onChange',
  })

  // Watch form values for preview
  const formValues = useWatch({ control: form.control })

  // Track dirty state
  useEffect(() => {
    onDirtyChange(form.formState.isDirty)
  }, [form.formState.isDirty, onDirtyChange])

  // Build proposal handler
  const handleBuildProposal = useCallback(() => {
    form.handleSubmit(values => {
      // Validate phases have content
      const validPhases = values.phases.filter(
        p => p.title.trim() && p.purpose.trim()
      )
      if (validPhases.length === 0) {
        toast({
          variant: 'destructive',
          title: 'Missing phases',
          description: 'At least one complete phase is required.',
        })
        return
      }

      startBuildTransition(async () => {
        const result = await buildProposalFromScratch({
          leadId: lead.id,
          title: values.title.trim(),
          clientCompany: values.clientCompany.trim(),
          clientContactName: values.clientContactName.trim(),
          clientContactEmail: values.clientContactEmail.trim(),
          clientContact2Name: values.clientContact2Name?.trim() || undefined,
          clientContact2Email: values.clientContact2Email?.trim() || undefined,
          clientSignatoryName: values.clientSignatoryName?.trim() || undefined,
          // Convert HTML from rich text editor to plain text for Google Docs
          projectOverviewText: htmlToPlainText(values.projectOverviewText),
          phases: validPhases.map(
            (p, i): ProposalPhase => ({
              index: i + 1,
              title: p.title.trim(),
              purpose: p.purpose.trim(),
              deliverables: p.deliverables
                .filter(d => d.trim())
                .map(d => d.trim()),
            })
          ),
          // Pass all risks as customRisks with includeDefaultRisks: false
          // since user has full control over the risks array
          includeDefaultRisks: false,
          customRisks: values.risks.filter(
            (r): r is ProposalRisk => Boolean(r.title.trim() && r.description.trim())
          ),
          includeFullTerms: values.includeFullTerms,
          hourlyRate: values.hourlyRate,
          initialCommitmentDescription:
            values.initialCommitmentDescription.trim(),
          estimatedScopingHours: values.estimatedScopingHours.trim(),
          proposalValidUntil: values.proposalValidUntil
            ? new Date(values.proposalValidUntil).toISOString()
            : undefined,
          kickoffDays: values.kickoffDays,
          estimatedValue: values.estimatedValue,
          // Pass document formatting settings
          documentSettings,
        })

        if (!result.success) {
          toast({
            variant: 'destructive',
            title: 'Unable to create proposal',
            description: result.error ?? 'Please try again.',
          })
          return
        }

        toast({
          title: 'Proposal created',
          description: 'Document ready in Google Docs.',
        })

        onSuccess()
      })
    })()
  }, [form, lead.id, toast, onSuccess, documentSettings])

  // Merge form values with defaults for preview (handle undefined gracefully)
  const previewContent = useMemo(
    () => ({
      title: formValues.title ?? defaultValues.title,
      client: {
        companyName: formValues.clientCompany ?? defaultValues.clientCompany,
        contactName:
          formValues.clientContactName ?? defaultValues.clientContactName,
        contactEmail:
          formValues.clientContactEmail ?? defaultValues.clientContactEmail,
        contact2Name: formValues.clientContact2Name,
        contact2Email: formValues.clientContact2Email,
        signatoryName: formValues.clientSignatoryName,
      },
      projectOverviewText:
        formValues.projectOverviewText ?? defaultValues.projectOverviewText,
      phases: (formValues.phases ?? defaultValues.phases).map(
        (p, i): ProposalPhase => ({
          index: i + 1,
          title: p.title ?? '',
          purpose: p.purpose ?? '',
          deliverables: (p.deliverables ?? []).filter(d => d.trim()),
        })
      ),
      risks: (formValues.risks ?? defaultValues.risks)
        .filter(r => r.title?.trim() || r.description?.trim())
        .map(r => ({ title: r.title ?? '', description: r.description ?? '' })),
      includeFullTerms:
        formValues.includeFullTerms ?? defaultValues.includeFullTerms,
      rates: {
        hourlyRate: formValues.hourlyRate ?? defaultValues.hourlyRate,
        initialCommitmentDescription:
          formValues.initialCommitmentDescription ??
          defaultValues.initialCommitmentDescription,
        estimatedScopingHours:
          formValues.estimatedScopingHours ??
          defaultValues.estimatedScopingHours,
      },
      proposalValidUntil:
        formValues.proposalValidUntil ?? defaultValues.proposalValidUntil,
      kickoffDays: formValues.kickoffDays ?? defaultValues.kickoffDays,
    }),
    [formValues, defaultValues]
  )

  return (
    <Form {...form}>
      <form className="flex min-h-0 flex-1 overflow-hidden">
        {/* Left Column - Context Panel */}
        <ContextPanel lead={lead} />

        {/* Middle Column - Editor Panel */}
        <EditorPanel
          form={form}
          isBuilding={isBuilding}
          onCancel={onClose}
          onBuild={handleBuildProposal}
        />

        {/* Right Column - Live Preview */}
        <PreviewPanel
          content={previewContent}
          documentSettings={documentSettings}
          onDocumentSettingsChange={setDocumentSettings}
        />
      </form>
    </Form>
  )
}
