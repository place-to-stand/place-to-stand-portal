import type { Metadata } from 'next'
import { Geist, Geist_Mono, Space_Grotesk } from 'next/font/google'
import '@/styles/globals.css'

import { DEFAULT_BUSINESS_NAME } from '@pts/db/business'
import { BusinessBrandProvider } from '@pts/portal-ui/business-brand'
import { CompanyTimeZone } from '@placetostand/ui/company-time-zone'
import { TooltipProvider } from '@placetostand/ui/tooltip'

import { ThemeProvider } from '@/components/providers/theme-provider'
import { brandPropsFor, getBusinessOrNull } from '@/lib/business'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

/** The marketing site's logo face — the `BrandLogo` wordmark reads it. */
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
})

export async function generateMetadata(): Promise<Metadata> {
  const name = (await getBusinessOrNull())?.name ?? DEFAULT_BUSINESS_NAME
  return {
    title: {
      default: `Client Portal | ${name}`,
      template: `%s | ${name} Client Portal`,
    },
    description: 'View your projects and remaining hours',
    // A login-gated app — keep every route (sign-in, forgot-password, …) out
    // of search indexes. The marketing site links here, so crawlers do find it.
    robots: { index: false, follow: false },
  }
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Sets the business time zone for the server's date formatters too.
  const business = await getBusinessOrNull()

  return (
    <html lang='en' suppressHydrationWarning>
      <head>
        {/* Synchronous theme init — must run before first paint, otherwise the
            page renders light and then flips. Reads the stored preference and
            falls back to the system setting. Same key and class as the
            internal portal. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var theme = localStorage.getItem('theme');
                var isDark = theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches);
                if (isDark) document.documentElement.classList.add('dark');
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} font-sans antialiased`}
      >
        <ThemeProvider>
          {business ? <CompanyTimeZone timeZone={business.timeZone} /> : null}
          <BusinessBrandProvider
            brand={business ? brandPropsFor(business) : null}
          >
            <TooltipProvider>{children}</TooltipProvider>
          </BusinessBrandProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
