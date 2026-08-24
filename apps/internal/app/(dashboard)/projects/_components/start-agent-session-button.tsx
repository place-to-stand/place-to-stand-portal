'use client'

import { useCallback, useTransition, type MouseEvent, type PointerEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { Bot, Loader2 } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/use-toast'

import { startAgentSessionFromTask } from '@/app/(dashboard)/agents/actions/start-from-task'
import { AGENT_SESSIONS_OVERVIEW_KEY } from '@/app/(dashboard)/agents/_components/agent-sessions-list'

type StartAgentSessionButtonProps = {
  taskId: string
  projectId: string
  taskTitle: string
  /** `icon` for tight spaces (board card overlay), `label` for the sheet header. */
  variant?: 'icon' | 'label'
  className?: string
}

/**
 * Creates an agent session scoped to the task's project, links the task to
 * it, seeds an opening message, and navigates to it — used from both the
 * kanban board (icon, hover-revealed) and the task sheet header (labeled).
 */
export function StartAgentSessionButton({
  taskId,
  projectId,
  taskTitle,
  variant = 'icon',
  className,
}: StartAgentSessionButtonProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()

  const handleClick = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation()
      e.preventDefault()
      if (isPending) return

      startTransition(async () => {
        const result = await startAgentSessionFromTask({ taskId, projectId })
        if ('error' in result) {
          toast({ variant: 'destructive', title: 'Error', description: result.error })
          return
        }

        const message = `Let's work through the task "${taskTitle}" — bring me up to speed on where it stands and what needs deciding.`
        const response = await fetch('/api/agents/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: result.sessionId, message }),
        })
        if (!response.ok) {
          const body: { error?: string } | null = await response.json().catch(() => null)
          toast({ variant: 'destructive', title: 'Error', description: body?.error ?? 'Failed to start session.' })
          return
        }

        queryClient.invalidateQueries({ queryKey: [AGENT_SESSIONS_OVERVIEW_KEY] })
        router.push(`/agents?session=${result.sessionId}`)
      })
    },
    [taskId, projectId, taskTitle, isPending, toast, router, queryClient]
  )

  // Board cards spread dnd-kit's drag listeners across the whole card, so a
  // pointerdown here must never bubble — otherwise clicking this button
  // starts a drag instead of (or alongside) the click.
  const handlePointerDown = useCallback((e: PointerEvent) => {
    e.stopPropagation()
  }, [])

  if (variant === 'label') {
    return (
      <Button
        type='button'
        variant='outline'
        size='sm'
        className={className}
        disabled={isPending}
        onClick={handleClick}
        onPointerDown={handlePointerDown}
      >
        {isPending ? (
          <Loader2 className='mr-1.5 h-3.5 w-3.5 animate-spin' />
        ) : (
          <Bot className='mr-1.5 h-3.5 w-3.5' />
        )}
        Start agent session
      </Button>
    )
  }

  return (
    <Button
      type='button'
      variant='ghost'
      size='icon'
      className={cn('h-6 w-6', className)}
      disabled={isPending}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      title='Start agent session'
    >
      {isPending ? <Loader2 className='h-3.5 w-3.5 animate-spin' /> : <Bot className='h-3.5 w-3.5' />}
    </Button>
  )
}
