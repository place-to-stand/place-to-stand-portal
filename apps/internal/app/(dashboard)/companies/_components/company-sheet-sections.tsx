'use client'

import { ExternalLink, Star } from 'lucide-react'

import { Badge } from '@pts/ui/badge'
import { EmptyState } from '@pts/ui/empty-state'
import { RowActionButton } from '@pts/ui/row-action-button'
import { LeadStatusBadge } from '@/components/leads/lead-status-badge'
import { SheetSection } from '@/components/sheets/sheet-section'
import { RecordRowButton } from '@/components/ui/record-row-button'
import type {
  CompanyContactSummary,
  CompanyLeadSummary,
} from '@/lib/companies/types'
import { useSheetParams } from '@/lib/sheets/use-sheet-params'
import { cn } from '@/lib/utils'

export function CompanyContactsSection({
  contacts,
  disabled,
  onSetChampion,
}: {
  contacts: CompanyContactSummary[]
  disabled: boolean
  onSetChampion: (contactId: string | null) => void
}) {
  const { open } = useSheetParams()

  return (
    <SheetSection
      title='People'
      description='Everyone we know here. Star the champion: the person pushing for us inside.'
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
                    {contact.isChampion ? (
                      <Badge
                        variant='outline'
                        className='ml-2 align-middle text-xs'
                      >
                        Champion
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
                aria-pressed={contact.isChampion}
                label={
                  contact.isChampion
                    ? `Remove ${contact.name} as champion`
                    : `Make ${contact.name} the champion`
                }
                onClick={() =>
                  onSetChampion(contact.isChampion ? null : contact.id)
                }
                icon={
                  <Star
                    className={cn(
                      contact.isChampion && 'fill-amber-400 text-amber-500'
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
