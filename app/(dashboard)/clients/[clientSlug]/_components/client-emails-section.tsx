'use client'

import Link from 'next/link'
import { ArrowDownLeft, ArrowUpRight, Mail } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { MessageForClient } from '@/lib/queries/messages'

type Props = {
  messages: MessageForClient[]
  currentUserId: string
}

export function ClientEmailsSection({ messages, currentUserId }: Props) {
  return (
    <section className='bg-card text-card-foreground overflow-hidden rounded-lg border'>
      <div className='flex items-center gap-3 border-b px-4 py-3'>
        <div className='bg-muted flex h-7 w-7 items-center justify-center rounded-md'>
          <Mail className='text-muted-foreground h-4 w-4' />
        </div>
        <h2 className='font-semibold'>Messages</h2>
        <Badge variant='secondary' className='ml-auto'>
          {messages.length}
        </Badge>
      </div>

      <div className='p-3'>
        {messages.length === 0 ? (
          <div className='text-muted-foreground rounded-md border border-dashed px-4 py-6 text-center text-sm'>
            No messages linked yet.
          </div>
        ) : (
          <TooltipProvider delayDuration={300}>
            <div className='divide-y'>
              {messages.slice(0, 5).map(msg => (
                <MessageRow
                  key={msg.id}
                  message={msg}
                  isOwned={msg.userId === currentUserId}
                />
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
          </TooltipProvider>
        )}
      </div>
    </section>
  )
}

type MessageRowProps = {
  message: MessageForClient
  isOwned: boolean
}

function MessageRow({ message, isOwned }: MessageRowProps) {
  const userDisplayName = message.user?.fullName ?? 'Unknown'
  const userInitials = getInitials(userDisplayName)
  const avatarSrc = message.user?.avatarUrl
    ? `/api/storage/user-avatar/${message.userId}?v=${encodeURIComponent(message.user.updatedAt ?? '')}`
    : null

  const content = (
    <>
      <div className='mt-0.5 shrink-0'>
        {message.isInbound ? (
          <ArrowDownLeft className='h-3.5 w-3.5 text-emerald-500' />
        ) : (
          <ArrowUpRight className='h-3.5 w-3.5 text-blue-500' />
        )}
      </div>
      <div className='min-w-0 flex-1'>
        <div className='truncate text-sm font-medium'>
          {message.subject || '(no subject)'}
        </div>
        <div className='text-muted-foreground mt-0.5 flex items-center gap-2 text-xs'>
          <span className='truncate'>
            {message.fromName || message.fromEmail}
          </span>
          <span className='shrink-0'>·</span>
          <span className='shrink-0'>
            {formatDistanceToNow(new Date(message.sentAt), {
              addSuffix: true,
            })}
          </span>
        </div>
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <Avatar className='h-6 w-6 shrink-0'>
            {avatarSrc ? (
              <AvatarImage src={avatarSrc} alt={userDisplayName} />
            ) : null}
            <AvatarFallback className='text-[9px]'>
              {userInitials}
            </AvatarFallback>
          </Avatar>
        </TooltipTrigger>
        <TooltipContent side='left'>
          <p className='text-xs'>{userDisplayName}&apos;s inbox</p>
        </TooltipContent>
      </Tooltip>
    </>
  )

  if (isOwned) {
    return (
      <Link
        href={`/my/inbox?thread=${message.threadId}`}
        className='hover:bg-muted/50 flex items-center gap-3 px-3 py-2.5 transition'
      >
        {content}
      </Link>
    )
  }

  return (
    <div className='flex items-center gap-3 px-3 py-2.5 opacity-60'>
      {content}
    </div>
  )
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(segment => segment[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}
