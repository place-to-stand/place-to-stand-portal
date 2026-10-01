'use client'

import { useEffect, useState } from 'react'
import posthog from 'posthog-js'

import { Button } from '@pts/ui/button'
import { EmptyState } from '@pts/ui/empty-state'

import { PageShell } from '@/components/layout/page-shell'

// A navigation whose RSC stream drops after the headers arrive (Chrome:
// "network error", Safari: "Load failed") rejects inside React's Flight
// decoder, so Next can't fall back to a browser navigation and the error lands
// here. Refetching the route almost always succeeds.
const TRANSIENT_NETWORK_ERROR =
  /network ?error|failed to fetch|load failed|connection closed/i

// One silent retry per window, so a route that keeps failing settles on the
// fallback instead of looping. Module scope survives the boundary remounting.
const AUTO_RETRY_WINDOW_MS = 15_000
let lastAutoRetryAt = 0

export default function DashboardError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  const transient =
    error instanceof TypeError && TRANSIENT_NETWORK_ERROR.test(error.message)
  // Decided once per mount: the boundary remounts for each new error.
  const [autoRetry] = useState(
    () => transient && Date.now() - lastAutoRetryAt > AUTO_RETRY_WINDOW_MS
  )

  // An explicit boundary counts as handled, so capture_exceptions never sees
  // it; report by hand (see global-error.tsx).
  useEffect(() => {
    posthog.captureException(error, {
      digest: error.digest,
      boundary: 'dashboard',
      auto_retry: autoRetry,
    })
    // Re-checked here so a Strict Mode double effect can't retry twice.
    if (autoRetry && Date.now() - lastAutoRetryAt > AUTO_RETRY_WINDOW_MS) {
      lastAutoRetryAt = Date.now()
      retry()
    }
  }, [error, autoRetry, retry])

  if (autoRetry) return null

  return (
    <PageShell breadcrumbs={[{ label: 'Error' }]}>
      <EmptyState
        message={
          transient
            ? 'The connection dropped while this page was loading.'
            : 'This page hit an error.'
        }
        action={<Button onClick={() => retry()}>Try again</Button>}
      />
    </PageShell>
  )
}
