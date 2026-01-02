'use client'

import Link from 'next/link'
import { ArrowDownLeft, ArrowUpRight, Mail } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

import { Badge } from '@/components/ui/badge'
import type { MessageForClient } from '@/lib/queries/messages'

type Props = {
  messages: MessageForClient[]
  isAdmin: boolean
}

export function ClientEmailsSection({ messages }: Props) {
  return (
    <section className='bg-card text-card-foreground overflow-hidden rounded-lg border'>
      <div className='flex items-center gap-3 border-b px-4 py-3'>
        <div className='flex h-7 w-7 items-center justify-center rounded-md bg-violet-500/10'>
          <Mail className='h-4 w-4 text-violet-500' />
        </div>
        <h2 className='font-semibold'>Messages</h2>
        <Badge variant='secondary' className='ml-auto'>
          {messages.length}
        </Badge>
        <Link
          href='/my/inbox'
          className='text-muted-foreground hover:text-foreground text-xs transition'
        >
          View all →
        </Link>
      </div>

      <div className='p-3'>
        {messages.length === 0 ? (
          <div className='text-muted-foreground rounded-md border border-dashed px-4 py-6 text-center text-sm'>
            No messages linked yet.
          </div>
        ) : (
          <div className='divide-y'>
            {messages.slice(0, 5).map(msg => (
              <div key={msg.id} className='group flex items-start gap-3 px-3 py-2.5'>
                <div className='mt-0.5 shrink-0'>
                  {msg.isInbound ? (
                    <ArrowDownLeft className='h-3.5 w-3.5 text-emerald-500' />
                  ) : (
                    <ArrowUpRight className='h-3.5 w-3.5 text-blue-500' />
                  )}
                </div>
                <div className='min-w-0 flex-1'>
                  <div className='truncate text-sm font-medium'>
                    {msg.subject || '(no subject)'}
                  </div>
                  <div className='text-muted-foreground mt-0.5 flex items-center gap-2 text-xs'>
                    <span className='truncate'>
                      {msg.fromName || msg.fromEmail}
                    </span>
                    <span className='shrink-0'>·</span>
                    <span className='shrink-0'>
                      {formatDistanceToNow(new Date(msg.sentAt), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {messages.length > 5 && (
              <div className='px-3 py-2 text-center'>
                <Link
                  href='/my/inbox'
                  className='text-muted-foreground hover:text-foreground text-xs transition'
                >
                  +{messages.length - 5} more
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
