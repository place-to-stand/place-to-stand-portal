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
import { ProposalsTabsNav } from './proposals-tabs-nav'
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
    <>
      <AppShellHeader>
        <div className='flex flex-col'>
          <h1 className='text-2xl font-semibold tracking-tight'>Proposals</h1>
          <p className='text-muted-foreground text-sm'>
            Manage proposals and track deal progress.
          </p>
        </div>
      </AppShellHeader>

      <div className='space-y-4'>
        {/* Tabs Row */}
        <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <ProposalsTabsNav activeTab='proposals' className='flex-1 sm:flex-none' />
          <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-6'>
            <span className='text-muted-foreground text-sm whitespace-nowrap'>
              Total proposals: {proposals.length}
            </span>
            <Button size='sm' onClick={handleNewProposal} className='gap-2'>
              <Plus className='h-4 w-4' />
              New Proposal
            </Button>
          </div>
        </div>

        <ProposalsPipelineSummary proposals={proposals} />

        {/* Main Container with Background */}
        <section className='bg-background rounded-xl border p-6 shadow-sm'>
          <ProposalsTable
            proposals={proposals}
            senderName={senderName}
            onEditProposal={handleEditProposal}
          />
        </section>
      </div>

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
    </>
  )
}
