import type { ReactNode } from 'react'
import { Space_Grotesk } from 'next/font/google'

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
