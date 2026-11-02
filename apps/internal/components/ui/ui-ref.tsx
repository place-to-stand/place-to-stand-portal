import type { ReactNode } from 'react'

/**
 * A control or section named in helper text ("Turn on Can sign in below."):
 * medium weight in the normal text colour, so it reads as the thing to find
 * on screen, not as part of the sentence. Not a link; no quotes.
 */
export function UiRef({ children }: { children: ReactNode }) {
  return <span className='text-foreground font-medium'>{children}</span>
}
