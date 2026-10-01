'use client'

import { useEffect } from 'react'
import posthog from 'posthog-js'

import { Button } from '@pts/ui/button'

// global-error replaces the root layout, so it brings its own stylesheet.
import './globals.css'

// No "Try again": this boundary sits above the router context, so reset() and
// retry() can't refetch; they re-render the same cached payload, and a dropped
// RSC stream throws again. Only a full reload recovers.
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string }
}) {
  // A custom global-error is an explicit boundary, so Next treats what it
  // catches as handled: production only console.errors it, and it never
  // reaches window.onerror, where capture_exceptions listens. Report it by
  // hand. The digest matches the server-side capture in instrumentation.ts.
  useEffect(() => {
    posthog.captureException(error, {
      digest: error.digest,
      boundary: 'global',
    })
  }, [error])

  return (
    <html lang='en'>
      <body className='bg-background text-foreground flex min-h-screen items-center justify-center font-sans'>
        <div className='mx-auto max-w-md space-y-4 px-6 text-center'>
          <h2 className='text-xl font-semibold'>Something went wrong</h2>
          <p className='text-muted-foreground text-sm'>
            This usually happens after a network interruption.
          </p>
          <Button onClick={() => window.location.reload()}>Reload page</Button>
        </div>
      </body>
    </html>
  )
}
