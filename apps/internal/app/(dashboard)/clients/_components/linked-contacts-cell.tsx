'use client'

import { Contact, Star } from 'lucide-react'

import { LinkedRecordsHoverCell } from '@/components/ui/linked-records-hover-cell'
import type { ClientContactSummary } from '@/lib/queries/clients/contact-summaries'
import { contactSheetHref } from '@/lib/sheets/hrefs'

type LinkedContactsCellProps = {
  contacts: ClientContactSummary[]
}

/**
 * Contact count on the clients landing table; hovering lists each linked
 * contact (name + email), primary first and tagged, and opens their sheet on
 * the contacts page.
 */
export function LinkedContactsCell({ contacts }: LinkedContactsCellProps) {
  const count = contacts.length

  return (
    <div className='flex items-center gap-2 text-sm'>
      <Contact className='text-muted-foreground h-4 w-4 shrink-0' />
      <LinkedRecordsHoverCell
        count={count}
        icon={Contact}
        ariaLabel={`${count} ${count === 1 ? 'contact' : 'contacts'}`}
        triggerClassName='text-muted-foreground'
        contentClassName='w-72'
        items={contacts.map(contact => ({
          id: contact.id,
          // Unnamed contacts show their email as the title, not twice.
          label: contact.name ?? contact.email,
          sublabel: contact.name ? contact.email : null,
          href: contactSheetHref(contact.id),
          trailing: contact.isPrimary ? (
            <Star
              role='img'
              aria-label='Primary contact'
              className='text-warning size-3.5 shrink-0 fill-current'
            />
          ) : null,
        }))}
      />
    </div>
  )
}
