'use client'

import { useState } from 'react'
import {
  Bug,
  Play,
  Pause,
  Square,
  RefreshCw,
  Terminal,
  GitBranch,
  GitPullRequest,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  MoreHorizontal,
  ExternalLink,
  DollarSign,
  Activity,
  Settings,
  Eye,
  Bot,
  ChevronRight,
  Cpu,
  FileCode,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
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
      { name: 'Clone repository', status: 'complete', duration: '12s' },
      { name: 'Analyze codebase', status: 'complete', duration: '45s' },
      { name: 'Identify bug location', status: 'complete', duration: '1m 23s' },
      { name: 'Generate fix', status: 'running', duration: '2m 15s' },
      { name: 'Run tests', status: 'pending', duration: null },
      { name: 'Create PR', status: 'pending', duration: null },
    ],
    files: ['lib/auth/session.ts', 'lib/auth/permissions.ts'],
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
    files: ['lib/queries/projects.ts'],
  },
  {
    id: '3',
    title: 'Fix mobile responsive layout on dashboard',
    repo: 'marketing-site',
    status: 'failed',
    progress: 40,
    startedAt: '2 hours ago',
    cost: 4.21,
    error: 'Could not identify root cause - multiple layout issues found',
    steps: [],
    files: [],
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
    files: [],
  },
]

const mockStats = {
  active: 1,
  queued: 1,
  successRate: 78,
  totalCost: 301.74,
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'running':
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
    case 'complete':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />
    case 'failed':
      return <XCircle className="h-4 w-4 text-red-500" />
    case 'queued':
      return <Clock className="h-4 w-4 text-amber-500" />
    default:
      return null
  }
}

export default function BugBotSplitPage() {
  const [selectedJob, setSelectedJob] = useState<typeof mockJobs[0] | null>(mockJobs[0])
  const [botEnabled, setBotEnabled] = useState(true)

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Left - Job List */}
      <div className="w-80 border-r flex flex-col bg-muted/20">
        <div className="p-3 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-violet-500" />
            <span className="font-semibold">Bug Bot</span>
          </div>
          <div className="flex items-center gap-1">
            <Switch checked={botEnabled} onCheckedChange={setBotEnabled} />
            <Badge variant={botEnabled ? 'default' : 'secondary'} className="text-xs">
              {botEnabled ? 'ON' : 'OFF'}
            </Badge>
          </div>
        </div>

        <div className="p-3 border-b">
          <div className="flex items-center gap-2 text-xs">
            <div className="flex items-center gap-1 px-2 py-1 rounded bg-blue-100 dark:bg-blue-900/30">
              <Activity className="h-3 w-3 text-blue-600" />
              <span className="text-blue-700 dark:text-blue-300">{mockStats.active}</span>
            </div>
            <div className="flex items-center gap-1 px-2 py-1 rounded bg-amber-100 dark:bg-amber-900/30">
              <Clock className="h-3 w-3 text-amber-600" />
              <span className="text-amber-700 dark:text-amber-300">{mockStats.queued}</span>
            </div>
            <div className="flex items-center gap-1 px-2 py-1 rounded bg-green-100 dark:bg-green-900/30">
              <span className="text-green-700 dark:text-green-300">{mockStats.successRate}%</span>
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {mockJobs.map(job => (
              <button
                key={job.id}
                className={cn(
                  'w-full p-3 rounded-lg text-left transition-colors',
                  selectedJob?.id === job.id
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted'
                )}
                onClick={() => setSelectedJob(job)}
              >
                <div className="flex items-center gap-2 mb-1">
                  <StatusIcon status={job.status} />
                  <Badge variant={selectedJob?.id === job.id ? 'secondary' : 'outline'} className="text-xs">
                    {job.repo}
                  </Badge>
                </div>
                <p className="text-sm font-medium line-clamp-2">{job.title}</p>
                <div className="flex items-center justify-between mt-2 text-xs opacity-70">
                  <span>{job.status === 'queued' ? `Queued ${job.queuedAt}` : `${job.startedAt}`}</span>
                  <span>${job.cost.toFixed(2)}</span>
                </div>
                {job.status === 'running' && (
                  <Progress value={job.progress} className="h-1 mt-2" />
                )}
              </button>
            ))}
          </div>
        </ScrollArea>

        <div className="p-3 border-t">
          <Button className="w-full" size="sm">
            <Bug className="h-4 w-4 mr-2" />
            Submit New Bug
          </Button>
        </div>
      </div>

      {/* Right - Job Detail */}
      <div className="flex-1 flex flex-col">
        {selectedJob ? (
          <>
            <div className="p-4 border-b flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <StatusIcon status={selectedJob.status} />
                  <Badge variant="outline">{selectedJob.repo}</Badge>
                  {selectedJob.status === 'running' && (
                    <Badge className="bg-blue-500">{selectedJob.progress}%</Badge>
                  )}
                </div>
                <h2 className="font-semibold">{selectedJob.title}</h2>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm">
                  <Terminal className="h-4 w-4 mr-1" />
                  Logs
                </Button>
                {selectedJob.status === 'running' && (
                  <Button variant="destructive" size="sm">
                    <Square className="h-4 w-4 mr-1" />
                    Stop
                  </Button>
                )}
                {selectedJob.status === 'failed' && (
                  <Button size="sm">
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Retry
                  </Button>
                )}
                {selectedJob.prUrl && (
                  <Button size="sm" asChild>
                    <a href={selectedJob.prUrl}>
                      <GitPullRequest className="h-4 w-4 mr-1" />
                      View PR
                    </a>
                  </Button>
                )}
              </div>
            </div>

            <ScrollArea className="flex-1 p-4">
              {selectedJob.status === 'running' && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Progress</span>
                    <span className="text-sm">{selectedJob.progress}%</span>
                  </div>
                  <Progress value={selectedJob.progress} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-1">
                    Est. completion: {selectedJob.estimatedCompletion}
                  </p>
                </div>
              )}

              {selectedJob.error && (
                <div className="mb-6 p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900">
                  <p className="text-sm text-red-600 dark:text-red-400">{selectedJob.error}</p>
                </div>
              )}

              {selectedJob.steps.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium mb-3">Execution Steps</h3>
                  <div className="space-y-2">
                    {selectedJob.steps.map((step, i) => (
                      <div key={i} className="flex items-center gap-3 p-2 rounded bg-muted/50">
                        {step.status === 'complete' ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : step.status === 'running' ? (
                          <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
                        ) : (
                          <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />
                        )}
                        <span className={cn(
                          'flex-1 text-sm',
                          step.status === 'pending' && 'text-muted-foreground'
                        )}>{step.name}</span>
                        {step.duration && (
                          <span className="text-xs text-muted-foreground">{step.duration}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedJob.files.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium mb-3">Files Modified</h3>
                  <div className="space-y-1">
                    {selectedJob.files.map((file, i) => (
                      <div key={i} className="flex items-center gap-2 p-2 rounded bg-muted/50 text-sm">
                        <FileCode className="h-4 w-4 text-muted-foreground" />
                        <span className="font-mono text-xs">{file}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-sm font-medium mb-3">Cost Breakdown</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Claude API</span>
                    <span>${(selectedJob.cost * 0.85).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Compute</span>
                    <span>${(selectedJob.cost * 0.15).toFixed(2)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-medium">
                    <span>Total</span>
                    <span>${selectedJob.cost.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Bot className="h-12 w-12 mx-auto mb-2 opacity-30" />
              <p>Select a job to view details</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
