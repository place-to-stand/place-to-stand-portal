'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

import { subscribe, type ToastMessage } from './toast'
import { ToastCard } from './toast-card'
import { ToastRecordLink } from './toast-record-link'

const TOAST_GAP = 12

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
      if (shownRef.current === 0) {
        setLifted(
          document.querySelector('[data-slot="sheet-content"]') !== null
        )
      }
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
      {toasts.map(toast => (
        <ToastCard
          key={toast.id}
          title={toast.title}
          description={toast.description}
          variant={toast.variant}
          link={
            toast.link ? (
              // The link reads the URL, which needs a Suspense boundary.
              <Suspense fallback={null}>
                <ToastRecordLink
                  link={toast.link}
                  onOpen={() => dismiss(toast.id)}
                />
              </Suspense>
            ) : null
          }
          onDismiss={() => dismiss(toast.id)}
        />
      ))}
    </div>
  )
}
