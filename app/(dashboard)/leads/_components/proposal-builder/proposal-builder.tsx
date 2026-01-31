'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { useForm, useWatch } from 'react-hook-form'
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
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Form } from '@/components/ui/form'
import { TooltipProvider } from '@/components/ui/tooltip'
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
  onDirtyChange,
  onClose,
  onSuccess,
}: ProposalBuilderProps) {
  const { toast } = useToast()
  const [isBuilding, startBuildTransition] = useTransition()
  const [isGenerating, setIsGenerating] = useState(false)
  const [documentSettings, setDocumentSettings] = useState<DocumentSettings>(
    DEFAULT_DOCUMENT_SETTINGS
  )
  const [existingProposals, setExistingProposals] = useState<ExistingProposal[]>([])
  const [showPreview, setShowPreview] = useState(false)
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false)
  const [pendingBuildValues, setPendingBuildValues] = useState<ProposalFormValues | null>(null)

  // Fetch existing proposals on mount
  useEffect(() => {
    async function fetchExistingProposals() {
      try {
        const res = await fetch(`/api/leads/${lead.id}/proposals`)
        if (res.ok) {
          const data = await res.json()
          setExistingProposals(data.proposals ?? [])
        }
      } catch {
        // Silently fail - we'll just not show the warning
      }
    }
    fetchExistingProposals()
  }, [lead.id])

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
      includeFullTerms: true,
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

  // Actual build logic (called after validation and confirmation)
  const executeBuild = useCallback(
    (values: ProposalFormValues) => {
      const validPhases = values.phases.filter(
        p => p.title.trim() && p.purpose.trim()
      )

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
          description: 'Your proposal is ready to share.',
        })

        onSuccess()
      })
    },
    [lead.id, toast, onSuccess, documentSettings]
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

  // Handle AI draft generation
  const handleGenerateDraft = useCallback(async () => {
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
  }, [lead.id, form, toast])

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
    <>
      <TooltipProvider delayDuration={300}>
        <Form {...form}>
          <form className="flex min-h-0 flex-1 overflow-hidden">
            {/* Left Column - Context Panel */}
            <ContextPanel lead={lead} onInsert={handleContextInsert} />

            {/* Right Column - Editor Panel */}
            <EditorPanel
              form={form}
              isBuilding={isBuilding}
              isGenerating={isGenerating}
              onCancel={onClose}
              onBuild={handleBuildProposal}
              onGenerateDraft={handleGenerateDraft}
              existingProposalCount={existingProposals.length}
              showPreview={showPreview}
              onTogglePreview={() => setShowPreview(prev => !prev)}
            />

            {/* Collapsible Preview Panel */}
            {showPreview && (
              <PreviewPanel
                content={previewContent}
                documentSettings={documentSettings}
                onDocumentSettingsChange={setDocumentSettings}
              />
            )}
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
