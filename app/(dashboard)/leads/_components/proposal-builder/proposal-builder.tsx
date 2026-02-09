'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { addDays, format } from 'date-fns'
import { z } from 'zod'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Form } from '@/components/ui/form'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useToast } from '@/components/ui/use-toast'
import type { LeadRecord } from '@/lib/leads/types'
import type { ClientForProposal } from '@/app/(dashboard)/proposals/_actions/fetch-clients-for-proposals'
import {
  DEFAULT_HOURLY_RATE,
  DEFAULT_KICKOFF_DAYS,
  DEFAULT_RISKS,
  FULL_TERMS_AND_CONDITIONS,
} from '@/lib/proposals/constants'
import type { ProposalTemplateRecord } from '@/lib/queries/proposal-templates'
import { htmlToPlainText } from '@/lib/proposals/html-to-text'
import type { ProposalContent, ProposalPhase, ProposalRisk } from '@/lib/proposals/types'

import { buildProposalFromScratch, updateProposalContent } from '../../_actions'
import { ContextPanel } from './context/context-panel'
import { EditorPanel } from './editor/editor-panel'

// Type for the AI draft response
type ProposalDraftResponse = {
  draft: {
    projectOverviewText: string
    phases: Array<{
      title: string
      purpose: string
      deliverables: string[]
    }>
    suggestedInitialCommitment: string
    estimatedScopingHours: string
    customRisks?: Array<{ title: string; description: string }>
    estimatedValue?: number
    confidence: number
    notes?: string
  }
  context: {
    hasNotes: boolean
    transcriptCount: number
    emailCount: number
  }
}

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

  // Terms - template ID (null = no terms)
  termsTemplateId: z.string().nullable(),

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

type EditableProposal = {
  id: string
  title: string
  content: ProposalContent | Record<string, never>
  estimatedValue: string | null
}

type ProposalBuilderProps = {
  lead?: LeadRecord
  client?: ClientForProposal
  existingProposal?: EditableProposal
  onDirtyChange: (isDirty: boolean) => void
  onClose: () => void
  onSuccess: () => void
}

// =============================================================================
// Component
// =============================================================================

// Type for existing proposal info
type ExistingProposal = {
  id: string
  title: string
  status: string
  createdAt: string
  docUrl: string | null
}

