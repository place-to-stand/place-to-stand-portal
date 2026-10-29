'use client'

import { ExternalLink, Star } from 'lucide-react'

import { Badge } from '@pts/ui/badge'
import { Button } from '@pts/ui/button'
import { SheetSection } from '@/components/sheets/sheet-section'
import type {
  CompanyContactSummary,
  CompanyLeadSummary,
} from '@/lib/companies/types'
import { getLeadStatusToken, LEAD_STATUS_LABELS } from '@/lib/leads/constants'
import { useSheetParams } from '@/lib/sheets/use-sheet-params'
import { cn } from '@/lib/utils'

const ROW_CLASS =
  'hover:bg-muted/50 flex w-full items-center gap-3 rounded-md px-2 py-2 text-left'

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
        <p className='text-muted-foreground text-sm'>
          No contacts yet. Set this company on a contact to list them here.
        </p>
      ) : (
        <ul className='-mx-2 space-y-0.5'>
          {contacts.map(contact => (
            <li key={contact.id} className='flex items-center gap-1'>
              <button
                type='button'
                className={ROW_CLASS}
                onClick={() => open('contact', contact.id)}
              >
                <span className='min-w-0 flex-1'>
                  <span className='block truncate text-sm font-medium'>
                    {contact.name}
                    {contact.isChampion ? (
                      <Badge variant='outline' className='ml-2 align-middle text-xs'>
                        Champion
                      </Badge>
                    ) : null}
                  </span>
                  <span className='text-muted-foreground block truncate text-xs'>
                    {contact.jobTitle ?? contact.email}
                  </span>
                </span>
              </button>
              {contact.linkedinUrl ? (
                <Button asChild variant='ghost' size='icon' className='h-8 w-8 shrink-0'>
                  <a
                    href={contact.linkedinUrl}
                    target='_blank'
                    rel='noopener noreferrer'
                    aria-label={`${contact.name} on LinkedIn`}
                  >
                    <ExternalLink className='h-4 w-4' />
                  </a>
                </Button>
              ) : null}
              <Button
                type='button'
                variant='ghost'
                size='icon'
                className='h-8 w-8 shrink-0'
                disabled={disabled}
                aria-pressed={contact.isChampion}
                aria-label={
                  contact.isChampion
                    ? `Remove ${contact.name} as champion`
                    : `Make ${contact.name} the champion`
                }
                title={contact.isChampion ? 'Remove champion' : 'Make champion'}
                onClick={() =>
                  onSetChampion(contact.isChampion ? null : contact.id)
                }
              >
                <Star
                  className={cn(
                    'h-4 w-4',
                    contact.isChampion && 'fill-amber-400 text-amber-500'
                  )}
                />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </SheetSection>
  )
}

export function CompanyLeadsSection({ leads }: { leads: CompanyLeadSummary[] }) {
  const { open } = useSheetParams()

  return (
    <SheetSection
      title='Leads'
      action={<span className='text-muted-foreground text-xs'>{leads.length}</span>}
    >
      {leads.length === 0 ? (
        <p className='text-muted-foreground text-sm'>No leads at this company.</p>
      ) : (
        <ul className='-mx-2 space-y-0.5'>
          {leads.map(lead => (
            <li key={lead.id}>
              <button
                type='button'
                className={ROW_CLASS}
                onClick={() => open('lead', lead.id)}
              >
                <span className='min-w-0 flex-1'>
                  <span className='block truncate text-sm font-medium'>
                    {lead.contactName}
                  </span>
                  {lead.assigneeName ? (
                    <span className='text-muted-foreground block truncate text-xs'>
                      {lead.assigneeName}
                    </span>
                  ) : null}
                </span>
                <Badge
                  variant='outline'
                  className={cn(
                    'shrink-0 text-xs font-semibold tracking-wide uppercase',
                    getLeadStatusToken(lead.status)
                  )}
                >
                  {LEAD_STATUS_LABELS[lead.status]}
                </Badge>
              </button>
            </li>
          ))}
        </ul>
      )}
    </SheetSection>
  )
}
