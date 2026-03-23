'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

export function GitHubSuccessBanner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [dismissed, setDismissed] = useState(false)

  const githubParam = searchParams.get('github')
  const visible = githubParam === 'installed' && !dismissed

  const cleanUrl = useCallback(() => {
    const url = new URL(window.location.href)
    url.searchParams.delete('github')
    router.replace(url.pathname, { scroll: false })
  }, [router])

  useEffect(() => {
    if (githubParam !== 'installed') return

    // Clean URL param
    cleanUrl()

    // Auto-dismiss after 5s
    const timer = setTimeout(() => setDismissed(true), 5000)
    return () => clearTimeout(timer)
  }, [githubParam, cleanUrl])

  if (!visible) return null

  return (
    <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
      GitHub App installed successfully! You can now link a repository to this
      project.
    </div>
  )
}
