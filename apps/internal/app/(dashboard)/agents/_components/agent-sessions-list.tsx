'use client'

import { useCallback, useRef, useState, useTransition } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { Loader2, Pencil, Trash2 } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@pts/ui/avatar'
import { Button } from '@pts/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@pts/ui/alert-dialog'
import { getActorInitials } from '@/lib/activity/feed-highlights'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import type { AgentSessionListItem } from '@/lib/data/agent-sessions'

import { fetchAgentSessionsOverview } from '../actions/session-overview'
import { renameAgentSession, archiveAgentSession } from '../actions/manage-session'

export const AGENT_SESSIONS_OVERVIEW_KEY = 'agent-sessions-overview'
const POLL_INTERVAL = 4_000

type AgentSessionsListProps = {
  initialSessions: AgentSessionListItem[]
  /** An admin id, or `'all'` for the everyone view — see SessionOwnerSelector. */
  ownerId: string
  selectedId: string | null
  onSelect: (id: string | null) => void
}

/** The left pane: every session with live status, selecting one swaps the right pane's content in place. */
export function AgentSessionsList({ initialSessions, ownerId, selectedId, onSelect }: AgentSessionsListProps) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const originalTitleRef = useRef('')
  const skipNextBlurCommitRef = useRef(false)

  const { data } = useQuery({
    queryKey: [AGENT_SESSIONS_OVERVIEW_KEY, ownerId],
    queryFn: () => fetchAgentSessionsOverview(ownerId),
    initialData: initialSessions,
    refetchInterval: query => {
      const sessions = query.state.data
      if (!sessions) return false
      return sessions.some(session => session.turnStatus === 'streaming') ? POLL_INTERVAL : false
    },
  })

  const sessions = data ?? initialSessions

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [AGENT_SESSIONS_OVERVIEW_KEY] })
  }, [queryClient])

  const startEditing = useCallback((session: AgentSessionListItem, e: React.MouseEvent) => {
    e.stopPropagation()
    skipNextBlurCommitRef.current = false
    originalTitleRef.current = session.title ?? ''
    setEditValue(session.title ?? '')
    setEditingId(session.id)
  }, [])

  const commitTitle = useCallback(
    (sessionId: string) => {
      const skip = skipNextBlurCommitRef.current
      skipNextBlurCommitRef.current = false
      setEditingId(null)
      if (skip) return

      const title = editValue.trim()
      if (!title || title === originalTitleRef.current) return

      startTransition(async () => {
        const result = await renameAgentSession({ sessionId, title })
        if ('error' in result) {
          toast({ variant: 'destructive', title: 'Error', description: result.error })
          return
        }
        invalidate()
      })
    },
    [editValue, toast, invalidate]
  )

  const handleTitleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation()
    if (e.key === 'Enter') {
      e.preventDefault()
      e.currentTarget.blur()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      skipNextBlurCommitRef.current = true
      e.currentTarget.blur()
    }
  }, [])

  const handleArchive = useCallback(
    (session: AgentSessionListItem) => {
      startTransition(async () => {
        const result = await archiveAgentSession({ sessionId: session.id })
        if ('error' in result) {
          toast({ variant: 'destructive', title: 'Error', description: result.error })
          return
        }
        if (selectedId === session.id) onSelect(null)
        invalidate()
      })
    },
    [toast, invalidate, selectedId, onSelect]
  )

  if (sessions.length === 0) {
    return (
      <div className='flex h-full flex-col items-center justify-center gap-1 p-6 text-center'>
        <p className='text-sm font-medium'>No sessions yet</p>
        <p className='text-xs text-muted-foreground'>Start one from a project on the right.</p>
      </div>
    )
  }

  return (
    <div className='flex flex-col gap-0.5'>
      {sessions.map(session => {
        const isSelected = selectedId === session.id
        const isEditing = editingId === session.id
        return (
          <div
            key={session.id}
            role='button'
            tabIndex={0}
            onClick={() => !isEditing && onSelect(session.id)}
            onKeyDown={e => {
              if (isEditing) return
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onSelect(session.id)
              }
            }}
            className={cn(
              'group flex cursor-pointer items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
              isSelected ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
            )}
          >
            <LastUserAvatar session={session} isSelected={isSelected} />
            <div className='flex min-w-0 flex-1 flex-col gap-0.5'>
              {isEditing ? (
                <input
                  autoFocus
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onClick={e => e.stopPropagation()}
                  onKeyDown={handleTitleKeyDown}
                  onBlur={() => commitTitle(session.id)}
                  className='w-full rounded-sm border border-input bg-background px-1 py-0.5 text-sm font-medium text-foreground outline-none ring-1 ring-ring'
                />
              ) : (
                <span className='truncate font-medium'>{session.title ?? 'Untitled session'}</span>
              )}
              <div className='flex min-w-0 items-center justify-between gap-2'>
                <span
                  className={cn(
                    'min-w-0 truncate text-xs',
                    isSelected ? 'text-primary-foreground/70' : 'text-muted-foreground'
                  )}
                >
                  {session.scopeLabel ?? 'Unscoped'}
                </span>
                {!isEditing && (
                  <div
                    className='flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100'
                    onClick={e => e.stopPropagation()}
                  >
                    <Button
                      type='button'
                      variant='ghost'
                      size='icon'
                      className={cn(
                        'h-5 w-5',
                        isSelected
                          ? 'text-primary-foreground hover:bg-primary-foreground/20 hover:text-primary-foreground'
                          : 'text-muted-foreground'
                      )}
                      title='Rename session'
                      onClick={e => startEditing(session, e)}
                    >
                      <Pencil className='h-2 w-2' />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          type='button'
                          variant='ghost'
                          size='icon'
                          className={cn(
                            'h-5 w-5',
                            isSelected
                              ? 'text-primary-foreground hover:bg-primary-foreground/20 hover:text-primary-foreground'
                              : 'text-muted-foreground hover:text-destructive'
                          )}
                          title='Archive session'
                        >
                          <Trash2 className='h-2 w-2' />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Archive this session?</AlertDialogTitle>
                          <AlertDialogDescription>
                            &ldquo;{session.title ?? 'Untitled session'}&rdquo; will be removed from the sessions
                            list. Its messages are kept, not deleted.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction disabled={isPending} onClick={() => handleArchive(session)}>
                            Archive
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </div>
            </div>
            <div className='flex shrink-0 flex-col items-end gap-1'>
              <StatusChip session={session} isSelected={isSelected} />
              <span className={cn('text-[10px]', isSelected ? 'text-primary-foreground/60' : 'text-muted-foreground')}>
                {formatDistanceToNow(new Date(session.createdAt), { addSuffix: true })}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** Who most recently messaged in this session — sessions are shared among admins. */
function LastUserAvatar({ session, isSelected }: { session: AgentSessionListItem; isSelected: boolean }) {
  if (!session.lastUser) {
    return <div className='h-7 w-7 shrink-0' />
  }

  return (
    <Avatar
      className={cn('h-7 w-7 shrink-0 ring-2', isSelected ? 'ring-primary-foreground/30' : 'ring-transparent')}
      title={session.lastUser.name}
    >
      {session.lastUser.avatarUrl && <AvatarImage src={session.lastUser.avatarUrl} alt={session.lastUser.name} />}
      <AvatarFallback className='text-[10px] text-muted-foreground'>
        {getActorInitials(session.lastUser.name)}
      </AvatarFallback>
    </Avatar>
  )
}

/**
 * Deliberately subdued — single-color + opacity tokens, no filled circles —
 * so these read as secondary information behind the title and the active-
 * row indicator, not competing with them. On the selected (bg-primary) row,
 * the semantic colors would lose contrast, so those fall back to the same
 * primary-foreground/20 treatment the sidebar uses for its active badges.
 */
function StatusChip({ session, isSelected }: { session: AgentSessionListItem; isSelected: boolean }) {
  if (session.turnStatus === 'streaming') {
    return (
      <Loader2
        className={cn('h-3.5 w-3.5 shrink-0 animate-spin', isSelected ? 'text-primary-foreground' : 'text-muted-foreground')}
      />
    )
  }

  if (session.turnStatus === 'error') {
    return (
      <span
        className={cn(
          'shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium',
          isSelected ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-destructive/10 text-destructive'
        )}
      >
        Error
      </span>
    )
  }

  if (session.pendingProposalCount > 0) {
    return (
      <span
        className={cn(
          'shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium',
          isSelected
            ? 'bg-primary-foreground/20 text-primary-foreground'
            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
        )}
      >
        {session.pendingProposalCount}
      </span>
    )
  }

  return null
}
