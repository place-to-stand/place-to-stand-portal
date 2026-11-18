'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

type Confirm = (next: () => void, stay?: () => void) => void

/**
 * While a page form has unsaved changes, a click on any in-app link (the
 * sidebar, a breadcrumb) asks first, as closing a sheet does. Runs in the
 * capture phase on the document, ahead of Next's own Link handler; a new tab,
 * a download or another site is left alone. Reloading or closing the tab is
 * `useUnsavedChangesWarning`'s beforeunload.
 */
export function useConfirmLeavingPage(isDirty: boolean, confirm: Confirm) {
  const router = useRouter()

  useEffect(() => {
    if (!isDirty) return

    const handleClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return
      }
      const anchor =
        event.target instanceof Element
          ? event.target.closest<HTMLAnchorElement>('a[href]')
          : null
      if (
        !anchor ||
        anchor.target === '_blank' ||
        anchor.hasAttribute('download')
      ) {
        return
      }
      // A link inside a dialog or sheet over the page is that layer's own.
      if (anchor.closest('[role="dialog"], [role="alertdialog"]')) return
      const url = new URL(anchor.href, window.location.href)
      if (url.origin !== window.location.origin) return
      const here = window.location
      if (url.pathname === here.pathname && url.search === here.search) return

      event.preventDefault()
      event.stopPropagation()
      confirm(() => router.push(`${url.pathname}${url.search}${url.hash}`))
    }

    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [confirm, isDirty, router])
}
