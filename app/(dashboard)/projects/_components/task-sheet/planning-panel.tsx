'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Check, ChevronDown, ExternalLink, Loader2, MessageCircleQuestion, Play, Send } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'

import type { GitHubRepoLinkSummary, TaskWithRelations } from '@/lib/types'
import { usePlanningSession } from './use-planning-session'
import { usePlanStream, detectContentType } from './use-plan-stream'
import { usePlanRevisions } from './use-plan-revisions'
import { PlanRevisionNav, type VersionMeta, type VersionDeployStatus } from './plan-revision-nav'
import { PlanDocumentViewer } from './plan-document-viewer'
import { PlanDeploymentStatus } from './plan-deployments-section'
import { useTaskDeployments, TASK_DEPLOYMENTS_KEY } from './use-task-deployments'
import { deployPlan } from '../../actions/trigger-worker'
import type { WorkerStatusResult } from '../../actions/fetch-worker-status'
import { WORKER_STATUS_KEY } from './use-worker-status'
import { GitHubIcon } from './github-icon'

const MODEL_OPTIONS = [
  { model: 'claude-sonnet-4.6', label: 'Sonnet 4.6' },
  { model: 'claude-opus-4.6', label: 'Opus 4.6' },
  { model: 'claude-haiku-4.5', label: 'Haiku 4.5' },
] as const

type PlanningPanelProps = {
  task: TaskWithRelations
  githubRepos: GitHubRepoLinkSummary[]
}

