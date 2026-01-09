'use client'

import Link from 'next/link'
import { Building2 } from 'lucide-react'

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'
import type { LinkedClient } from '@/lib/queries/contacts'

type LinkedClientsCellProps = {
  clients: LinkedClient[]
}

export function LinkedClientsCell({ clients }: LinkedClientsCellProps) {
  const count = clients.length

  if (count === 0) {
    return <span className='text-muted-foreground/50'>0</span>
  }

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <button
          type='button'
          className='text-foreground cursor-pointer border-b border-dotted border-current transition hover:border-solid focus:outline-none'
        >
          {count}
        </button>
      </HoverCardTrigger>
      <HoverCardContent align='start' className='w-56 p-0'>
        <ul className='py-1'>
          {clients.map(client => (
            <li key={client.id}>
              <Link
                href={`/clients/${client.slug}`}
                className='hover:bg-accent flex items-center gap-2 px-3 py-2 text-sm transition-colors'
              >
                <Building2 className='text-muted-foreground h-4 w-4 shrink-0' />
                <span className='truncate'>{client.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </HoverCardContent>
    </HoverCard>
  )
}
