'use client'

import { useEffect } from 'react'
import { useLinkStatus } from 'next/link'

type Props = {
  href: string
  onPendingChange: (href: string, pending: boolean) => void
}

/**
 * Reports whether its parent `Link`'s navigation is in flight. Next keeps
 * only the most recent click pending and drops it when that navigation
 * ends, however it ends (its page lands, a redirect, Back, a later click),
 * so the sidebar can trust it to never stick.
 */
export function NavLinkPending({ href, onPendingChange }: Props) {
  const { pending } = useLinkStatus()

  useEffect(() => {
    onPendingChange(href, pending)
  }, [href, pending, onPendingChange])

  return null
}
