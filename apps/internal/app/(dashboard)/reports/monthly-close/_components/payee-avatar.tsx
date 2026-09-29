import { LinkIcon } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@pts/ui/avatar'

import { getInitials, userAvatarSrc } from './format'

type PayeeAvatarProps = {
  kind: 'user' | 'contact'
  id: string
  name: string
  avatarUpdatedAt: string | null
  size?: 'sm' | 'md'
}

/** A staff avatar, or a dashed link mark for an external referrer. */
export function PayeeAvatar({
  kind,
  id,
  name,
  avatarUpdatedAt,
  size = 'md',
}: PayeeAvatarProps) {
  if (kind === 'contact') {
    return (
      <div
        className={
          size === 'md'
            ? 'text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full border border-dashed'
            : 'text-muted-foreground flex size-6 shrink-0 items-center justify-center rounded-full border border-dashed'
        }
      >
        <LinkIcon className='size-3.5' />
      </div>
    )
  }

  const src = userAvatarSrc(id, avatarUpdatedAt)
  return (
    <Avatar size={size}>
      {src ? <AvatarImage src={src} alt={name} /> : null}
      <AvatarFallback>{getInitials(name)}</AvatarFallback>
    </Avatar>
  )
}
