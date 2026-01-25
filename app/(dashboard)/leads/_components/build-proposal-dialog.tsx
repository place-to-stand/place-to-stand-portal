'use client'

import { useCallback, useState, useTransition } from 'react'
import { FileText, DollarSign, Loader2, Building2, Target, AlertTriangle, Settings } from 'lucide-react'
import { addDays, format } from 'date-fns'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useToast } from '@/components/ui/use-toast'
import type { LeadRecord } from '@/lib/leads/types'
import { DEFAULT_HOURLY_RATE, DEFAULT_KICKOFF_DAYS, DEFAULT_RISKS } from '@/lib/proposals/constants'

import { buildProposalFromScratch } from '../_actions'
import { ProposalPhaseEditor, type Phase } from './proposal-phase-editor'

type BuildProposalDialogProps = {
  lead: LeadRecord
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

// Use key-based remounting to reset form state when dialog opens
export function BuildProposalDialog({
  lead,
  open,
  onOpenChange,
  onSuccess,
}: BuildProposalDialogProps) {
  const [formKey, setFormKey] = useState(0)

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        setFormKey(k => k + 1)
      }
      onOpenChange(nextOpen)
    },
    [onOpenChange]
  )

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <BuildProposalSheetContent
        key={formKey}
        lead={lead}
        onOpenChange={onOpenChange}
        onSuccess={onSuccess}
      />
    </Sheet>
  )
}

