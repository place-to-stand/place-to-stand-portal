import type { ReactNode } from 'react'

/** The error box at the bottom of every sheet form. Renders nothing when empty. */
export function FormFeedback({ children }: { children?: ReactNode }) {
  if (!children) return null
  return (
    <p
      role='alert'
      className='border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm'
    >
      {children}
    </p>
  )
}
