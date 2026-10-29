'use client'

import { Building2, Handshake, X } from 'lucide-react'

import { EmptyState } from '@pts/ui/empty-state'
import { RowActionButton } from '@pts/ui/row-action-button'
import {
  ClientLinkPicker,
  type ClientLink,
} from '@/components/clients/client-link-picker'
import { LeadStatusBadge } from '@/components/leads/lead-status-badge'
import { SheetSection } from '@/components/sheets/sheet-section'
import { useViewerAccess } from '@/components/providers/viewer-access-provider'
import {
  SheetRecordList,
  SheetRecordRow,
} from '@/components/sheets/sheet-record-row'
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
        <SheetRecordList>
          {leads.map(lead => (
            <SheetRecordRow
              key={lead.id}
              icon={Handshake}
              onOpen={() => open('lead', lead.id)}
              title={lead.contactName}
              description={lead.assigneeName}
              actions={
                <span className='pr-1.5'>
                  <LeadStatusBadge status={lead.status} />
                </span>
              }
            />
          ))}
        </SheetRecordList>
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
        <SheetRecordList>
          {clients.map(client => (
            <SheetRecordRow
              key={client.id}
              icon={Building2}
              title={client.name}
              // Client records are admin-only; others just see the name.
              onOpen={isAdmin ? () => open('client', client.id) : undefined}
            />
          ))}
          {pending.map(client => {
            const from = movesFrom(client.id)
            return (
              <SheetRecordRow
                key={`added-${client.id}`}
                icon={Building2}
                onOpen={() => open('client', client.id)}
                title={client.name}
                description={
                  <span className='text-warning'>
                    {from ? `Moves from ${from}` : 'Pending save'}
                  </span>
                }
                actions={
                  <RowActionButton
                    type='button'
                    disabled={disabled}
                    label={`Don't link ${client.name}`}
                    onClick={() => onRemoveAdded(client.id)}
                    className='text-muted-foreground hover:text-destructive'
                    icon={<X />}
                  />
                }
              />
            )
          })}
        </SheetRecordList>
      )}
    </SheetSection>
  )
}
