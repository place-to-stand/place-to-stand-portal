'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

import {
  PAGE_FORM_GUARD_ID,
  registerDiscardGuard,
} from '@/lib/sheets/discard-guards'

type Confirm = (next: () => void, stay?: () => void) => void

/** The Navigation API, where the browser has it (typed loosely: not in every lib). */
type NavigateEventLike = Event & {
  navigationType: string
  cancelable: boolean
  destination: { key: string; sameDocument: boolean }
}
type NavigationLike = EventTarget & {
  traverseTo: (key: string) => unknown
}

/**
 * While a page form has unsaved changes, leaving the page asks first, as
 * closing a sheet does:
 * - an in-app link (sidebar, breadcrumbs): a capture-phase click listener,
 *   ahead of Next's own Link handler; a new tab, a download or another site
 *   is left alone;
 * - the Ctrl K palette: the form registers as the page's discard guard
 *   (`PAGE_FORM_GUARD_ID`), which the palette asks after the open sheets;
 * - the browser's Back and Forward: the Navigation API's `navigate` event,
 *   cancelled and replayed after "Discard". Where the browser has no
 *   Navigation API, Back and Forward leave without asking.
 * Reloading or closing the tab is `useUnsavedChangesWarning`'s beforeunload.
 */
export function useConfirmLeavingPage(isDirty: boolean, confirm: Confirm) {
  const router = useRouter()

  useEffect(() => {
    if (!isDirty) return
    return registerDiscardGuard(PAGE_FORM_GUARD_ID, confirm)
  }, [confirm, isDirty])

  useEffect(() => {
    if (!isDirty) return
    const navigation = (window as { navigation?: NavigationLike }).navigation
    if (!navigation) return
    // Set while replaying a confirmed Back or Forward, so it isn't asked twice.
    let allowed: string | null = null

    const handleNavigate = (event: Event) => {
      const navigate = event as NavigateEventLike
      if (navigate.navigationType !== 'traverse' || !navigate.cancelable) return
      if (allowed === navigate.destination.key) {
        allowed = null
        return
      }
      const key = navigate.destination.key
      event.preventDefault()
      confirm(() => {
        allowed = key
        navigation.traverseTo(key)
      })
    }

    navigation.addEventListener('navigate', handleNavigate)
    return () => navigation.removeEventListener('navigate', handleNavigate)
  }, [confirm, isDirty])

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
