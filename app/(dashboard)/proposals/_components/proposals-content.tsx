'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'

import { AppShellHeader } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import type { ProposalWithRelations } from '@/lib/queries/proposals'
import type { LeadRecord } from '@/lib/leads/types'

import { ProposalsPipelineSummary } from './proposals-pipeline-summary'
import { ProposalsTable } from './proposals-table'
import { LeadPickerDialog } from './lead-picker-dialog'
import { ProposalBuilderSheet } from '../../leads/_components/proposal-builder/proposal-builder-sheet'

type ProposalsContentProps = {
  proposals: ProposalWithRelations[]
  leads: LeadRecord[]
  senderName: string
}

export function ProposalsContent({ proposals, leads, senderName }: ProposalsContentProps) {
  const router = useRouter()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [selectedLead, setSelectedLead] = useState<LeadRecord | null>(null)
  const [editingProposal, setEditingProposal] = useState<ProposalWithRelations | null>(null)
  const [builderOpen, setBuilderOpen] = useState(false)

  const handleNewProposal = () => {
    setEditingProposal(null)
    setPickerOpen(true)
  }

  const handleLeadSelected = (lead: LeadRecord) => {
    setSelectedLead(lead)
    setPickerOpen(false)
    setBuilderOpen(true)
  }

  const handleEditProposal = (proposal: ProposalWithRelations) => {
    // Find the lead that matches this proposal
    const lead = leads.find(l => l.id === proposal.leadId)
    if (!lead) return

    setSelectedLead(lead)
    setEditingProposal(proposal)
    setBuilderOpen(true)
  }

  const handleBuilderClose = (open: boolean) => {
    if (!open) {
      setBuilderOpen(false)
      setSelectedLead(null)
      setEditingProposal(null)
    }
  }

  const handleBuilderSuccess = () => {
    setBuilderOpen(false)
    setSelectedLead(null)
    setEditingProposal(null)
    router.refresh()
  }

  return (
    <div className='space-y-6'>
      <AppShellHeader>
        <div className='flex items-center justify-between'>
          <div>
            <h1 className='text-2xl font-semibold tracking-tight'>Proposals</h1>
            <p className='text-muted-foreground text-sm'>
              Manage proposals and track deal progress.
            </p>
          </div>
          <Button size='sm' onClick={handleNewProposal}>
            <Plus className='mr-2 h-4 w-4' />
            New Proposal
          </Button>
        </div>
      </AppShellHeader>

      <ProposalsPipelineSummary proposals={proposals} />
      <ProposalsTable
        proposals={proposals}
        senderName={senderName}
        onEditProposal={handleEditProposal}
      />

      <LeadPickerDialog
        leads={leads}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={handleLeadSelected}
      />

      {selectedLead && (
        <ProposalBuilderSheet
          lead={selectedLead}
          existingProposal={editingProposal ?? undefined}
          open={builderOpen}
          onOpenChange={handleBuilderClose}
          onSuccess={handleBuilderSuccess}
        />
      )}
    </div>
  )
}
