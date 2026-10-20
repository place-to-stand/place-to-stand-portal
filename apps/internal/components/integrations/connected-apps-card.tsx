'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bot, Loader2, Unplug } from 'lucide-react'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@pts/ui/card'
import { ConfirmDialog } from '@pts/ui/confirm-dialog'
import { formatCalendarDate } from '@pts/ui/dates'
import { EmptyState } from '@pts/ui/empty-state'
import { RowActionButton } from '@pts/ui/row-action-button'
import { toast } from '@/components/ui/use-toast'
import type { ConnectedApp } from '@/lib/mcp/grants'

const QUERY_KEY = ['connectedApps'] as const

type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: string }

/**
 * Apps connected to the portal through the MCP server (PRD 009 §6). They are
 * connected from the app itself (claude.ai, Claude Code), so this card only
 * lists and revokes.
 */
export function ConnectedAppsCard() {
  const queryClient = useQueryClient()
  const [pendingRevoke, setPendingRevoke] = useState<ConnectedApp | null>(null)

  const { data, isLoading, isError } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const res = await fetch('/api/integrations/connected-apps')
      const body = (await res.json()) as ApiResponse<ConnectedApp[]>
      if (!body.ok) throw new Error(body.error)
      return body.data
    },
  })

  const revoke = useMutation({
    mutationFn: async (app: ConnectedApp) => {
      const res = await fetch('/api/integrations/connected-apps/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: app.clientId }),
      })
      const body = (await res.json()) as ApiResponse<unknown>
      if (!body.ok) throw new Error(body.error)
      return app
    },
    onSuccess: async app => {
      toast({ title: `${app.name} revoked` })
      await queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
    onError: (error: unknown) => {
      toast({
        title: 'Unable to revoke app',
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive',
      })
    },
  })

  const handleConfirm = () => {
    if (pendingRevoke) {
      revoke.mutate(pendingRevoke)
    }
    setPendingRevoke(null)
  }

  return (
    <>
      <Card>
        <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
          <div className='flex flex-col space-y-1.5'>
            <CardTitle className='flex items-center gap-2'>
              <Bot className='h-5 w-5' />
              Connected apps
            </CardTitle>
            <CardDescription>
              Apps like Claude that you connected through MCP. They act as you.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className='text-muted-foreground text-sm'>
              Checking status...
            </div>
          ) : isError ? (
            <div className='text-muted-foreground text-sm'>
              Unable to load connected apps.
            </div>
          ) : !data?.length ? (
            <EmptyState message='No apps connected.' />
          ) : (
            <div className='space-y-3'>
              {data.map(app => {
                const isRevoking =
                  revoke.isPending &&
                  revoke.variables?.clientId === app.clientId

                return (
                  <div
                    key={app.clientId}
                    className='flex items-center justify-between rounded-lg border p-3'
                  >
                    <div className='flex flex-col'>
                      <span className='text-sm font-medium'>{app.name}</span>
                      <span className='text-muted-foreground text-xs'>
                        Connected {formatCalendarDate(app.grantedAt) ?? '—'}
                      </span>
                    </div>
                    <RowActionButton
                      label={`Revoke ${app.name}`}
                      icon={
                        isRevoking ? (
                          <Loader2 className='animate-spin' />
                        ) : (
                          <Unplug />
                        )
                      }
                      className='text-muted-foreground hover:text-destructive'
                      disabled={isRevoking}
                      onClick={() => setPendingRevoke(app)}
                    />
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={pendingRevoke !== null}
        title='Revoke app?'
        description={
          pendingRevoke
            ? `${pendingRevoke.name} loses access to the portal right away. Connect it again from the app to use it.`
            : ''
        }
        confirmLabel='Revoke'
        confirmVariant='destructive'
        onConfirm={handleConfirm}
        onCancel={() => setPendingRevoke(null)}
      />
    </>
  )
}
