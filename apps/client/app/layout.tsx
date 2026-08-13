import type { Metadata } from 'next'
import '@/styles/globals.css'

import { ThemeProvider } from '@/components/providers/theme-provider'

export const metadata: Metadata = {
  title: 'Place to Stand - Client Portal',
  description: 'View your projects and remaining hours',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
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
      <body className="font-sans antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
