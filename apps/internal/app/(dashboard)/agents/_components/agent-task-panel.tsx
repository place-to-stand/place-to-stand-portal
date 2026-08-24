'use client'

import { useCallback, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Search, X } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { SearchableCombobox } from '@/components/ui/searchable-combobox'
import type { GitHubRepoLinkSummary } from '@/lib/types'

import { acceptProposedTask, rejectProposedTask } from '../actions/proposed-tasks'
import { AgentTaskCard } from './agent-task-card'
import { AgentTaskBrowserDialog } from './agent-task-browser-dialog'
import type { AgentProposedTask, AgentSessionTaskRow, AgentTaskSummary } from '@/lib/agents/types'

type ProjectOption = { id: string; name: string }

type AgentTaskPanelProps = {
  sessionId: string
  proposedTasks: AgentProposedTask[]
  sessionTasks: AgentSessionTaskRow[]
  projectOptions: ProjectOption[]
  repoLinksByProject: Record<string, GitHubRepoLinkSummary[]>
  pickerTasks: AgentTaskSummary[]
}

/**
 * One running list instead of Proposed/Linked/Browse tabs — a proposal and
 * a linked task are both just "tasks relevant to this conversation," one
 * pending a decision and one confirmed, so they read better as sections of
 * the same scroll than as a tab switch. "Browse all tasks" moved out to a
 * command-palette overlay (AgentTaskBrowserDialog) so it stops permanently
 * eating rail width for something used occasionally.
 */
export function AgentTaskPanel({
  sessionId,
  proposedTasks,
  sessionTasks,
  projectOptions,
  repoLinksByProject,
  pickerTasks,
}: AgentTaskPanelProps) {
  const [browserOpen, setBrowserOpen] = useState(false)
  const pending = proposedTasks.filter(p => p.status === 'proposed')
  const isEmpty = pending.length === 0 && sessionTasks.length === 0

  return (
    <div className='flex h-full min-h-0 flex-col border-l bg-background p-3'>
      <div className='mb-2 flex items-center justify-between'>
        <span className='text-xs font-semibold text-muted-foreground uppercase'>Tasks</span>
        <Button
          type='button'
          variant='ghost'
          size='icon'
          className='h-6 w-6 text-muted-foreground'
          onClick={() => setBrowserOpen(true)}
          title='Search and link a task'
        >
          <Search className='h-3.5 w-3.5' />
        </Button>
      </div>

      <div className='min-h-0 flex-1 overflow-y-auto'>
        {isEmpty ? (
          <div className='flex h-full flex-col items-center justify-center gap-2 px-2 text-center'>
            <p className='text-xs text-muted-foreground'>
              No tasks in this session yet. The agent will propose tasks as it works, or you can link one.
            </p>
            <Button type='button' variant='outline' size='sm' className='h-7 text-xs' onClick={() => setBrowserOpen(true)}>
              <Search className='mr-1.5 h-3 w-3' />
              Search tasks
            </Button>
          </div>
        ) : (
          <div className='flex flex-col gap-4'>
            {pending.length > 0 && (
              <div className='flex flex-col gap-2'>
                <p className='text-[11px] font-medium text-muted-foreground uppercase'>Awaiting review</p>
                {pending.map(proposal => (
                  <ProposedTaskCard key={proposal.id} proposal={proposal} projectOptions={projectOptions} />
                ))}
              </div>
            )}
            {sessionTasks.length > 0 && (
              <div className='flex flex-col gap-2'>
                <p className='text-[11px] font-medium text-muted-foreground uppercase'>Linked</p>
                {sessionTasks.map(row => (
                  <AgentTaskCard
                    key={row.id}
                    task={row.task}
                    addedVia={row.addedVia}
                    repoLinks={repoLinksByProject[row.task.projectId] ?? []}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <AgentTaskBrowserDialog
        open={browserOpen}
        onOpenChange={setBrowserOpen}
        sessionId={sessionId}
        tasks={pickerTasks}
        projectOptions={projectOptions}
      />
    </div>
  )
}

function ProposedTaskCard({
  proposal,
  projectOptions,
}: {
  proposal: AgentProposedTask
  projectOptions: ProjectOption[]
}) {
  const { toast } = useToast()
  const router = useRouter()
  const [selectedProjectId, setSelectedProjectId] = useState(proposal.projectId ?? '')
  const [isPending, startTransition] = useTransition()

  const handleAccept = useCallback(() => {
    startTransition(async () => {
      const result = await acceptProposedTask({
        proposalId: proposal.id,
        projectId: selectedProjectId || undefined,
      })
      if ('error' in result) {
        toast({ variant: 'destructive', title: 'Error', description: result.error })
        return
      }
      router.refresh()
    })
  }, [proposal.id, selectedProjectId, toast, router])

  const handleReject = useCallback(() => {
    startTransition(async () => {
      const result = await rejectProposedTask({ proposalId: proposal.id })
      if ('error' in result) {
        toast({ variant: 'destructive', title: 'Error', description: result.error })
        return
      }
      router.refresh()
    })
  }, [proposal.id, toast, router])

  return (
    <div className='flex flex-col gap-2 rounded-md border bg-muted px-3 py-2.5'>
      <p className='text-sm font-medium'>{proposal.title}</p>
      {proposal.description && (
        <p className='text-xs text-muted-foreground line-clamp-3'>{proposal.description}</p>
      )}
      {!proposal.projectId && (
        <SearchableCombobox
          items={projectOptions.map(p => ({ value: p.id, label: p.name }))}
          value={selectedProjectId}
          onChange={setSelectedProjectId}
          placeholder='Select a project...'
          searchPlaceholder='Search projects...'
        />
      )}
      <div className='flex items-center gap-1.5'>
        <Button
          size='sm'
          className='h-7 flex-1 text-xs'
          disabled={isPending || (!proposal.projectId && !selectedProjectId)}
          onClick={handleAccept}
        >
          <Check className='mr-1 h-3 w-3' />
          Accept
        </Button>
        <Button
          size='sm'
          variant='outline'
          className='h-7 flex-1 text-xs'
          disabled={isPending}
          onClick={handleReject}
        >
          <X className='mr-1 h-3 w-3' />
          Reject
        </Button>
      </div>
    </div>
  )
}
