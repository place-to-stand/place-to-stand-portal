'use client'

import { useEffect } from 'react'
import posthog from 'posthog-js'

import { Button } from '@pts/ui/button'

// global-error replaces the root layout, so it brings its own stylesheet.
import '@/styles/globals.css'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  // A custom global-error is an explicit boundary, so Next treats what it
  // catches as handled: production only console.errors it, and it never
  // reaches window.onerror, where capture_exceptions listens. Report it by
  // hand. The digest matches the server-side capture in instrumentation.ts.
  useEffect(() => {
    posthog.captureException(error, { digest: error.digest, boundary: 'global' })
  }, [error])

  return (
    <html lang='en'>
      <body className='bg-background text-foreground flex min-h-screen items-center justify-center font-sans'>
        <div className='mx-auto max-w-md space-y-4 px-6 text-center'>
          <h2 className='text-xl font-semibold'>Something went wrong</h2>
          <p className='text-muted-foreground text-sm'>
            This usually happens after a network interruption. Try refreshing
            the page.
          </p>
          <div className='flex justify-center gap-3'>
            <Button onClick={() => reset()}>Try again</Button>
            <Button variant='outline' onClick={() => window.location.reload()}>
              Reload page
            </Button>
          </div>
        </div>
      </body>
    </html>
  )
}
