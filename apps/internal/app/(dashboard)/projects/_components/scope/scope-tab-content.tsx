'use client'

import { useCallback, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { TabsContent } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/use-toast'

import type { SowStatusValue } from '@/lib/scope/sow-status'

import {
  fetchSowsForProject,
  unlinkSow,
  updateSowStatus,
} from '../../actions/sow'
import { SowPickerButton } from './sow-picker-button'
import { SowCard } from './sow-card'

const SOWS_QUERY_KEY = 'project-sows'

type ScopeTabContentProps = {
  isActive: boolean
  projectId: string | null
}

export function ScopeTabContent({
  isActive,
  projectId,
}: ScopeTabContentProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const queryKey = useMemo(() => [SOWS_QUERY_KEY, projectId], [projectId])

  const { data: sows = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => {
      if (!projectId) return []
      return fetchSowsForProject({ projectId })
    },
    enabled: isActive && Boolean(projectId),
    staleTime: 30_000,
  })

  const handleLinked = useCallback(() => {
    queryClient.invalidateQueries({ queryKey })
  }, [queryClient, queryKey])

  const handleSynced = useCallback(() => {
    queryClient.invalidateQueries({ queryKey })
  }, [queryClient, queryKey])

  const handleStatusChange = useCallback(
    async (sowId: string, status: SowStatusValue) => {
      const result = await updateSowStatus({ sowId, status })
      if ('error' in result) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: result.error,
        })
        throw new Error(result.error)
      }
      queryClient.invalidateQueries({ queryKey })
    },
    [toast, queryClient, queryKey]
  )

  const handleUnlink = useCallback(
    async (sowId: string) => {
      const result = await unlinkSow({ sowId })
      if ('error' in result) {
        toast({ variant: 'destructive', title: 'Error', description: result.error })
        return
      }
      toast({ title: 'SOW unlinked' })
      queryClient.invalidateQueries({ queryKey })
    },
    [toast, queryClient, queryKey]
  )

  return (
    <TabsContent
      value='scope'
      className='flex min-h-0 flex-1 flex-col gap-4 sm:gap-6'
    >
      {isLoading ? (
        <div className='flex flex-1 items-center justify-center'>
          <p className='text-muted-foreground text-xs'>Loading...</p>
        </div>
      ) : sows.length === 0 ? (
        <section className='bg-background rounded-xl border p-6 shadow-sm'>
          <SowPickerButton
            projectId={projectId ?? ''}
            variant='empty-state'
            onLinked={handleLinked}
          />
        </section>
      ) : (
        <section className='bg-background flex min-h-0 flex-1 flex-col rounded-xl border shadow-sm'>
          {/* Header */}
          <div className='flex items-center justify-between border-b px-6 py-4'>
            <div className='space-y-1'>
              <h3 className='text-lg font-semibold'>Scope documents</h3>
              <p className='text-muted-foreground text-sm'>
                {sows.length} {sows.length === 1 ? 'SOW' : 'SOWs'} linked to
                this project.
              </p>
            </div>
            <SowPickerButton
              projectId={projectId ?? ''}
              variant='header'
              onLinked={handleLinked}
            />
          </div>

          {/* SOW cards */}
          <div className='flex-1 space-y-3 overflow-y-auto p-6'>
            {sows.map(sow => (
              <SowCard
                key={sow.id}
                sow={sow}
                onUnlink={handleUnlink}
                onSynced={handleSynced}
                onStatusChange={handleStatusChange}
              />
            ))}
          </div>
        </section>
      )}
    </TabsContent>
  )
}
