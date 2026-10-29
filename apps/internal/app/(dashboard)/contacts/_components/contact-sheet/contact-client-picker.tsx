import { Building2 } from 'lucide-react'

import { EmptyState } from '@pts/ui/empty-state'

export type ContactClientOption = {
  id: string
  name: string
  slug: string
}

export type ContactClientListProps = {
  clients: ContactClientOption[]
}

/**
 * The contact's clients, one row each. Read-only: a contact's clients follow
 * its company, so they change by changing the company.
 */
export function ContactClientList({ clients }: ContactClientListProps) {
  if (clients.length === 0) {
    return <EmptyState message='No client access yet.' />
  }

  return (
    <div className='flex flex-col gap-2'>
      {clients.map(client => (
        <div
          key={client.id}
          className='bg-muted/40 flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm leading-tight'
        >
          <Building2 className='text-muted-foreground h-4 w-4 shrink-0' />
          <span className='truncate font-medium'>{client.name}</span>
        </div>
      ))}
    </div>
  )
}
