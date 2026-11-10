'use client'

import { useEffect } from 'react'

import { personPhotoSrc } from '@/components/ui/user-avatar'

type Props = {
  staff: { userId: string; contactId: string }[]
}

/**
 * Loads every staff photo into the browser cache once the page is idle, so
 * avatars show at once instead of popping in as lists render. Screens reach
 * the same photo by sign-in id or by person id, so both URLs are warmed.
 */
export function AvatarPreloader({ staff }: Props) {
  useEffect(() => {
    const images: HTMLImageElement[] = []
    const load = () => {
      for (const { userId, contactId } of staff) {
        for (const src of [
          personPhotoSrc({ userId }),
          personPhotoSrc({ contactId }),
        ]) {
          if (!src) continue
          const image = new Image()
          image.decoding = 'async'
          image.src = src
          images.push(image)
        }
      }
    }

    if (typeof window.requestIdleCallback === 'function') {
      const handle = window.requestIdleCallback(load, { timeout: 2000 })
      return () => window.cancelIdleCallback(handle)
    }
    const handle = window.setTimeout(load, 200)
    return () => window.clearTimeout(handle)
  }, [staff])

  return null
}
