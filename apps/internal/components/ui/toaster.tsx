'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { subscribe, type ToastMessage } from './toast'
import { ToastCard } from './toast-card'
import { ToastRecordLink } from './toast-record-link'

const TOAST_GAP = 12

export function Toaster() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const timeoutsRef = useRef<Map<string, number>>(new Map())

  useEffect(() => {
    const timeouts = timeoutsRef.current
    const unsubscribe = subscribe(toast => {
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
      // Above an open sheet's footer, so a toast never covers its save buttons.
      className='pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center px-4 transition-[bottom] duration-200 sm:items-end [body:has([data-slot=sheet-content])_&]:bottom-16'
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
