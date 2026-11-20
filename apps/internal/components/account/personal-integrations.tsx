'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from '@/components/ui/use-toast'
import {
  ConnectedAccountsList,
  type ConnectedAccount,
} from '@/components/integrations/connected-accounts-list'
import {
  IntegrationCard,
  IntegrationConnectButton,
  IntegrationStatus,
} from '@/components/integrations/integration-card'
import { ConnectedAppsCard } from '@/components/integrations/connected-apps-card'
import { TokenIntegrationCard } from '@/components/integrations/token-integration-card'

import { GitHubIcon, GoogleIcon } from './provider-icons'

const OAUTH_MESSAGES: Record<
  string,
  { title: string; description?: string; variant?: 'destructive' }
> = {
  google_connected: { title: 'Google connected' },
  github_connected: { title: 'GitHub connected' },
  access_denied: {
    title: 'Unable to connect account',
    description: 'Access to the account was denied.',
    variant: 'destructive',
  },
  invalid_request: {
    title: 'Unable to connect account',
    description: 'The OAuth request was invalid. Please try again.',
    variant: 'destructive',
  },
  invalid_state: {
    title: 'Unable to connect account',
    description: 'State validation failed. Please try again.',
    variant: 'destructive',
  },
  oauth_failed: {
    title: 'Unable to connect account',
    description: 'Please try again.',
    variant: 'destructive',
  },
}

interface AccountsResponse {
  connected: boolean
  accounts: Array<{
    id: string
    email: string | null
    displayName: string | null
    status: string
    login?: string
    scopes: string[]
    lastSyncAt: string | null
    connectedAt: string
    metadata: {
      picture?: string
      avatar_url?: string
      name?: string
      login?: string
    }
  }>
}

/**
 * Your own connections, in the Account sheet's Integrations section: Google
 * (mail on leads), GitHub, Vercel and Supabase (linking projects) and the
 * apps connected as you. Every one of them only ever touches your own.
 */
