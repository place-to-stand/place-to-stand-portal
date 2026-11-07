'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

import { closeSaveInFlight } from '@/lib/sheets/save-mode'

import { subscribe, type ToastMessage } from './toast'
import { ToastCard } from './toast-card'
import { ToastRecordLink } from './toast-record-link'

const TOAST_GAP = 12

function isSuccess(toast: ToastMessage) {
  return (
    !toast.variant || toast.variant === 'default' || toast.variant === 'success'
  )
}

/**
 * Whether a sheet's footer will still be on screen under this toast. A
 * success from Save and close means its sheet is closing, so only a sheet
 * stacked beneath it (if any) stays.
 */
function sheetStaysOpen(toast: ToastMessage) {
  const open = document.querySelectorAll(
    '[data-slot="sheet-content"]:not([data-closed])'
  ).length
  const closing = isSuccess(toast) && closeSaveInFlight() ? 1 : 0
  return open - closing > 0
}

export function Toaster() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const timeoutsRef = useRef<Map<string, number>>(new Map())
  // Toasts that arrive while a sheet is open sit above its footer, so they
  // never cover its buttons. Decided when the first toast arrives and kept
  // until all are gone: a toast never moves while it's on screen.
  const [lifted, setLifted] = useState(false)
  const shownRef = useRef(0)
  useEffect(() => {
    shownRef.current = toasts.length
  }, [toasts])

  useEffect(() => {
    const timeouts = timeoutsRef.current
    const unsubscribe = subscribe(toast => {
      if (shownRef.current === 0) setLifted(sheetStaysOpen(toast))
      shownRef.current += 1
      setToasts(current => [...current, toast])

      if (toast.duration && toast.duration > 0) {
        const timeoutId = window.setTimeout(() => {
          timeouts.delete(toast.id)
          setToasts(current => current.filter(item => item.id !== toast.id))
        }, toast.duration)

        timeouts.set(toast.id, timeoutId)
      }
    })

    return () => {
      unsubscribe()
      timeouts.forEach(timeoutId => window.clearTimeout(timeoutId))
      timeouts.clear()
    }
  }, [])

  const dismiss = (id: string) => {
    const timeoutId = timeoutsRef.current.get(id)
    if (typeof timeoutId === 'number') {
      window.clearTimeout(timeoutId)
      timeoutsRef.current.delete(id)
    }

    setToasts(current => current.filter(toast => toast.id !== id))
  }

  if (toasts.length === 0) {
    return null
  }

  return (
    <div
      className={cn(
        'pointer-events-none fixed inset-x-0 z-50 flex flex-col items-center px-4 sm:items-end',
        lifted ? 'bottom-16' : 'bottom-4'
      )}
      style={{ gap: TOAST_GAP }}
      aria-live='polite'
    >
      {toasts.map(toast => {
        // A success about a named record shows the name as its link: one
        // line instead of the name and an "Open task" line.
        const name =
          isSuccess(toast) &&
          toast.link &&
          typeof toast.description === 'string'
            ? toast.description
            : undefined
        const link = toast.link ? (
          // The link reads the URL, which needs a Suspense boundary.
          <Suspense fallback={null}>
            <ToastRecordLink
              link={toast.link}
              name={name}
              onOpen={() => dismiss(toast.id)}
            />
          </Suspense>
        ) : null
        return (
          <ToastCard
            key={toast.id}
            title={toast.title}
            description={name ? undefined : toast.description}
            variant={toast.variant}
            link={link}
            onDismiss={() => dismiss(toast.id)}
          />
        )
      })}
    </div>
  )
}