export function ProposalBuilder({
  lead,
  client,
  existingProposal,
  onDirtyChange,
  onClose,
  onSuccess,
}: ProposalBuilderProps) {
  const isClientOnly = !lead && !!client
  const isEditing = !!existingProposal
  const { toast } = useToast()
  const [isBuilding, startBuildTransition] = useTransition()
  const [isGenerating, setIsGenerating] = useState(false)
  const [existingProposals, setExistingProposals] = useState<ExistingProposal[]>([])
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false)
  const [pendingBuildValues, setPendingBuildValues] = useState<ProposalFormValues | null>(null)

  const [existingProposalsFetchFailed, setExistingProposalsFetchFailed] = useState(false)
  const [termsTemplates, setTermsTemplates] = useState<ProposalTemplateRecord[]>([])
  const [defaultTermsTemplateId, setDefaultTermsTemplateId] = useState<string | null>(null)

  // Fetch existing proposals on mount to detect duplicates (lead-only)
  useEffect(() => {
    if (!lead) return
    async function fetchExistingProposals() {
      try {
        const res = await fetch(`/api/leads/${lead!.id}/proposals`)
        if (!res.ok) throw new Error('Failed to fetch')
        const data = await res.json()
        setExistingProposals(data.proposals ?? [])
        setExistingProposalsFetchFailed(false)
      } catch (err) {
        console.error('Failed to fetch existing proposals for duplicate check:', err)
        setExistingProposalsFetchFailed(true)
      }
    }
    fetchExistingProposals()
  }, [lead])

  // Fetch all terms templates on mount
  useEffect(() => {
    async function fetchTermsTemplates() {
      try {
        const res = await fetch('/api/proposal-templates?type=TERMS_AND_CONDITIONS')
        if (res.ok) {
          const data = await res.json()
          const templates = data.templates ?? []
          setTermsTemplates(templates)
          // Find the default template
          const defaultTemplate = templates.find((t: ProposalTemplateRecord) => t.isDefault)
          setDefaultTermsTemplateId(defaultTemplate?.id ?? null)
        }
      } catch (err) {
        console.error('Failed to fetch terms templates:', err)
        // Will fall back to "None" selected
      }
    }
    fetchTermsTemplates()
  }, [])

  // Default form values — prefill from existing proposal when editing
  const defaultValues = useMemo<ProposalFormValues>(() => {
    const content = existingProposal?.content as ProposalContent | undefined
    if (existingProposal && content && 'client' in content) {
      // For existing proposals, use stored termsTemplateId or derive from includeFullTerms
      let termsId: string | null = content.termsTemplateId ?? null
      // If no termsTemplateId but includeFullTerms was true, use the default template
      if (!termsId && content.includeFullTerms) {
        termsId = defaultTermsTemplateId
      }
      return {
        title: existingProposal.title,
        clientCompany: content.client.companyName,
        clientContactName: content.client.contactName,
        clientContactEmail: content.client.contactEmail,
        clientContact2Name: content.client.contact2Name ?? '',
        clientContact2Email: content.client.contact2Email ?? '',
        clientSignatoryName: content.client.signatoryName ?? '',
        projectOverviewText: content.projectOverviewText,
        phases: content.phases.map(p => ({
          ...p,
          isOpen: false,
        })),
        risks: content.risks.map(r => ({ title: r.title, description: r.description })),
        termsTemplateId: termsId,
        hourlyRate: content.rates.hourlyRate,
        initialCommitmentDescription: content.rates.initialCommitmentDescription,
        estimatedScopingHours: content.rates.estimatedScopingHours,
        kickoffDays: content.kickoffDays,
        proposalValidUntil: content.proposalValidUntil
          ? format(new Date(content.proposalValidUntil), 'yyyy-MM-dd')
          : format(addDays(new Date(), 30), 'yyyy-MM-dd'),
        estimatedValue: existingProposal.estimatedValue
          ? parseFloat(existingProposal.estimatedValue)
          : undefined,
      }
    }

    // Pre-fill from lead or client
    const companyName = lead?.companyName ?? client?.name ?? ''
    const contactName = lead?.contactName ?? client?.primaryContactName ?? ''
    const contactEmail = lead?.contactEmail ?? client?.primaryContactEmail ?? ''

    return {
      title: `Proposal for ${companyName || contactName}`,
      clientCompany: companyName,
      clientContactName: contactName,
      clientContactEmail: contactEmail,
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
      termsTemplateId: defaultTermsTemplateId,
      hourlyRate: DEFAULT_HOURLY_RATE,
      initialCommitmentDescription: '',
      estimatedScopingHours: '',
      kickoffDays: DEFAULT_KICKOFF_DAYS,
      proposalValidUntil: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
      estimatedValue: lead?.estimatedValue ?? undefined,
    }
  }, [lead, client, existingProposal, defaultTermsTemplateId])

  // Form setup
  const form = useForm<ProposalFormValues>({
    resolver: zodResolver(proposalFormSchema),
    defaultValues,
    mode: 'onChange',
  })

  // Track dirty state
  useEffect(() => {
    onDirtyChange(form.formState.isDirty)
  }, [form.formState.isDirty, onDirtyChange])

  // Get terms content for a given template ID
  const getTermsContent = useCallback((templateId: string | null) => {
    if (!templateId) {
      return { content: undefined, templateId: undefined }
    }
    const template = termsTemplates.find(t => t.id === templateId)
    if (template?.content && template.content.length > 0) {
      return {
        content: template.content,
        templateId: template.id,
      }
    }
    // Fallback to hardcoded constant if template not found
    return {
      content: FULL_TERMS_AND_CONDITIONS,
      templateId: undefined,
    }
  }, [termsTemplates])

  // Shared fields for both create and update
  const buildSharedFields = useCallback(
    (values: ProposalFormValues) => {
      const validPhases = values.phases.filter(
        p => p.title.trim() && p.purpose.trim()
      )

      // Snapshot terms content if a template is selected
      const termsData = getTermsContent(values.termsTemplateId)

      return {
        title: values.title.trim(),
        clientCompany: values.clientCompany.trim(),
        clientContactName: values.clientContactName.trim(),
        clientContactEmail: values.clientContactEmail.trim(),
        clientContact2Name: values.clientContact2Name?.trim() || undefined,
        clientContact2Email: values.clientContact2Email?.trim() || undefined,
        clientSignatoryName: values.clientSignatoryName?.trim() || undefined,
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
        risks: values.risks.filter(
          (r): r is ProposalRisk => Boolean(r.title.trim() && r.description.trim())
        ),
        includeFullTerms: !!values.termsTemplateId,
        termsContent: termsData.content,
        termsTemplateId: termsData.templateId,
        hourlyRate: values.hourlyRate,
        initialCommitmentDescription:
          values.initialCommitmentDescription.trim(),
        estimatedScopingHours: values.estimatedScopingHours.trim(),
        proposalValidUntil: values.proposalValidUntil
          ? new Date(values.proposalValidUntil).toISOString()
          : undefined,
        kickoffDays: values.kickoffDays,
        estimatedValue: values.estimatedValue,
      }
    },
    [getTermsContent]
  )

  // Actual build logic (called after validation and confirmation)
  const executeBuild = useCallback(
    (values: ProposalFormValues) => {
      const shared = buildSharedFields(values)

      startBuildTransition(async () => {
        if (isEditing && existingProposal) {
          // Update existing proposal
          const result = await updateProposalContent({
            proposalId: existingProposal.id,
            ...shared,
          })

          if (!result.success) {
            toast({
              variant: 'destructive',
              title: 'Unable to update proposal',
              description: result.error ?? 'Please try again.',
            })
            return
          }

          toast({
            title: 'Proposal updated',
            description: 'Your changes have been saved.',
          })
        } else {
          // Create new proposal
          const result = await buildProposalFromScratch({
            leadId: lead?.id ?? null,
            clientId: client?.id ?? null,
            ...shared,
            includeDefaultRisks: false,
            customRisks: shared.risks,
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
            description: 'Your proposal is ready to share.',
          })
        }

        onSuccess()
      })
    },
    [lead, client, isEditing, existingProposal, buildSharedFields, toast, onSuccess]
  )

  // Handle confirmation of duplicate proposal
  const handleConfirmDuplicate = useCallback(() => {
    setShowDuplicateWarning(false)
    if (pendingBuildValues) {
      executeBuild(pendingBuildValues)
      setPendingBuildValues(null)
    }
  }, [executeBuild, pendingBuildValues])

  // Build proposal handler - validates and checks for existing proposals
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

      // Check for existing proposals
      if (existingProposals.length > 0) {
        setPendingBuildValues(values)
        setShowDuplicateWarning(true)
        return
      }

      // No existing proposals, build directly
      executeBuild(values)
    })()
  }, [form, toast, existingProposals, executeBuild])

  // Handle inserting content from context panel into project overview
  const handleContextInsert = useCallback(
    (text: string, source: string) => {
      const currentValue = form.getValues('projectOverviewText')

      // Build the new content with source attribution
      const attribution = `<p><em>From ${source}:</em></p>`
      const insertedText = `<p>${text.replace(/\n/g, '</p><p>')}</p>`
      const separator = currentValue && currentValue !== '<p></p>' ? '<p></p>' : ''

      const newValue = currentValue + separator + attribution + insertedText

      form.setValue('projectOverviewText', newValue, { shouldDirty: true })

      toast({
        title: 'Content inserted',
        description: `Added content from "${source}" to Project Overview.`,
      })
    },
    [form, toast]
  )

  // Handle AI draft generation (only for lead-based proposals)
  const handleGenerateDraft = useCallback(async () => {
    if (!lead) return
    setIsGenerating(true)

    try {
      const response = await fetch(`/api/leads/${lead.id}/proposal/generate-draft`, {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Failed to generate draft')
      }

      const data: ProposalDraftResponse = await response.json()
      const { draft, context } = data

      // Update form with generated content
      // Convert plain text to HTML for the rich text editor
      const overviewHtml = draft.projectOverviewText
        .split('\n\n')
        .map(p => `<p>${p.replace(/\n/g, '<br />')}</p>`)
        .join('')
      form.setValue('projectOverviewText', overviewHtml, { shouldDirty: true })

      // Update phases
      const newPhases = draft.phases.map((p, i) => ({
        index: i + 1,
        title: p.title,
        purpose: p.purpose,
        deliverables: p.deliverables.length > 0 ? p.deliverables : [''],
        isOpen: i === 0,
      }))
      form.setValue('phases', newPhases, { shouldDirty: true })

      // Update rates
      form.setValue('initialCommitmentDescription', draft.suggestedInitialCommitment, {
        shouldDirty: true,
      })
      form.setValue('estimatedScopingHours', draft.estimatedScopingHours, {
        shouldDirty: true,
      })

      // Replace defaults with AI-generated risks if provided
      if (draft.customRisks && draft.customRisks.length > 0) {
        form.setValue(
          'risks',
          draft.customRisks.map(r => ({
            title: r.title,
            description: r.description,
          })),
          { shouldDirty: true }
        )
      }

      // Update estimated value if provided
      if (draft.estimatedValue) {
        form.setValue('estimatedValue', draft.estimatedValue, { shouldDirty: true })
      }

      // Build context message
      const contextParts = []
      if (context.hasNotes) contextParts.push('notes')
      if (context.transcriptCount > 0)
        contextParts.push(`${context.transcriptCount} transcript${context.transcriptCount > 1 ? 's' : ''}`)
      if (context.emailCount > 0)
        contextParts.push(`${context.emailCount} email${context.emailCount > 1 ? 's' : ''}`)

      const contextStr = contextParts.length > 0 ? contextParts.join(', ') : 'minimal context'

      toast({
        title: 'Draft generated',
        description: `Created from ${contextStr}. Confidence: ${Math.round(draft.confidence * 100)}%${draft.notes ? `. ${draft.notes}` : ''}`,
      })
    } catch (error) {
      console.error('Failed to generate draft:', error)
      toast({
        variant: 'destructive',
        title: 'Generation failed',
        description: 'Could not generate draft. Please try again.',
      })
    } finally {
      setIsGenerating(false)
    }
  }, [lead, form, toast])

  // Auto-generate AI draft on mount when creating a new lead-based proposal (not editing)
  const hasAutoGenerated = useRef(false)
  useEffect(() => {
    if (!isEditing && !isClientOnly && !hasAutoGenerated.current) {
      hasAutoGenerated.current = true
      handleGenerateDraft()
    }
  }, [isEditing, isClientOnly, handleGenerateDraft])

  return (
    <>
      <TooltipProvider delayDuration={300}>
        <Form {...form}>
          <form className="flex min-h-0 flex-1 overflow-hidden">
            {/* Left Column - Context Panel (only for lead-based proposals) */}
            {lead && <ContextPanel lead={lead} onInsert={handleContextInsert} />}

            {/* Right Column - Editor Panel */}
            <EditorPanel
              form={form}
              isBuilding={isBuilding}
              isGenerating={isGenerating}
              isEditing={isEditing}
              onCancel={onClose}
              onBuild={handleBuildProposal}
              onGenerateDraft={lead ? handleGenerateDraft : undefined}
              existingProposalCount={existingProposals.length}
              existingProposalsFetchFailed={existingProposalsFetchFailed}
              termsTemplates={termsTemplates}
            />
          </form>
        </Form>
      </TooltipProvider>

      {/* Duplicate proposal warning dialog */}
      <AlertDialog open={showDuplicateWarning} onOpenChange={setShowDuplicateWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Proposal already exists</AlertDialogTitle>
            <AlertDialogDescription>
              This lead already has {existingProposals.length} proposal
              {existingProposals.length > 1 ? 's' : ''}. Creating a new one will
              not replace the existing proposal{existingProposals.length > 1 ? 's' : ''}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingBuildValues(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDuplicate}>
              Create New Proposal
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
