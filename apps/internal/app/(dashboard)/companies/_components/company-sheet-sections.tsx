'use client'

import { X } from 'lucide-react'

import { EmptyState } from '@pts/ui/empty-state'
import { RowActionButton } from '@pts/ui/row-action-button'
import {
  ClientLinkPicker,
  type ClientLink,
} from '@/components/clients/client-link-picker'
import { LeadStatusBadge } from '@/components/leads/lead-status-badge'
import { SheetSection } from '@/components/sheets/sheet-section'
import { useViewerAccess } from '@/components/providers/viewer-access-provider'
import { RecordRowButton } from '@/components/ui/record-row-button'
import { roleCan } from '@/lib/auth/capabilities'
import type { CompanyLeadSummary } from '@/lib/companies/types'
import { useSheetParams } from '@/lib/sheets/use-sheet-params'

import { SectionAddButton } from './section-add-button'

export function CompanyLeadsSection({
  leads,
}: {
  leads: CompanyLeadSummary[]
}) {
  const { open } = useSheetParams()

  return (
    <SheetSection
      title='Leads'
      action={
        <span className='text-muted-foreground text-xs'>{leads.length}</span>
      }
    >
      {leads.length === 0 ? (
        <EmptyState message='No leads at this company.' />
      ) : (
        <ul className='-mx-2 space-y-0.5'>
          {leads.map(lead => (
            <li key={lead.id}>
              <RecordRowButton
                variant='inset'
                onClick={() => open('lead', lead.id)}
                title={lead.contactName}
                subtitle={lead.assigneeName}
                trailing={<LeadStatusBadge status={lead.status} />}
              />
            </li>
          ))}
        </ul>
      )}
    </SheetSection>
  )
}

export function CompanyClientsSection({
  companyId,
  clients,
  added,
  movesFrom,
  disabled,
  onAdd,
  onRemoveAdded,
}: {
  companyId: string
  clients: { id: string; name: string; slug: string | null }[]
  /** Existing clients picked here, linked on Save. */
  added: ClientLink[]
  /** "Moves from …" for a picked client at another company now. */
  movesFrom: (clientId: string) => string | null
  disabled: boolean
  onAdd: (client: ClientLink) => void
  onRemoveAdded: (clientId: string) => void
}) {
  const { open } = useSheetParams()
  // Client records are admin-only; others just see the name.
  const { isAdmin, role } = useViewerAccess()
  const canManageClients = Boolean(role && roleCan(role, 'clients.manage'))
  const linkedIds = new Set(clients.map(client => client.id))
  const pending = added.filter(client => !linkedIds.has(client.id))

  return (
    <SheetSection
      title='Clients'
      action={
        canManageClients && !disabled ? (
          // Link an existing client, or create one on top with this company
          // picked.
          <ClientLinkPicker
            value={null}
            onChange={client => (client ? onAdd(client) : undefined)}
            excludeIds={[...linkedIds, ...pending.map(client => client.id)]}
            createParams={{ clientCompanyId: companyId }}
            trigger={<SectionAddButton label='Add client' />}
          />
        ) : (
          <SectionAddButton
            label='Add client'
            disabled={disabled}
            disabledReason={
              canManageClients ? null : 'Only an admin can add clients.'
            }
          />
        )
      }
    >
      {clients.length === 0 && pending.length === 0 ? (
        <EmptyState message='Not a client yet. Add a client, or convert a lead, to link one here.' />
      ) : (
        <ul className='-mx-2 space-y-0.5'>
          {clients.map(client => (
            <li key={client.id}>
              {isAdmin ? (
                <RecordRowButton
                  variant='inset'
                  onClick={() => open('client', client.id)}
                  title={client.name}
                />
              ) : (
                <p className='px-2 py-2 text-sm font-medium'>{client.name}</p>
              )}
            </li>
          ))}
          {pending.map(client => {
            const from = movesFrom(client.id)
            return (
              <li key={`added-${client.id}`} className='flex items-center gap-1'>
                <RecordRowButton
                  variant='inset'
                  onClick={() => open('client', client.id)}
                  title={client.name}
                  subtitle={
                    <span className='text-warning'>
                      {from ? `Moves from ${from}` : 'Pending save'}
                    </span>
                  }
                />
                <RowActionButton
                  type='button'
                  disabled={disabled}
                  label={`Don't link ${client.name}`}
                  onClick={() => onRemoveAdded(client.id)}
                  className='text-muted-foreground hover:text-destructive'
                  icon={<X />}
                />
              </li>
            )
          })}
        </ul>
      )}
    </SheetSection>
  )
}
