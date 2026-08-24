'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

/**
 * Consumes the GitHub App install callback's `?github=installed|error&reason=`
 * return param (set by `/api/github/callback`), then strips it via
 * `router.replace` so a refresh doesn't re-show the banner.
 *
 * `redirectPath` is the path to replace the URL with once the param is
 * consumed — pass the page's own pathname (e.g. `/projects/${projectId}` or
 * `/`), matching whatever `returnTo` was passed to `/api/github/install`.
 */
export function useGitHubCallbackNotice(redirectPath: string): {
  notice: string | null
  error: string | null
} {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const github = searchParams.get('github')
    if (!github) return

    if (github === 'installed') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing component state with the URL (an external system)
      setNotice('GitHub connected.')
    } else if (github === 'error') {
      const reason = searchParams.get('reason')
      setError(
        reason === 'already_linked'
          ? 'That GitHub organization is already connected to a different client.'
          : 'Failed to connect GitHub. Please try again.'
      )
    }

    router.replace(redirectPath, { scroll: false })
    // Only run once per param — router.replace clears them on the next render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  return { notice, error }
}
