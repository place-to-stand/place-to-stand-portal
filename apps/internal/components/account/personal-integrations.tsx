'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from '@/components/ui/use-toast'
import { Button } from '@pts/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@pts/ui/card'
import {
  ConnectedAccountsList,
  type ConnectedAccount,
} from '@/components/integrations/connected-accounts-list'
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

  // Google accounts query
  const { data: googleData, isLoading: googleLoading } = useQuery({
    queryKey: ['googleIntegrationStatus'],
    queryFn: async () => {
      const res = await fetch('/api/integrations/google/status')
      if (!res.ok) throw new Error('Failed to fetch Google status')
      return (await res.json()) as AccountsResponse
    },
  })

  // GitHub accounts query
  const { data: githubData, isLoading: githubLoading } = useQuery({
    queryKey: ['githubIntegrationStatus'],
    queryFn: async () => {
      const res = await fetch('/api/integrations/github/status')
      if (!res.ok) throw new Error('Failed to fetch GitHub status')
      return (await res.json()) as AccountsResponse
    },
  })

  // Google disconnect mutation
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

  // GitHub disconnect mutation
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

  const handleConnectGoogle = () => {
    setIsRedirectingGoogle(true)
    // API route redirecting to external OAuth — not a Next.js page.
    // oxlint-disable-next-line next-js/no-location-assign-relative-destination -- an API route that redirects to external OAuth, not a Next.js page
    window.location.href = '/api/auth/google'
  }

  const handleConnectGitHub = () => {
    setIsRedirectingGitHub(true)
    // oxlint-disable-next-line next-js/no-location-assign-relative-destination -- an API route that redirects to external OAuth, not a Next.js page
    window.location.href = '/api/auth/github'
  }

  // Transform API response to ConnectedAccount format
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
    // One column: the sheet is narrower than the old page.
    <div className='grid grid-cols-1 gap-4'>
      {/* Google Card */}
      <Card>
        <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
          <div className='flex flex-col space-y-1.5'>
            <CardTitle className='flex items-center gap-2'>
              <GoogleIcon className='h-5 w-5' />
              Google Workspace
            </CardTitle>
            <CardDescription>
              Connect your Google Workspace accounts to sync email.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {googleLoading ? (
            <div className='text-muted-foreground text-sm'>
              Checking status...
            </div>
          ) : googleAccounts.length > 0 ? (
            <ConnectedAccountsList
              provider='google'
              accounts={googleAccounts}
              onDisconnect={async id => disconnectGoogle.mutateAsync(id)}
              onAddAccount={handleConnectGoogle}
              onUpdatePermissions={handleConnectGoogle}
            />
          ) : (
            <div className='flex items-center justify-between'>
              <span className='text-muted-foreground text-sm'>
                Not connected
              </span>
              <Button
                variant='outline'
                disabled={isRedirectingGoogle}
                onClick={handleConnectGoogle}
              >
                {isRedirectingGoogle
                  ? 'Connecting...'
                  : 'Connect Google account'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* GitHub Card */}
      <Card>
        <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
          <div className='flex flex-col space-y-1.5'>
            <CardTitle className='flex items-center gap-2'>
              <GitHubIcon className='h-5 w-5' />
              GitHub
            </CardTitle>
            <CardDescription>
              Connect your GitHub accounts to sync repositories and create PRs.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {githubLoading ? (
            <div className='text-muted-foreground text-sm'>
              Checking status...
            </div>
          ) : githubAccounts.length > 0 ? (
            <ConnectedAccountsList
              provider='github'
              accounts={githubAccounts}
              onDisconnect={async id => disconnectGitHub.mutateAsync(id)}
              onAddAccount={handleConnectGitHub}
            />
          ) : (
            <div className='flex items-center justify-between'>
              <span className='text-muted-foreground text-sm'>
                Not connected
              </span>
              <Button
                variant='outline'
                disabled={isRedirectingGitHub}
                onClick={handleConnectGitHub}
              >
                {isRedirectingGitHub
                  ? 'Connecting...'
                  : 'Connect GitHub account'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <TokenIntegrationCard
        provider='VERCEL'
        description='Connect your Vercel account to link deployments to projects.'
      />

      <TokenIntegrationCard
        provider='SUPABASE'
        description='Connect your Supabase account to link databases to projects.'
      />

      <ConnectedAppsCard />
    </div>
  )
}
