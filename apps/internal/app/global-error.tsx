'use client'

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang='en'>
      <body className='flex min-h-screen items-center justify-center bg-white font-sans text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100'>
        <div className='mx-auto max-w-md space-y-4 px-6 text-center'>
          <h2 className='text-xl font-semibold'>Something went wrong</h2>
          <p className='text-sm text-neutral-500 dark:text-neutral-400'>
            This usually happens after a network interruption. Try refreshing
            the page.
          </p>
          <div className='flex justify-center gap-3'>
            <button
              onClick={() => reset()}
              className='rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200'
            >
              Try again
            </button>
            <button
              onClick={() => window.location.reload()}
              className='rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900'
            >
              Reload page
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
