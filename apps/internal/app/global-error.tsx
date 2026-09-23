'use client'

import { Button } from '@pts/ui/button'

// global-error replaces the root layout, so it brings its own stylesheet.
import './globals.css'

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
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
