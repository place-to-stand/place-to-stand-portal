'use client'

import { useEffect, useRef, useState } from 'react'
import { subscribe, type ToastMessage } from './toast'
import { ToastCard } from './toast-card'

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
      className='pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center px-4 sm:items-end'
      style={{ gap: TOAST_GAP }}
      aria-live='polite'
    >
      {toasts.map(toast => (
        <ToastCard
          key={toast.id}
          title={toast.title}
          description={toast.description}
          variant={toast.variant}
          onDismiss={() => dismiss(toast.id)}
        />
      ))}
    </div>
  )
}
