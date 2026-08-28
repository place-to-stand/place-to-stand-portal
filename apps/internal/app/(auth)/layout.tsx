import type { ReactNode } from 'react'
import { Space_Grotesk } from 'next/font/google'

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

/**
 * Space Grotesk is the marketing site's headline/logo face. It is loaded here
 * rather than in the root layout so it ships only with the signed-out screens
 * — the dashboard keeps Geist.
 */
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
})

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <div className={spaceGrotesk.variable}>{children}</div>
}
