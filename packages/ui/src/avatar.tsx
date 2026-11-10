'use client'

import * as React from 'react'
import { Avatar as AvatarPrimitive } from '@base-ui/react/avatar'

import { cn } from './cn'

/**
 * Circle size, with the fallback initials scaled to match. Pick a size rather
 * than overriding `size-*` and the initials' font size by hand.
 */
const AVATAR_SIZES = {
  xs: 'size-5 text-micro',
  sm: 'size-6 text-micro',
  md: 'size-8 text-xs',
  lg: 'size-10 text-sm',
  xl: 'size-16 text-base',
} as const

type AvatarSize = keyof typeof AVATAR_SIZES

function Avatar({
  className,
  size = 'md',
  ...props
}: AvatarPrimitive.Root.Props & { size?: AvatarSize }) {
  return (
    <AvatarPrimitive.Root
      data-slot='avatar'
      data-size={size}
      className={cn(
        'relative flex shrink-0 overflow-hidden rounded-full',
        AVATAR_SIZES[size],
        className
      )}
      {...props}
    />
  )
}

// Photos already shown on this page load. They come straight from the
// browser cache, so fading them in again would only add flicker.
const shownSrcs = new Set<string>()

/**
 * The photo fades in over the initials the first time it loads, rather than
 * swapping in hard; after that it shows at once.
 */
function AvatarImage({
  className,
  src,
  onLoadingStatusChange,
  ...props
}: AvatarPrimitive.Image.Props) {
  const key = typeof src === 'string' ? src : null
  const [fadeIn] = React.useState(() => !key || !shownSrcs.has(key))

  return (
    <AvatarPrimitive.Image
      data-slot='avatar-image'
      className={cn(
        'aspect-square size-full',
        fadeIn && 'animate-in fade-in duration-150 motion-reduce:animate-none',
        className
      )}
      src={src}
      onLoadingStatusChange={status => {
        if (status === 'loaded' && key) shownSrcs.add(key)
        onLoadingStatusChange?.(status)
      }}
      {...props}
    />
  )
}

function AvatarFallback({
  className,
  ...props
}: AvatarPrimitive.Fallback.Props) {
  return (
    <AvatarPrimitive.Fallback
      data-slot='avatar-fallback'
      className={cn(
        'bg-muted flex size-full items-center justify-center rounded-full',
        className
      )}
      {...props}
    />
  )
}

export { Avatar, AvatarImage, AvatarFallback }
