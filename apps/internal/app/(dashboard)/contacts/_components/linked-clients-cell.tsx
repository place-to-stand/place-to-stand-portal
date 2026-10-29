'use client'

import { Building2 } from 'lucide-react'

import { LinkedRecordsHoverCell } from '@/components/ui/linked-records-hover-cell'
import type { LinkedClient } from '@/lib/queries/contacts'
import { ENTITY_ACCENTS } from '@/lib/entity-accents'

type LinkedClientsCellProps = {
  clients: LinkedClient[]
}

export function LinkedClientsCell({ clients }: LinkedClientsCellProps) {
  return (
    <span className='text-sm'>
      <LinkedRecordsHoverCell
        withIcon
        count={clients.length}
        icon={Building2}
        iconClassName={ENTITY_ACCENTS.client.icon}
        contentClassName='w-56'
        items={clients.map(client => ({
          id: client.id,
          label: client.name,
          href: `/clients/${client.slug}`,
        }))}
      />
    </span>
  )
}
