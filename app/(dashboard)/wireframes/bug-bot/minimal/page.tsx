'use client'

import { useState } from 'react'
import {
  Bug,
  Square,
  RefreshCw,
  Terminal,
  GitBranch,
  GitPullRequest,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  DollarSign,
  Activity,
  Settings,
  Bot,
  ArrowLeft,
  ChevronRight,
  Plus,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

const mockJobs = [
  {
    id: '1',
    title: 'Fix TypeScript compilation error in auth module',
    repo: 'place-to-stand-portal',
    status: 'running',
    progress: 65,
    startedAt: '5 min ago',
    estimatedCompletion: '3 min',
    cost: 2.47,
    steps: [
      { name: 'Clone repository', status: 'complete' },
      { name: 'Analyze codebase', status: 'complete' },
      { name: 'Identify bug', status: 'complete' },
      { name: 'Generate fix', status: 'running' },
      { name: 'Run tests', status: 'pending' },
      { name: 'Create PR', status: 'pending' },
    ],
  },
  {
    id: '2',
    title: 'Resolve N+1 query in projects list',
    repo: 'place-to-stand-portal',
    status: 'complete',
    progress: 100,
    startedAt: '1 hour ago',
    cost: 8.92,
    prUrl: '#',
    steps: [],
  },
  {
    id: '3',
    title: 'Fix mobile responsive layout',
    repo: 'marketing-site',
    status: 'failed',
    progress: 40,
    startedAt: '2 hours ago',
    cost: 4.21,
    error: 'Could not identify root cause',
    steps: [],
  },
  {
    id: '4',
    title: 'Update deprecated API endpoint',
    repo: 'place-to-stand-portal',
    status: 'queued',
    progress: 0,
    queuedAt: '10 min ago',
    cost: 0,
    steps: [],
  },
]

const mockStats = {
  active: 1,
  queued: 1,
  successRate: 78,
  totalCost: 301.74,
}

function StatusIcon({ status, size = 'md' }: { status: string; size?: 'sm' | 'md' }) {
  const sizeClass = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'
  switch (status) {
    case 'running':
      return <Loader2 className={cn(sizeClass, 'animate-spin text-blue-500')} />
    case 'complete':
      return <CheckCircle2 className={cn(sizeClass, 'text-green-500')} />
    case 'failed':
      return <XCircle className={cn(sizeClass, 'text-red-500')} />
    case 'queued':
      return <Clock className={cn(sizeClass, 'text-amber-500')} />
    default:
      return null
  }
}

export default function BugBotMinimalPage() {
  const [view, setView] = useState<'list' | 'detail'>('list')
  const [selectedJob, setSelectedJob] = useState<typeof mockJobs[0] | null>(null)
  const [botEnabled, setBotEnabled] = useState(true)

  const selectJob = (job: typeof mockJobs[0]) => {
    setSelectedJob(job)
    setView('detail')
  }

  if (view === 'detail' && selectedJob) {
    return (
      <div className="h-[calc(100vh-4rem)] bg-muted/30">
        <div className="max-w-lg mx-auto h-full flex flex-col bg-white dark:bg-neutral-900">
          {/* Header */}
          <div className="p-4 flex items-center gap-3 border-b">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={() => { setView('list'); setSelectedJob(null) }}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <p className="font-semibold">Job Details</p>
              <p className="text-xs text-muted-foreground">{selectedJob.repo}</p>
            </div>
            <StatusIcon status={selectedJob.status} />
          </div>

          <ScrollArea className="flex-1">
            <div className="p-4 space-y-6">
              {/* Title */}
              <div>
                <h2 className="text-lg font-semibold mb-2">{selectedJob.title}</h2>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    <GitBranch className="h-3 w-3 mr-1" />
                    {selectedJob.repo}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {selectedJob.status === 'queued' ? `Queued ${selectedJob.queuedAt}` : selectedJob.startedAt}
                  </span>
                </div>
              </div>

              {/* Progress */}
              {selectedJob.status === 'running' && (
                <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">Progress</span>
                    <span className="text-xl font-bold text-blue-600">{selectedJob.progress}%</span>
                  </div>
                  <Progress value={selectedJob.progress} className="h-2" />
                  <p className="text-sm text-muted-foreground mt-2">
                    Est. {selectedJob.estimatedCompletion} remaining
                  </p>
                </div>
              )}

              {/* Error */}
              {selectedJob.error && (
                <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/30">
                  <p className="font-medium text-red-700 dark:text-red-300 mb-1">Failed</p>
                  <p className="text-sm text-red-600 dark:text-red-400">{selectedJob.error}</p>
                </div>
              )}

              {/* Steps */}
              {selectedJob.steps.length > 0 && (
                <div>
                  <h3 className="font-medium mb-3">Steps</h3>
                  <div className="space-y-2">
                    {selectedJob.steps.map((step, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                        {step.status === 'complete' ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : step.status === 'running' ? (
                          <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                        ) : (
                          <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />
                        )}
                        <span className={cn(
                          'text-sm',
                          step.status === 'pending' && 'text-muted-foreground'
                        )}>{step.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Cost */}
              <div className="p-4 rounded-2xl bg-muted/50">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Cost</span>
                  <span className="text-xl font-bold">${selectedJob.cost.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </ScrollArea>

          {/* Actions */}
          <div className="p-4 border-t space-y-2">
            {selectedJob.prUrl && (
              <Button className="w-full rounded-xl" asChild>
                <a href={selectedJob.prUrl}>
                  <GitPullRequest className="h-4 w-4 mr-2" />
                  View Pull Request
                </a>
              </Button>
            )}
            {selectedJob.status === 'running' && (
              <Button variant="destructive" className="w-full rounded-xl">
                <Square className="h-4 w-4 mr-2" />
                Stop Job
              </Button>
            )}
            {selectedJob.status === 'failed' && (
              <Button className="w-full rounded-xl">
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            )}
            <Button variant="outline" className="w-full rounded-xl">
              <Terminal className="h-4 w-4 mr-2" />
              View Logs
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-4rem)] bg-muted/30">
      <div className="max-w-lg mx-auto h-full flex flex-col bg-white dark:bg-neutral-900">
        {/* Header */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600">
                <Bot className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="font-bold">Bug Bot</h1>
                <p className="text-xs text-muted-foreground">Autonomous fixing</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={botEnabled} onCheckedChange={setBotEnabled} />
              <Badge variant={botEnabled ? 'default' : 'secondary'}>
                {botEnabled ? 'ON' : 'OFF'}
              </Badge>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="px-4 py-3 border-b">
          <div className="grid grid-cols-4 gap-2">
            <div className="text-center p-2 rounded-xl bg-blue-50 dark:bg-blue-950/30">
              <Activity className="h-4 w-4 text-blue-500 mx-auto mb-1" />
              <p className="text-lg font-bold text-blue-700 dark:text-blue-300">{mockStats.active}</p>
              <p className="text-[10px] text-muted-foreground">Active</p>
            </div>
            <div className="text-center p-2 rounded-xl bg-amber-50 dark:bg-amber-950/30">
              <Clock className="h-4 w-4 text-amber-500 mx-auto mb-1" />
              <p className="text-lg font-bold text-amber-700 dark:text-amber-300">{mockStats.queued}</p>
              <p className="text-[10px] text-muted-foreground">Queued</p>
            </div>
            <div className="text-center p-2 rounded-xl bg-green-50 dark:bg-green-950/30">
              <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto mb-1" />
              <p className="text-lg font-bold text-green-700 dark:text-green-300">{mockStats.successRate}%</p>
              <p className="text-[10px] text-muted-foreground">Success</p>
            </div>
            <div className="text-center p-2 rounded-xl bg-muted/50">
              <DollarSign className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
              <p className="text-lg font-bold">${mockStats.totalCost}</p>
              <p className="text-[10px] text-muted-foreground">Total</p>
            </div>
          </div>
        </div>

        {/* Jobs List */}
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-3">
            <h2 className="font-semibold text-sm text-muted-foreground">Jobs</h2>
            {mockJobs.map(job => (
              <button
                key={job.id}
                className="w-full p-4 rounded-2xl bg-muted/50 text-left hover:bg-muted transition-colors"
                onClick={() => selectJob(job)}
              >
                <div className="flex items-start gap-3">
                  <StatusIcon status={job.status} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm line-clamp-2">{job.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">{job.repo}</span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground">${job.cost.toFixed(2)}</span>
                    </div>
                    {job.status === 'running' && (
                      <Progress value={job.progress} className="h-1 mt-2" />
                    )}
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="p-4 border-t">
          <Button className="w-full rounded-xl">
            <Plus className="h-4 w-4 mr-2" />
            Submit New Bug
          </Button>
        </div>
      </div>
    </div>
  )
}
