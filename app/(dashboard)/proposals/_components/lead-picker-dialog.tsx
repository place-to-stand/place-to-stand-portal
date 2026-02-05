'use client'

import { Handshake } from 'lucide-react'

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Badge } from '@/components/ui/badge'
import { LEAD_STATUS_LABELS, LEAD_STATUS_TOKENS } from '@/lib/leads/constants'
import type { LeadRecord } from '@/lib/leads/types'

type LeadPickerDialogProps = {
  leads: LeadRecord[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (lead: LeadRecord) => void
}

const ACTIVE_STATUSES = new Set([
  'NEW_OPPORTUNITIES',
  'ACTIVE_OPPORTUNITIES',
  'PROPOSAL_SENT',
  'ON_ICE',
])

export function LeadPickerDialog({
  leads,
  open,
  onOpenChange,
  onSelect,
}: LeadPickerDialogProps) {
  const activeLeads = leads.filter(l => ACTIVE_STATUSES.has(l.status))
  const closedLeads = leads.filter(l => !ACTIVE_STATUSES.has(l.status))

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title='Select a Lead'
      description='Choose a lead to create a proposal for.'
    >
      <CommandInput placeholder='Search leads by name or company...' />
      <CommandList>
        <CommandEmpty>No leads found.</CommandEmpty>
        {activeLeads.length > 0 && (
          <CommandGroup heading='Active Leads'>
            {activeLeads.map(lead => (
              <LeadItem key={lead.id} lead={lead} onSelect={onSelect} />
            ))}
          </CommandGroup>
        )}
        {closedLeads.length > 0 && (
          <CommandGroup heading='Closed'>
            {closedLeads.map(lead => (
              <LeadItem key={lead.id} lead={lead} onSelect={onSelect} />
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  )
}

function LeadItem({
  lead,
  onSelect,
}: {
  lead: LeadRecord
  onSelect: (lead: LeadRecord) => void
}) {
  return (
    <CommandItem
      value={`${lead.contactName} ${lead.companyName ?? ''}`}
      onSelect={() => onSelect(lead)}
    >
      <Handshake className='mr-2 h-4 w-4 shrink-0' />
      <div className='flex min-w-0 flex-1 items-center justify-between gap-2'>
        <div className='min-w-0'>
          <span className='truncate font-medium'>{lead.contactName}</span>
          {lead.companyName && (
            <span className='text-muted-foreground ml-1.5 text-xs'>
              {lead.companyName}
            </span>
          )}
        </div>
        <Badge
          variant='outline'
          className={`shrink-0 text-[10px] ${LEAD_STATUS_TOKENS[lead.status]}`}
        >
          {LEAD_STATUS_LABELS[lead.status]}
        </Badge>
      </div>
    </CommandItem>
  )
}
