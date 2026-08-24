'use client'

import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { Building2, Clock, GitBranch, Loader2, Plus } from 'lucide-react'

import { Button } from '@pts/ui/button'
import type { AgentSessionDetail, AgentSessionListItem } from '@/lib/data/agent-sessions'
import type { AgentMessageAuthor } from '@/lib/agents/types'
import type { DbUser } from '@/lib/types'

import { useSelectedSession } from '../_hooks/use-selected-session'
import { useAgentSessionDetail } from '../_hooks/use-agent-session-detail'
import { useAgentSessionState } from '../_hooks/use-agent-session-state'
import { AGENT_SESSION_DETAIL_KEY } from '../_hooks/use-agent-session-detail'
import { AgentSessionsList, AGENT_SESSIONS_OVERVIEW_KEY } from './agent-sessions-list'
import { SessionOwnerSelector } from './session-owner-selector'
import { NewSessionComposer } from './new-session-composer'
import { AgentChatPane } from './agent-chat-pane'
import { AgentTaskPanel } from './agent-task-panel'

type AgentsWorkspaceProps = {
  initialSessions: AgentSessionListItem[]
  initialSelectedSessionId: string | null
  initialSessionDetail: AgentSessionDetail | null
  admins: DbUser[]
  selectedOwnerId: string
  currentUser: AgentMessageAuthor
}

/**
 * The whole /agents page: a persistent split, not a slide-out — sessions
 * (with live status) stay visible on the left while the right pane just
 * swaps between "start a session" and whichever session is selected.
 */
export function AgentsWorkspace({
  initialSessions,
  initialSelectedSessionId,
  initialSessionDetail,
  admins,
  selectedOwnerId,
  currentUser,
}: AgentsWorkspaceProps) {
  const queryClient = useQueryClient()
  const { selectedId, select } = useSelectedSession()

  const seedDetail = selectedId === initialSelectedSessionId ? (initialSessionDetail ?? undefined) : undefined
  const { detail, isLoading } = useAgentSessionDetail(selectedId, seedDetail)

  const handleSessionCreated = (sessionId: string) => {
    queryClient.invalidateQueries({ queryKey: [AGENT_SESSIONS_OVERVIEW_KEY] })
    select(sessionId)
  }

  return (
    <div className='grid h-full min-h-0 flex-1 grid-cols-[320px_1fr] overflow-hidden rounded-xl border'>
      <div className='flex h-full min-h-0 flex-col border-r bg-card'>
        <div className='flex flex-col gap-2 border-b px-3 py-2'>
          <div className='flex items-center justify-between'>
            <span className='text-xs font-semibold text-muted-foreground uppercase'>Sessions</span>
            <Button variant='ghost' size='sm' className='h-6 gap-1 px-2 text-xs' onClick={() => select(null)}>
              <Plus className='h-3 w-3' />
              New
            </Button>
          </div>
          <SessionOwnerSelector admins={admins} selectedOwnerId={selectedOwnerId} currentUserId={currentUser.id} />
        </div>
        <div className='min-h-0 flex-1 overflow-y-auto p-1.5'>
          <AgentSessionsList
            initialSessions={initialSessions}
            ownerId={selectedOwnerId}
            selectedId={selectedId}
            onSelect={select}
          />
        </div>
      </div>

      <div className='flex min-h-0 flex-col'>
        {!selectedId ? (
          <NewSessionComposer onSessionCreated={handleSessionCreated} />
        ) : detail ? (
          <SelectedSessionView sessionId={selectedId} detail={detail} currentUser={currentUser} />
        ) : isLoading ? (
          <div className='flex h-full items-center justify-center text-sm text-muted-foreground'>
            <Loader2 className='mr-2 h-4 w-4 animate-spin' />
            Loading session…
          </div>
        ) : null}
      </div>
    </div>
  )
}

function SelectedSessionView({
  sessionId,
  detail,
  currentUser,
}: {
  sessionId: string
  detail: AgentSessionDetail
  currentUser: AgentMessageAuthor
}) {
  const queryClient = useQueryClient()
  const { data } = useAgentSessionState(sessionId)
  const turnStatus = data && !('error' in data) ? data.turnStatus : detail.session.turnStatus

  // The title can change mid-session (see deriveSessionTitle in the chat
  // route, set on the first message) — refetch the cached detail once a
  // turn lands so the header doesn't keep showing "Untitled session".
  const previousTurnStatusRef = useRef(turnStatus)
  useEffect(() => {
    if (previousTurnStatusRef.current === 'streaming' && turnStatus !== 'streaming') {
      queryClient.invalidateQueries({ queryKey: [AGENT_SESSION_DETAIL_KEY, sessionId] })
    }
    previousTurnStatusRef.current = turnStatus
  }, [turnStatus, sessionId, queryClient])

  const proposedCount = detail.proposedTasks.filter(task => task.status === 'proposed').length
  const linkedCount = detail.sessionTasks.length
  const repoLinks = detail.session.projectId ? (detail.repoLinksByProject[detail.session.projectId] ?? []) : []

  return (
    <>
      <div className='flex items-start justify-between gap-4 border-b px-5 py-4'>
        <div className='flex min-w-0 flex-col gap-2'>
          <span className='truncate text-xl font-semibold'>{detail.session.title ?? 'Untitled session'}</span>
          <div className='flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground'>
            <span className='inline-flex items-center gap-1'>
              <Building2 className='h-3.5 w-3.5' />
              {detail.session.scopeLabel ?? 'Unscoped — whole business'}
            </span>
            {repoLinks.map(repo => (
              <span key={repo.id} className='inline-flex items-center gap-1 rounded-full border px-2 py-0.5'>
                <GitBranch className='h-3 w-3' />
                {repo.repoFullName}
              </span>
            ))}
            {proposedCount > 0 && (
              <span className='inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 font-medium text-amber-600 dark:text-amber-400'>
                {proposedCount} proposed
              </span>
            )}
            {linkedCount > 0 && (
              <span className='inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 font-medium'>
                {linkedCount} linked task{linkedCount === 1 ? '' : 's'}
              </span>
            )}
            <span className='inline-flex items-center gap-1'>
              <Clock className='h-3 w-3' />
              Started {formatDistanceToNow(new Date(detail.session.createdAt), { addSuffix: true })}
            </span>
          </div>
        </div>
        <div className='flex shrink-0 items-center gap-2 pt-1'>
          {turnStatus === 'streaming' && (
            <span className='flex items-center gap-1.5 text-xs text-muted-foreground'>
              <Loader2 className='h-3.5 w-3.5 animate-spin' />
              Generating
            </span>
          )}
          {turnStatus === 'error' && (
            <span className='rounded-md bg-destructive/10 px-1.5 py-0.5 text-xs font-medium text-destructive'>
              Error
            </span>
          )}
        </div>
      </div>
      <div className='flex min-h-0 flex-1'>
        <div className='min-h-0 flex-1'>
          <AgentChatPane sessionId={sessionId} messages={detail.messages} currentUser={currentUser} />
        </div>
        <div className='min-h-0 w-[380px] shrink-0'>
          <AgentTaskPanel
            sessionId={sessionId}
            proposedTasks={detail.proposedTasks}
            sessionTasks={detail.sessionTasks}
            projectOptions={detail.projectOptions}
            repoLinksByProject={detail.repoLinksByProject}
            pickerTasks={detail.pickerTasks}
          />
        </div>
      </div>
    </>
  )
}
