import type { ComponentProps } from 'react'

import { Avatar, AvatarFallback, AvatarImage } from '@pts/ui/avatar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@pts/ui/tooltip'
import { getInitials } from '@/lib/users/initials'
import {
  ENTITY_ACCENTS,
  ENTITY_ICONS,
  STATE_DOT_CLASS,
} from '@/lib/entity-accents'
import { cn } from '@/lib/utils'

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
  /** Can sign in: the avatar wears the sign-in dot, as the person icon does. */
  signIn?: boolean
  /**
   * Without a photo: `icon` shows the person icon (with the sign-in dot when
   * `signIn`), as a company shows its icon. Use it where the name sits beside
   * the avatar; keep `initials` where the avatar stands alone (stacks,
   * avatar-only cells), since there the initials say who it is.
   */
  fallback?: 'initials' | 'icon'
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
  string | null {
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
  signIn = false,
  fallback = 'initials',
}: UserAvatarProps) {
  const src = personPhotoSrc({ contactId, userId, hasPhoto, version })
  if (!src && fallback === 'icon') {
    const entity = signIn ? 'user' : 'contact'
    const Icon = ENTITY_ICONS[entity]
    // The avatar's footprint, so names line up with the photo rows.
    return (
      <span
        className={cn(
          'inline-flex shrink-0 items-center justify-center',
          className
        )}
        style={{ width: AVATAR_PX[size], height: AVATAR_PX[size] }}
      >
        <Icon
          aria-hidden
          className={cn(ENTITY_ACCENTS[entity].icon, 'size-4 shrink-0')}
        />
      </span>
    )
  }
  const mark = signIn ? signInMark(size) : null
  const avatar = (
    <Avatar
      size={size}
      className={className}
      // The dot is cut out of the circle, as on the marked icons, so it
      // reads on any row background.
      style={mark?.cutout}
    >
      {src ? <AvatarImage src={src} alt={alt ?? name ?? ''} /> : null}
      <AvatarFallback>
        {fallback === 'icon' ? (
          // A photo that fails to load still falls back to the icon.
          <ENTITY_ICONS.contact
            aria-hidden
            className={cn(ENTITY_ACCENTS.contact.icon, 'size-3/5')}
          />
        ) : (
          getInitials(name)
        )}
      </AvatarFallback>
    </Avatar>
  )
  if (!mark) return avatar
  return (
    <span className='relative inline-flex shrink-0'>
      {avatar}
      <span
        aria-hidden
        className={cn('absolute rounded-full', STATE_DOT_CLASS.user)}
        style={mark.dot}
      />
    </span>
  )
}

/** Avatar diameters in px, matching `AVATAR_SIZES` in @pts/ui/avatar. */
const AVATAR_PX = { xs: 20, sm: 24, md: 32, lg: 40, xl: 64 } as const

/**
 * The sign-in dot (about a third of the avatar, nudged 1px past its edge so it
 * covers less of the initials) and a cut-out 1.5px wider around it.
 */
function signInMark(size: keyof typeof AVATAR_PX) {
  const diameter = AVATAR_PX[size]
  const dot = Math.max(6, Math.round(diameter * 0.32))
  const centre = diameter - dot / 2 + 1
  const mask = `radial-gradient(circle at ${centre}px ${centre}px, transparent ${dot / 2 + 1.5}px, #000 ${dot / 2 + 2}px)`
  return {
    dot: { width: dot, height: dot, right: -1, bottom: -1 },
    cutout: { mask, WebkitMask: mask },
  }
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
