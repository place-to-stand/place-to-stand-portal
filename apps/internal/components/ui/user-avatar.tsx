import type { ComponentProps } from 'react'

import { Avatar, AvatarFallback, AvatarImage } from '@pts/ui/avatar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@pts/ui/tooltip'
import { getInitials } from '@/lib/users/initials'

type UserAvatarProps = {
  /** The person (contact) id: their photo. Preferred over `userId`. */
  contactId?: string | null
  /** A sign-in id, where only that is known; shows the person's photo. */
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

/**
 * Where a person's photo loads from: by person (contact) id, else by sign-in
 * id. Null when they have no photo, so nothing is requested and the initials
 * show.
 */
export function personPhotoSrc({
  contactId,
  userId,
  hasPhoto = true,
  version,
}: Pick<UserAvatarProps, 'contactId' | 'userId' | 'hasPhoto' | 'version'>):
  | string
  | null {
  const query = version ? `?v=${encodeURIComponent(version)}` : ''
  if (!hasPhoto) return null
  if (contactId) return `/api/storage/person-avatar/${contactId}${query}`
  if (userId) return `/api/storage/user-avatar/${userId}${query}`
  return null
}

/** A person's avatar: their uploaded photo, falling back to initials. */
export function UserAvatar({
  contactId,
  userId,
  name,
  hasPhoto = true,
  version,
  size = 'sm',
  className,
  alt,
}: UserAvatarProps) {
  const src = personPhotoSrc({ contactId, userId, hasPhoto, version })

  return (
    <Avatar size={size} className={className}>
      {src ? <AvatarImage src={src} alt={alt ?? name ?? ''} /> : null}
      <AvatarFallback>{getInitials(name)}</AvatarFallback>
    </Avatar>
  )
}

type PersonAvatarProps = Omit<UserAvatarProps, 'alt' | 'name'> & {
  name: string
  /** Screen-reader name, e.g. "Originated by Ada"; defaults to the name. */
  ariaLabel?: string
}

/**
 * A person shown as just their avatar, named by a hover tooltip: the
 * compact people cell in list tables (Clients' Origination, Time logs'
 * Person).
 */
export function PersonAvatar({
  name,
  ariaLabel,
  size = 'sm',
  ...avatarProps
}: PersonAvatarProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span aria-label={ariaLabel ?? name} className='inline-flex'>
          <UserAvatar {...avatarProps} size={size} name={name} alt='' />
        </span>
      </TooltipTrigger>
      <TooltipContent>{name}</TooltipContent>
    </Tooltip>
  )
}
