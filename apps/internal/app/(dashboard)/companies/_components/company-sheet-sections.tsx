'use client'

import { ExternalLink, Star } from 'lucide-react'

import { Badge } from '@pts/ui/badge'
import { EmptyState } from '@pts/ui/empty-state'
import { RowActionButton } from '@pts/ui/row-action-button'
import { LeadStatusBadge } from '@/components/leads/lead-status-badge'
import { SheetSection } from '@/components/sheets/sheet-section'
import { useViewerAccess } from '@/components/providers/viewer-access-provider'
import { RecordRowButton } from '@/components/ui/record-row-button'
import type {
  CompanyContactSummary,
  CompanyLeadSummary,
} from '@/lib/companies/types'
import { useSheetParams } from '@/lib/sheets/use-sheet-params'
import { cn } from '@/lib/utils'

export function CompanyContactsSection({
  contacts,
  primaryContactId,
  disabled,
  onSetPrimary,
}: {
  contacts: CompanyContactSummary[]
  /** The form's current choice, so the star follows unsaved edits. */
  primaryContactId: string | null
  disabled: boolean
  onSetPrimary: (contactId: string | null) => void
}) {
  const { open } = useSheetParams()

  return (
    <SheetSection
      title='People'
      description='Everyone we know here. Star the primary contact; clients use them too.'
      action={
        <span className='text-muted-foreground text-xs'>{contacts.length}</span>
      }
    >
      {contacts.length === 0 ? (
        <EmptyState message='No contacts yet. Set this company on a contact to list them here.' />
      ) : (
        <ul className='-mx-2 space-y-0.5'>
          {contacts.map(contact => (
            <li key={contact.id} className='flex items-center gap-1'>
              <RecordRowButton
                variant='inset'
                onClick={() => open('contact', contact.id)}
                title={
                  <>
                    {contact.name}
                    {(contact.id === primaryContactId) ? (
                      <Badge
                        variant='outline'
                        className='ml-2 align-middle text-xs'
                      >
                        Primary
                      </Badge>
                    ) : null}
                  </>
                }
                subtitle={contact.jobTitle ?? contact.email}
              />
              {contact.linkedinUrl ? (
                <RowActionButton
                  type='button'
                  label={`${contact.name} on LinkedIn`}
                  icon={<ExternalLink />}
                  onClick={() =>
                    window.open(
                      contact.linkedinUrl ?? '',
                      '_blank',
                      'noopener,noreferrer'
                    )
                  }
                />
              ) : null}
              <RowActionButton
                type='button'
                disabled={disabled}
                aria-pressed={(contact.id === primaryContactId)}
                label={
                  (contact.id === primaryContactId)
                    ? `Remove ${contact.name} as primary contact`
                    : `Make ${contact.name} the primary contact`
                }
                onClick={() =>
                  onSetPrimary((contact.id === primaryContactId) ? null : contact.id)
                }
                icon={
                  <Star
                    className={cn(
                      (contact.id === primaryContactId) && 'fill-amber-400 text-amber-500'
                    )}
                  />
                }
              />
            </li>
          ))}
        </ul>
      )}
    </SheetSection>
  )
}

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
  clients,
}: {
  clients: { id: string; name: string; slug: string | null }[]
}) {
  const { open } = useSheetParams()
  // Client records are admin-only; others just see the name.
  const { isAdmin } = useViewerAccess()

  return (
    <SheetSection title='Clients'>
      {clients.length === 0 ? (
        <EmptyState message='Not a client yet. Converting a lead or setting this company on a client links it here.' />
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
        </ul>
      )}
    </SheetSection>
  )
}