export function PersonalIntegrations() {
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const [isRedirectingGoogle, setIsRedirectingGoogle] = useState(false)
  const [isRedirectingGitHub, setIsRedirectingGitHub] = useState(false)

  useEffect(() => {
    const success = searchParams.get('success')
    const error = searchParams.get('error')
    const key = success || error

    if (key && OAUTH_MESSAGES[key]) {
      const msg = OAUTH_MESSAGES[key]
      toast({
        title: msg.title,
        description: msg.description,
        variant: msg.variant,
      })
      // Drop the OAuth result from the URL, keeping the open Account sheet.
      const url = new URL(window.location.href)
      url.searchParams.delete('success')
      url.searchParams.delete('error')
      window.history.replaceState(null, '', url)
    }
  }, [searchParams])

  const { data: googleData, isLoading: googleLoading } = useQuery({
    queryKey: ['googleIntegrationStatus'],
    queryFn: async () => {
      const res = await fetch('/api/integrations/google/status')
      if (!res.ok) throw new Error('Failed to fetch Google status')
      return (await res.json()) as AccountsResponse
    },
  })

  const { data: githubData, isLoading: githubLoading } = useQuery({
    queryKey: ['githubIntegrationStatus'],
    queryFn: async () => {
      const res = await fetch('/api/integrations/github/status')
      if (!res.ok) throw new Error('Failed to fetch GitHub status')
      return (await res.json()) as AccountsResponse
    },
  })

  const disconnectGoogle = useMutation({
    mutationFn: async (connectionId: string) => {
      const res = await fetch('/api/integrations/google/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId }),
      })
      if (!res.ok) throw new Error('Please try again.')
    },
    onSuccess: async () => {
      toast({ title: 'Google account disconnected' })
      await queryClient.invalidateQueries({
        queryKey: ['googleIntegrationStatus'],
      })
    },
    onError: (err: unknown) => {
      toast({
        title: 'Unable to disconnect Google',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      })
    },
  })

  const disconnectGitHub = useMutation({
    mutationFn: async (connectionId: string) => {
      const res = await fetch('/api/integrations/github/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId }),
      })
      if (!res.ok) throw new Error('Please try again.')
    },
    onSuccess: async () => {
      toast({ title: 'GitHub account disconnected' })
      await queryClient.invalidateQueries({
        queryKey: ['githubIntegrationStatus'],
      })
    },
    onError: (err: unknown) => {
      toast({
        title: 'Unable to disconnect GitHub',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      })
    },
  })

  // Come back to this page with the Account sheet open, whatever is under it.
  const returnTo = () => {
    const url = new URL(window.location.href)
    url.searchParams.delete('success')
    url.searchParams.delete('error')
    url.searchParams.set('account', 'integrations')
    return encodeURIComponent(`${url.pathname}${url.search}`)
  }

  const handleConnectGoogle = () => {
    setIsRedirectingGoogle(true)
    // oxlint-disable-next-line next-js/no-location-assign-relative-destination -- an API route that redirects to external OAuth, not a Next.js page
    window.location.href = `/api/auth/google?returnTo=${returnTo()}`
  }

  const handleConnectGitHub = () => {
    setIsRedirectingGitHub(true)
    // oxlint-disable-next-line next-js/no-location-assign-relative-destination -- an API route that redirects to external OAuth, not a Next.js page
    window.location.href = `/api/auth/github?returnTo=${returnTo()}`
  }

  const transformAccounts = (
    accounts: AccountsResponse['accounts'] | undefined
  ): ConnectedAccount[] => {
    if (!accounts) return []
    return accounts.map(a => ({
      id: a.id,
      email: a.email,
      displayName: a.displayName,
      status: a.status,
      login: a.login || a.metadata?.login,
      lastSyncAt: a.lastSyncAt,
      connectedAt: a.connectedAt,
      metadata: a.metadata,
    }))
  }

  const googleAccounts = transformAccounts(googleData?.accounts)
  const githubAccounts = transformAccounts(githubData?.accounts)

  return (
    <div className='flex flex-col gap-3'>
      <IntegrationCard
        icon={<GoogleIcon />}
        title='Google Workspace'
        description='Mail with leads and people, in their sheets.'
        action={
          googleLoading ? (
            <IntegrationStatus>Checking...</IntegrationStatus>
          ) : googleAccounts.length === 0 ? (
            <IntegrationConnectButton
              pending={isRedirectingGoogle}
              onClick={handleConnectGoogle}
            />
          ) : null
        }
      >
        {googleAccounts.length > 0 ? (
          <ConnectedAccountsList
            provider='google'
            accounts={googleAccounts}
            onDisconnect={async id => disconnectGoogle.mutateAsync(id)}
            onAddAccount={handleConnectGoogle}
            onUpdatePermissions={handleConnectGoogle}
          />
        ) : null}
      </IntegrationCard>

      <IntegrationCard
        icon={<GitHubIcon />}
        title='GitHub'
        description='Link repositories to projects and open PRs.'
        action={
          githubLoading ? (
            <IntegrationStatus>Checking...</IntegrationStatus>
          ) : githubAccounts.length === 0 ? (
            <IntegrationConnectButton
              pending={isRedirectingGitHub}
              onClick={handleConnectGitHub}
            />
          ) : null
        }
      >
        {githubAccounts.length > 0 ? (
          <ConnectedAccountsList
            provider='github'
            accounts={githubAccounts}
            onDisconnect={async id => disconnectGitHub.mutateAsync(id)}
            onAddAccount={handleConnectGitHub}
          />
        ) : null}
      </IntegrationCard>

      <TokenIntegrationCard
        provider='VERCEL'
        description='Link deployments to projects.'
      />
      <TokenIntegrationCard
        provider='SUPABASE'
        description='Link databases to projects.'
      />
      <ConnectedAppsCard />
    </div>
  )
}
