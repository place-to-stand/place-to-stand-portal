'use client'

import { Building2, Handshake } from 'lucide-react'

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
import type { ClientForProposal } from '../_actions/fetch-clients-for-proposals'

export type ProposalTarget =
  | { type: 'lead'; lead: LeadRecord }
  | { type: 'client'; client: ClientForProposal }

type LeadPickerDialogProps = {
  leads: LeadRecord[]
  clients: ClientForProposal[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (target: ProposalTarget) => void
}

const ACTIVE_STATUSES = new Set([
  'NEW_OPPORTUNITIES',
  'ACTIVE_OPPORTUNITIES',
  'PROPOSAL_SENT',
  'ON_ICE',
])

export function LeadPickerDialog({
  leads,
  clients,
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
      title='Create a Proposal'
      description='Choose a lead or client to create a proposal for.'
    >
      <CommandInput placeholder='Search leads or clients...' />
      <CommandList>
        <CommandEmpty>No leads or clients found.</CommandEmpty>
        {clients.length > 0 && (
          <CommandGroup heading='Clients'>
            {clients.map(client => (
              <ClientItem
                key={client.id}
                client={client}
                onSelect={() => onSelect({ type: 'client', client })}
              />
            ))}
          </CommandGroup>
        )}
        {activeLeads.length > 0 && (
          <CommandGroup heading='Active Leads'>
            {activeLeads.map(lead => (
              <LeadItem
                key={lead.id}
                lead={lead}
                onSelect={() => onSelect({ type: 'lead', lead })}
              />
            ))}
          </CommandGroup>
        )}
        {closedLeads.length > 0 && (
          <CommandGroup heading='Closed Leads'>
            {closedLeads.map(lead => (
              <LeadItem
                key={lead.id}
                lead={lead}
                onSelect={() => onSelect({ type: 'lead', lead })}
              />
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
  onSelect: () => void
}) {
  return (
    <CommandItem
      value={`lead ${lead.contactName} ${lead.companyName ?? ''}`}
      onSelect={onSelect}
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

function ClientItem({
  client,
  onSelect,
}: {
  client: ClientForProposal
  onSelect: () => void
}) {
  return (
    <CommandItem
      value={`client ${client.name} ${client.primaryContactName ?? ''}`}
      onSelect={onSelect}
    >
      <Building2 className='mr-2 h-4 w-4 shrink-0' />
      <div className='flex min-w-0 flex-1 items-center justify-between gap-2'>
        <div className='min-w-0'>
          <span className='truncate font-medium'>{client.name}</span>
          {client.primaryContactName && (
            <span className='text-muted-foreground ml-1.5 text-xs'>
              {client.primaryContactName}
            </span>
          )}
        </div>
        <Badge variant='outline' className='shrink-0 text-[10px]'>
          Client
        </Badge>
      </div>
    </CommandItem>
  )
}