export function PlanningPanel({ task, githubRepos }: PlanningPanelProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [selectedRepoId, setSelectedRepoId] = useState(githubRepos[0]?.id ?? '')
  const [feedbackInput, setFeedbackInput] = useState('')
  const [isDispatchPending, startDispatchTransition] = useTransition()
  const [generatingVersion, setGeneratingVersion] = useState<number | null>(null)
  const [selectedModel, setSelectedModel] = useState<string | null>(null)

  // Session management
  const {
    sessionId,
    threads,
    activeThread,
    activeThreadId,
    createDefaultThread,
    isLoading: isSessionLoading,
  } = usePlanningSession(task.id, selectedRepoId)

  // Effective model: user selection overrides thread default
  const activeModel = selectedModel ?? activeThread?.model ?? 'claude-sonnet-4.6'
  const activeModelLabel = MODEL_OPTIONS.find(m => m.model === activeModel)?.label ?? 'Sonnet 4.6'

  // Streaming plan generation
  const {
    content: streamContent,
    contentType: streamContentType,
    isGenerating,
    toolCalls,
    error: streamError,
    generate,
    cancel: cancelStream,
  } = usePlanStream()

  // Revision history for active thread
  const {
    revisions,
    currentVersion,
    latestVersion,
    currentRevision,
    invalidate: invalidateRevisions,
    navigateTo,
  } = usePlanRevisions(activeThreadId, Boolean(activeThreadId))

  // Determine displayed content: streaming > revision
  const displayContent = isGenerating ? streamContent : (currentRevision?.content ?? '')

  // Effective versions: show the in-progress version immediately during generation
  const effectiveLatest = generatingVersion ?? latestVersion
  const effectiveCurrent = generatingVersion ?? currentVersion
  const isViewingOldVersion = !isGenerating && currentVersion < latestVersion && latestVersion > 0

  // Detect if current content is clarifying questions vs a plan
  const displayContentType = isGenerating
    ? streamContentType
    : detectContentType(displayContent)
  const isQuestionsResponse = displayContentType === 'questions'

  // Deployments for this task — used for version nav coloring + accept button state
  const { deployments: allDeployments } = useTaskDeployments(task.id, true)

  // Compute deploy status for a given version
  const getDeployStatusForVersion = useCallback(
    (version: number): VersionDeployStatus => {
      const matching = allDeployments.filter(
        d => d.plan_thread_id === activeThreadId && d.plan_version === version
      )
      if (matching.length === 0) return 'none'
      if (matching.some(d => d.worker_status === 'pr_created' || d.pr_url)) return 'pr_created'
      return 'dispatched'
    },
    [allDeployments, activeThreadId]
  )

  // Build version metadata: label each revision as "Q" or "v{n}" with plan-only numbering
  const versionMeta: VersionMeta[] = useMemo(() => {
    const meta: VersionMeta[] = []
    let planCount = 0
    let qCount = 0

    for (const rev of revisions) {
      const isQ = detectContentType(rev.content) === 'questions'
      if (isQ) {
        qCount++
      } else {
        planCount++
      }
      meta.push({
        version: rev.version,
        label: isQ ? (qCount > 1 ? `Q${qCount}` : 'Q') : `v${planCount}`,
        isQuestions: isQ,
        deployStatus: getDeployStatusForVersion(rev.version),
      })
    }

    // If currently generating a new version beyond what's in revisions, add it
    if (generatingVersion && !meta.some(m => m.version === generatingVersion)) {
      const isQ = streamContentType === 'questions'
      if (isQ) {
        qCount++
        meta.push({ version: generatingVersion, label: qCount > 1 ? `Q${qCount}` : 'Q', isQuestions: true, deployStatus: 'none' })
      } else {
        planCount++
        meta.push({ version: generatingVersion, label: `v${planCount}`, isQuestions: false, deployStatus: 'none' })
      }
    }

    // Retroactively fix Q labels if there's only one Q total
    if (qCount === 1) {
      const qItem = meta.find(m => m.isQuestions)
      if (qItem) qItem.label = 'Q'
    }

    return meta
  }, [revisions, generatingVersion, streamContentType, getDeployStatusForVersion])

  // Get the plan-specific label for the current version (e.g. "v1" instead of raw version number)
  const displayedVersion = currentVersion || latestVersion
  const currentVersionMeta = useMemo(
    () => versionMeta.find(m => m.version === displayedVersion),
    [versionMeta, displayedVersion]
  )
  const currentVersionLabel = currentVersionMeta?.label ?? `v${displayedVersion}`

  // Check if current version already has a deployment (disables accept button)
  const versionAlreadyDispatched = (currentVersionMeta?.deployStatus ?? 'none') !== 'none'

  // The selected repo object (for display)
  const selectedRepo = useMemo(
    () => githubRepos.find(r => r.id === selectedRepoId) ?? githubRepos[0],
    [githubRepos, selectedRepoId]
  )

  // Whether we're in the empty state (no revisions generated yet)
  const hasStartedPlanning = latestVersion > 0 || isGenerating

  // Auto-create default thread when session loads with no threads
  useEffect(() => {
    if (!isSessionLoading && sessionId && threads.length === 0) {
      createDefaultThread()
    }
  }, [isSessionLoading, sessionId, threads.length, createDefaultThread])

  // Start planning — manual trigger for v1
  const handleStartPlanning = useCallback(() => {
    if (!activeThreadId || isGenerating) return

    setGeneratingVersion(1)
    generate({
      threadId: activeThreadId,
      repoLinkId: selectedRepoId,
      taskTitle: task.title,
      taskDescription: task.description ?? null,
      model: activeModel,
      currentVersion: 0,
    }).then(() => {
      setGeneratingVersion(null)
      invalidateRevisions()
    })
  }, [activeThreadId, isGenerating, selectedRepoId, task, activeModel, generate, invalidateRevisions])

  // Handle feedback submission
  const handleFeedbackSubmit = useCallback(() => {
    if (!feedbackInput.trim() || !activeThreadId || !activeThread || isGenerating) return

    const feedback = feedbackInput.trim()
    setFeedbackInput('')

    const nextVersion = latestVersion + 1
    setGeneratingVersion(nextVersion)
    generate({
      threadId: activeThreadId,
      repoLinkId: selectedRepoId,
      taskTitle: task.title,
      taskDescription: task.description ?? null,
      model: activeModel,
      currentVersion: latestVersion,
      feedback,
    }).then(() => {
      setGeneratingVersion(null)
      invalidateRevisions()
    })
  }, [
    feedbackInput,
    activeThreadId,
    activeThread,
    isGenerating,
    selectedRepoId,
    task,
    activeModel,
    latestVersion,
    generate,
    invalidateRevisions,
  ])

  // Dispatch the current plan
  const handleDispatch = useCallback(() => {
    if (!displayContent || !activeThread || !activeThreadId) return

    startDispatchTransition(async () => {
      const result = await deployPlan({
        threadId: activeThreadId,
        version: currentVersion || latestVersion,
        taskId: task.id,
        repoLinkId: selectedRepoId,
        model: mapModelToWorker(activeModelLabel),
      })

      if ('error' in result) {
        toast({ variant: 'destructive', title: 'Error', description: result.error })
        return
      }

      // Seed optimistic status
      queryClient.setQueryData<WorkerStatusResult>(
        [WORKER_STATUS_KEY, result.deploymentId],
        { comments: [], prUrl: null, latestStatus: 'working' }
      )

      toast({ title: 'Plan dispatched', description: 'GitHub issue created with PRD instructions.' })
      queryClient.invalidateQueries({ queryKey: [TASK_DEPLOYMENTS_KEY, task.id] })
    })
  }, [
    displayContent,
    activeThread,
    activeThreadId,
    currentVersion,
    latestVersion,
    task.id,
    selectedRepoId,
    activeModelLabel,
    toast,
    queryClient,
  ])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleFeedbackSubmit()
      }
    },
    [handleFeedbackSubmit]
  )

  if (isSessionLoading) {
    return (
      <div className='flex h-full w-[560px] shrink-0 flex-col items-center justify-center border-l bg-muted/50'>
        <Loader2 className='h-5 w-5 animate-spin text-muted-foreground' />
        <p className='mt-2 text-xs text-muted-foreground'>Loading planning session...</p>
      </div>
    )
  }

  return (
    <div className='flex h-full w-[560px] shrink-0 flex-col border-l bg-muted/50'>
      {/* Repo link + Version nav */}
      <div className='flex items-center justify-between border-b px-4 py-2'>
        <a
          href={`https://github.com/${selectedRepo?.repoFullName}`}
          target='_blank'
          rel='noopener noreferrer'
          className='inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground'
        >
          <GitHubIcon className='h-3.5 w-3.5' />
          {selectedRepo?.repoFullName}
          <ExternalLink className='h-2.5 w-2.5' />
        </a>
        {githubRepos.length > 1 && (
          <Select value={selectedRepoId} onValueChange={setSelectedRepoId}>
            <SelectTrigger className='h-6 w-auto gap-1 border-none bg-transparent px-1 text-[10px] text-muted-foreground shadow-none hover:text-foreground'>
              <SelectValue placeholder='Switch' />
            </SelectTrigger>
            <SelectContent>
              {githubRepos.map(repo => (
                <SelectItem key={repo.id} value={repo.id}>
                  {repo.repoFullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {effectiveLatest > 0 && (
          <PlanRevisionNav
            currentVersion={effectiveCurrent}
            latestVersion={effectiveLatest}
            versionMeta={versionMeta}
            onNavigate={navigateTo}
            disabled={isGenerating}
          />
        )}
      </div>

      {/* Questions banner */}
      {isQuestionsResponse && !isGenerating && (
        <div className='flex items-center gap-2 border-b bg-amber-500/10 px-4 py-2 text-xs text-amber-700 dark:text-amber-400'>
          <MessageCircleQuestion className='h-3.5 w-3.5 shrink-0' />
          <span>Claude has questions before generating the plan. Answer below to continue.</span>
        </div>
      )}

      {/* Scrollable body */}
      <div className='flex-1 overflow-y-auto px-4 py-3'>
        {!hasStartedPlanning ? (
          /* Empty state — before planning starts */
          <div className='flex h-full flex-col items-center justify-center gap-3'>
            <p className='text-sm text-muted-foreground'>
              Generate an implementation plan for this task.
            </p>
            {/* Model selector for initial generation */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant='outline'
                  size='sm'
                  className='gap-1 text-xs'
                >
                  {activeModelLabel}
                  <ChevronDown className='h-3 w-3 opacity-50' />
                </Button>
              </PopoverTrigger>
              <PopoverContent className='w-36 p-1' align='center'>
                {MODEL_OPTIONS.map(opt => (
                  <button
                    key={opt.model}
                    className='flex w-full items-center rounded-sm px-2 py-1.5 text-left text-xs hover:bg-muted'
                    onClick={() => setSelectedModel(opt.model)}
                  >
                    {opt.label}
                    {activeModel === opt.model && (
                      <Check className='ml-auto h-3 w-3' />
                    )}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
            <Button
              onClick={handleStartPlanning}
              disabled={!activeThreadId}
            >
              <Play className='mr-1.5 h-4 w-4' />
              Start Planning
            </Button>
          </div>
        ) : (
          <>
            <PlanDocumentViewer
              content={displayContent}
              isStreaming={isGenerating}
              toolCalls={toolCalls}
              error={streamError}
            />

            {/* Compact dispatch status rows — filtered to current thread+version */}
            <PlanDeploymentStatus
              taskId={task.id}
              activeThreadId={activeThreadId}
              currentVersion={displayedVersion}
            />
          </>
        )}
      </div>

      {/* Footer: feedback input + dispatch plan (only after planning started) */}
      {hasStartedPlanning && (
        <div className='border-t bg-background/60 px-4 py-3'>
          {/* Feedback / answer input */}
          <div className='flex items-end gap-2'>
            <Textarea
              value={feedbackInput}
              onChange={e => setFeedbackInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isQuestionsResponse ? 'Answer the questions above...' : 'Refine this plan...'}
              className='min-h-[36px] max-h-[100px] resize-none text-xs'
              rows={1}
              disabled={isGenerating || isViewingOldVersion}
            />
            {/* Model selector */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant='outline'
                  size='sm'
                  className='shrink-0 gap-1 text-xs'
                  disabled={isGenerating}
                >
                  {activeModelLabel.split(' ')[0]}
                  <ChevronDown className='h-3 w-3 opacity-50' />
                </Button>
              </PopoverTrigger>
              <PopoverContent className='w-36 p-1' align='end'>
                {MODEL_OPTIONS.map(opt => (
                  <button
                    key={opt.model}
                    className='flex w-full items-center rounded-sm px-2 py-1.5 text-left text-xs hover:bg-muted'
                    onClick={() => setSelectedModel(opt.model)}
                  >
                    {opt.label}
                    {activeModel === opt.model && (
                      <Check className='ml-auto h-3 w-3' />
                    )}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
            {isGenerating ? (
              <Button
                size='sm'
                variant='secondary'
                onClick={cancelStream}
                className='shrink-0'
              >
                Stop
              </Button>
            ) : (
              <Button
                size='sm'
                onClick={handleFeedbackSubmit}
                disabled={!feedbackInput.trim()}
                className='shrink-0'
              >
                <Send className='mr-1.5 h-3.5 w-3.5' />
                Send
              </Button>
            )}
          </div>

          {/* Dispatch plan button — only when viewing a plan (not questions, not generating) */}
          {!isGenerating && !isQuestionsResponse && displayContent && (
            <Button
              size='sm'
              onClick={handleDispatch}
              disabled={isDispatchPending || versionAlreadyDispatched}
              className='mt-4 w-full'
            >
              {isDispatchPending ? (
                <Loader2 className='mr-1.5 h-3.5 w-3.5 animate-spin' />
              ) : (
                <Check className='mr-1.5 h-3.5 w-3.5' />
              )}
              {versionAlreadyDispatched
                ? `Plan ${currentVersionLabel} Dispatched`
                : `Dispatch Plan ${currentVersionLabel}`}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

// Map model label to worker model format
function mapModelToWorker(label: string): 'opus' | 'sonnet' | 'haiku' {
  const lower = label.toLowerCase()
  if (lower.includes('opus')) return 'opus'
  if (lower.includes('haiku')) return 'haiku'
  return 'sonnet'
}
