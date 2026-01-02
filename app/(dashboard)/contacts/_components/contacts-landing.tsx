'use client'

import { Building2, Contact } from 'lucide-react'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { ContactsTableContact } from '@/lib/settings/contacts/use-contacts-table-state'

type ContactsLandingProps = {
  contacts: ContactsTableContact[]
}

export function ContactsLanding({ contacts }: ContactsLandingProps) {
  if (contacts.length === 0) {
    return (
      <div className='grid h-full w-full place-items-center rounded-xl border border-dashed p-12 text-center'>
        <div className='space-y-2'>
          <h2 className='text-lg font-semibold'>No contacts found</h2>
          <p className='text-muted-foreground text-sm'>
            Contacts will appear here once they are created.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className='rounded-lg border'>
      <Table>
        <TableHeader>
          <TableRow className='bg-muted/40'>
            <TableHead className='w-[300px]'>Email</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Linked Clients</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contacts.map(contact => (
            <TableRow key={contact.id}>
              <TableCell>
                <div className='flex items-center gap-2 py-1'>
                  <Contact className='h-4 w-4 shrink-0 text-cyan-500' />
                  <span className='font-medium'>{contact.email}</span>
                </div>
              </TableCell>
              <TableCell className='text-muted-foreground'>
                {contact.name || '—'}
              </TableCell>
              <TableCell>
                <div className='flex items-center gap-2 text-sm'>
                  <Building2 className='text-muted-foreground h-4 w-4' />
                  <span className='text-muted-foreground'>
                    {contact.metrics.totalClients} client
                    {contact.metrics.totalClients !== 1 ? 's' : ''}
                  </span>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
