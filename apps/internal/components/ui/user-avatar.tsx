import type { ComponentProps } from 'react'

import { Avatar, AvatarFallback, AvatarImage } from '@pts/ui/avatar'
import { getInitials } from '@/lib/users/initials'

type UserAvatarProps = {
  /** Portal user id; omit for people with no account (contacts). */
  userId?: string | null
  /** Display name for the initials fallback and alt text. */
  name: string | null | undefined
  /** Whether the user uploaded a photo; false skips the image request. */
  hasPhoto?: boolean
  /** Cache-buster, e.g. the user's `updatedAt`, so a new photo shows at once. */
  version?: string | null
  size?: ComponentProps<typeof Avatar>['size']
  className?: string
  /** Defaults to the name; pass '' when the name is already shown beside it. */
  alt?: string
}

/** A person's avatar: their uploaded photo, falling back to initials. */
export function UserAvatar({
  userId,
  name,
  hasPhoto = true,
  version,
  size = 'sm',
  className,
  alt,
}: UserAvatarProps) {
  const src =
    userId && hasPhoto
      ? `/api/storage/user-avatar/${userId}${version ? `?v=${encodeURIComponent(version)}` : ''}`
      : null

  return (
    <Avatar size={size} className={className}>
      {src ? <AvatarImage src={src} alt={alt ?? name ?? ''} /> : null}
      <AvatarFallback>{getInitials(name)}</AvatarFallback>
    </Avatar>
  )
}