function BuildProposalSheetContent({
  lead,
  onOpenChange,
  onSuccess,
}: Omit<BuildProposalDialogProps, 'open'>) {
  const { toast } = useToast()
  const [isCreating, startCreateTransition] = useTransition()
  const [activeTab, setActiveTab] = useState('client')

  // Form state
  const [title, setTitle] = useState(
    () => `Proposal for ${lead.companyName || lead.contactName}`
  )
  const [clientCompany, setClientCompany] = useState(lead.companyName ?? '')
  const [clientContactName, setClientContactName] = useState(lead.contactName)
  const [clientContactEmail, setClientContactEmail] = useState(lead.contactEmail ?? '')
  const [clientContact2Name, setClientContact2Name] = useState('')
  const [clientContact2Email, setClientContact2Email] = useState('')
  const [clientSignatoryName, setClientSignatoryName] = useState('')

  const [projectOverviewText, setProjectOverviewText] = useState('')
  const [phases, setPhases] = useState<Phase[]>([
    {
      index: 1,
      title: 'Discovery & Scoping',
      purpose: '',
      deliverables: [''],
      isOpen: true,
    },
  ])

  const [includeDefaultRisks, setIncludeDefaultRisks] = useState(true)
  const [hourlyRate, setHourlyRate] = useState(String(DEFAULT_HOURLY_RATE))
  const [initialCommitmentDescription, setInitialCommitmentDescription] = useState('')
  const [estimatedScopingHours, setEstimatedScopingHours] = useState('')
  const [kickoffDays, setKickoffDays] = useState(String(DEFAULT_KICKOFF_DAYS))
  const [proposalValidUntil, setProposalValidUntil] = useState(
    () => format(addDays(new Date(), 30), 'yyyy-MM-dd')
  )
  const [estimatedValue, setEstimatedValue] = useState(
    () => lead.estimatedValue?.toString() ?? ''
  )

  const handleCreate = useCallback(() => {
    // Validate required fields
    if (!clientCompany.trim()) {
      toast({ variant: 'destructive', title: 'Missing field', description: 'Client company name is required.' })
      setActiveTab('client')
      return
    }
    if (!clientContactEmail.trim()) {
      toast({ variant: 'destructive', title: 'Missing field', description: 'Client email is required.' })
      setActiveTab('client')
      return
    }
    if (!projectOverviewText.trim()) {
      toast({ variant: 'destructive', title: 'Missing field', description: 'Project overview is required.' })
      setActiveTab('scope')
      return
    }
    if (!initialCommitmentDescription.trim()) {
      toast({ variant: 'destructive', title: 'Missing field', description: 'Initial commitment description is required.' })
      setActiveTab('terms')
      return
    }
    if (!estimatedScopingHours.trim()) {
      toast({ variant: 'destructive', title: 'Missing field', description: 'Estimated scoping hours is required.' })
      setActiveTab('terms')
      return
    }

    // Validate phases
    const validPhases = phases.filter(p => p.title.trim() && p.purpose.trim())
    if (validPhases.length === 0) {
      toast({ variant: 'destructive', title: 'Missing phases', description: 'At least one complete phase is required.' })
      setActiveTab('phases')
      return
    }

    const parsedRate = parseFloat(hourlyRate) || DEFAULT_HOURLY_RATE
    const parsedKickoff = parseInt(kickoffDays) || DEFAULT_KICKOFF_DAYS
    const parsedValue = estimatedValue ? parseFloat(estimatedValue) : undefined

    startCreateTransition(async () => {
      const result = await buildProposalFromScratch({
        leadId: lead.id,
        title: title.trim(),
        clientCompany: clientCompany.trim(),
        clientContactName: clientContactName.trim(),
        clientContactEmail: clientContactEmail.trim(),
        clientContact2Name: clientContact2Name.trim() || undefined,
        clientContact2Email: clientContact2Email.trim() || undefined,
        clientSignatoryName: clientSignatoryName.trim() || undefined,
        projectOverviewText: projectOverviewText.trim(),
        phases: validPhases.map((p, i) => ({
          index: i + 1,
          title: p.title.trim(),
          purpose: p.purpose.trim(),
          deliverables: p.deliverables.filter(d => d.trim()).map(d => d.trim()),
        })),
        includeDefaultRisks,
        hourlyRate: parsedRate,
        initialCommitmentDescription: initialCommitmentDescription.trim(),
        estimatedScopingHours: estimatedScopingHours.trim(),
        proposalValidUntil: proposalValidUntil ? new Date(proposalValidUntil).toISOString() : undefined,
        kickoffDays: parsedKickoff,
        estimatedValue: parsedValue,
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

      onOpenChange(false)
      onSuccess?.()
    })
  }, [
    lead.id,
    title,
    clientCompany,
    clientContactName,
    clientContactEmail,
    clientContact2Name,
    clientContact2Email,
    clientSignatoryName,
    projectOverviewText,
    phases,
    includeDefaultRisks,
    hourlyRate,
    initialCommitmentDescription,
    estimatedScopingHours,
    proposalValidUntil,
    kickoffDays,
    estimatedValue,
    toast,
    onOpenChange,
    onSuccess,
  ])

  return (
    <SheetContent side="right" className="flex w-full flex-col sm:max-w-lg">
      <SheetHeader className="bg-transparent p-0 px-6 pt-6">
        <SheetTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Build Proposal
        </SheetTitle>
        <SheetDescription>
          Create a new proposal from scratch for {lead.contactName}
          {lead.companyName && ` at ${lead.companyName}`}
        </SheetDescription>
      </SheetHeader>

      <div className="flex flex-1 flex-col overflow-hidden px-6 py-4">
        {/* Proposal Title */}
        <div className="mb-4 space-y-2">
          <Label htmlFor="proposal-title">Proposal Title</Label>
          <Input
            id="proposal-title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Proposal title"
          />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-1 flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="client" className="text-xs">
              <Building2 className="mr-1 h-3 w-3" />
              Client
            </TabsTrigger>
            <TabsTrigger value="scope" className="text-xs">
              <Target className="mr-1 h-3 w-3" />
              Scope
            </TabsTrigger>
            <TabsTrigger value="phases" className="text-xs">
              <FileText className="mr-1 h-3 w-3" />
              Phases
            </TabsTrigger>
            <TabsTrigger value="terms" className="text-xs">
              <Settings className="mr-1 h-3 w-3" />
              Terms
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto">
            {/* Client Info Tab */}
            <TabsContent value="client" className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="client-company">Company Name *</Label>
                <Input
                  id="client-company"
                  value={clientCompany}
                  onChange={e => setClientCompany(e.target.value)}
                  placeholder="Client company name"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="client-contact">Contact Name *</Label>
                  <Input
                    id="client-contact"
                    value={clientContactName}
                    onChange={e => setClientContactName(e.target.value)}
                    placeholder="Primary contact"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="client-email">Contact Email *</Label>
                  <Input
                    id="client-email"
                    type="email"
                    value={clientContactEmail}
                    onChange={e => setClientContactEmail(e.target.value)}
                    placeholder="email@company.com"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="client-contact-2">Secondary Contact</Label>
                  <Input
                    id="client-contact-2"
                    value={clientContact2Name}
                    onChange={e => setClientContact2Name(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="client-email-2">Secondary Email</Label>
                  <Input
                    id="client-email-2"
                    type="email"
                    value={clientContact2Email}
                    onChange={e => setClientContact2Email(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="signatory">Signatory Name</Label>
                <Input
                  id="signatory"
                  value={clientSignatoryName}
                  onChange={e => setClientSignatoryName(e.target.value)}
                  placeholder="Defaults to primary contact"
                />
                <p className="text-xs text-muted-foreground">
                  The person who will sign the proposal (if different from primary contact)
                </p>
              </div>
            </TabsContent>

            {/* Scope Tab */}
            <TabsContent value="scope" className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="project-overview">Project Overview *</Label>
                <Textarea
                  id="project-overview"
                  value={projectOverviewText}
                  onChange={e => setProjectOverviewText(e.target.value)}
                  placeholder="Describe the client's needs and project goals..."
                  className="min-h-[150px]"
                />
                <p className="text-xs text-muted-foreground">
                  A paragraph describing what the client needs and what this project will accomplish.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="initial-commitment">Initial Commitment *</Label>
                <Input
                  id="initial-commitment"
                  value={initialCommitmentDescription}
                  onChange={e => setInitialCommitmentDescription(e.target.value)}
                  placeholder="e.g., 10-hour minimum retainer"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="scoping-hours">Estimated Scoping Hours *</Label>
                <Input
                  id="scoping-hours"
                  value={estimatedScopingHours}
                  onChange={e => setEstimatedScopingHours(e.target.value)}
                  placeholder="e.g., 8-12 hours"
                />
              </div>
            </TabsContent>

            {/* Phases Tab */}
            <TabsContent value="phases" className="mt-4">
              <ProposalPhaseEditor phases={phases} onChange={setPhases} />
            </TabsContent>

            {/* Terms Tab */}
            <TabsContent value="terms" className="mt-4 space-y-4">
              <div className="flex items-start gap-3 rounded-lg border p-3">
                <Checkbox
                  id="include-default-risks"
                  checked={includeDefaultRisks}
                  onCheckedChange={checked => setIncludeDefaultRisks(checked === true)}
                />
                <div className="space-y-0.5">
                  <Label htmlFor="include-default-risks" className="text-sm cursor-pointer">
                    Include Default Risks
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Standard risk disclosures ({DEFAULT_RISKS.length} items)
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="hourly-rate" className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    Hourly Rate
                  </Label>
                  <Input
                    id="hourly-rate"
                    type="number"
                    min="0"
                    value={hourlyRate}
                    onChange={e => setHourlyRate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="kickoff-days">Kickoff Days</Label>
                  <Input
                    id="kickoff-days"
                    type="number"
                    min="1"
                    value={kickoffDays}
                    onChange={e => setKickoffDays(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="valid-until">Valid Until</Label>
                  <Input
                    id="valid-until"
                    type="date"
                    value={proposalValidUntil}
                    onChange={e => setProposalValidUntil(e.target.value)}
                    min={format(new Date(), 'yyyy-MM-dd')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="estimated-value" className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    Est. Value
                  </Label>
                  <Input
                    id="estimated-value"
                    type="number"
                    min="0"
                    step="100"
                    value={estimatedValue}
                    onChange={e => setEstimatedValue(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>

      <div className="flex items-center justify-end gap-2 border-t px-6 py-4">
        <Button
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={isCreating}
        >
          Cancel
        </Button>
        <Button onClick={handleCreate} disabled={isCreating}>
          {isCreating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Building...
            </>
          ) : (
            <>
              <FileText className="mr-2 h-4 w-4" />
              Build Proposal
            </>
          )}
        </Button>
      </div>
    </SheetContent>
  )
}
