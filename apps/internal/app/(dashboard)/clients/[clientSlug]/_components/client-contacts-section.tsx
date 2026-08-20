'use client'

import { Mail, Phone, Star, UserCheck, Users } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import type { ContactWithClientLink } from '@/lib/types/client-contacts'
import {
  CLICKABLE_ROW_CLASS,
  getClickableRowProps,
} from '@/lib/table/clickable-row'
import { useSheetParams } from '@/lib/sheets/use-sheet-params'
import { prefetchSheetInit } from '@/lib/sheets/wrappers/use-sheet-init'
import { cn } from '@/lib/utils'

type Props = {
  contacts: ContactWithClientLink[]
}

export function ClientContactsSection({ contacts }: Props) {
  return (
    <section className='bg-card text-card-foreground overflow-hidden rounded-lg border'>
      <div className='flex items-center gap-3 border-b px-4 py-3'>
        <div className='flex h-7 w-7 items-center justify-center rounded-md bg-cyan-500/10'>
          <Users className='h-4 w-4 text-cyan-500' />
        </div>
        <h2 className='font-semibold'>Contacts</h2>
        <Badge variant='secondary' className='ml-auto'>
          {contacts.length}
        </Badge>
      </div>

      <div className='p-3'>
        {contacts.length === 0 ? (
          <div className='text-muted-foreground rounded-md border border-dashed px-4 py-6 text-center text-sm'>
            No contacts linked yet. Use the Edit button to manage contacts.
          </div>
        ) : (
          <div className='space-y-0.5'>
            {contacts.map(contact => (
              <ContactRow key={contact.id} contact={contact} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function ContactRow({ contact }: { contact: ContactWithClientLink }) {
  // Opens over this page via `?contact=` — the global SheetHost serves it,
  // so no local sheet instance is needed here.
  const { open } = useSheetParams()

  return (
    <div
      className={cn(
        'hover:bg-muted/50 flex items-start gap-3 rounded-md px-3 py-2.5 transition',
        CLICKABLE_ROW_CLASS
      )}
      onPointerEnter={() => prefetchSheetInit('contact', contact.id)}
      {...getClickableRowProps(() => open('contact', contact.id))}
    >
      <div className='min-w-0 flex-1'>
        <div className='flex items-center gap-2'>
          {contact.name ? (
            <span className='truncate text-sm font-medium'>{contact.name}</span>
          ) : (
            <span className='text-muted-foreground truncate text-sm'>
              No name
            </span>
          )}
          {contact.isPrimary && (
            <Star className='h-3 w-3 shrink-0 fill-amber-400 text-amber-400' />
          )}
          {contact.userId && (
            <span title='Has portal access'>
              <UserCheck className='h-3 w-3 shrink-0 text-emerald-500' />
            </span>
          )}
        </div>
        {/* w-fit keeps the anchors to their text width — the rest of the row
            stays the row's click target for opening the contact sheet. */}
        <a
          href={`mailto:${contact.email}`}
          className='text-muted-foreground hover:text-foreground mt-0.5 flex w-fit max-w-full items-center gap-1.5 text-xs transition'
        >
          <Mail className='h-3 w-3' />
          {contact.email}
        </a>
        {contact.phone ? (
          <a
            href={`tel:${contact.phone}`}
            className='text-muted-foreground hover:text-foreground mt-0.5 flex w-fit max-w-full items-center gap-1.5 text-xs transition'
          >
            <Phone className='h-3 w-3' />
            {contact.phone}
          </a>
        ) : null}
      </div>
    </div>
  )
}
