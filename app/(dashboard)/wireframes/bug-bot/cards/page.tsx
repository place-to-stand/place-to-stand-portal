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
  TrendingUp,
  AlertCircle,
  Zap,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
  },
  {
    id: '2',
    title: 'Resolve N+1 query in projects list',
    repo: 'place-to-stand-portal',
    status: 'complete',
    progress: 100,
    startedAt: '1 hour ago',
    cost: 8.92,
    prUrl: 'https://github.com/org/repo/pull/123',
  },
  {
    id: '3',
    title: 'Fix mobile responsive layout on dashboard',
    repo: 'marketing-site',
    status: 'failed',
    progress: 40,
    startedAt: '2 hours ago',
    cost: 4.21,
    error: 'Could not identify root cause',
  },
  {
    id: '4',
    title: 'Update deprecated API endpoint',
    repo: 'place-to-stand-portal',
    status: 'queued',
    progress: 0,
    queuedAt: '10 min ago',
    cost: 0,
  },
]

const mockStats = {
  totalJobs: 47,
  successRate: 78,
  avgCost: 6.42,
  totalCost: 301.74,
  avgTime: '12 min',
  activeJobs: 1,
  queuedJobs: 1,
}

const recentActivity = [
  { id: '1', action: 'PR merged', job: 'Fix auth module', time: '30 min ago' },
  { id: '2', action: 'Job started', job: 'Update API endpoint', time: '45 min ago' },
  { id: '3', action: 'Bug indexed', job: 'New bug in marketing-site', time: '1 hour ago' },
]

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

export default function BugBotCardsPage() {
  const [botEnabled, setBotEnabled] = useState(true)

  const runningJobs = mockJobs.filter(j => j.status === 'running')
  const queuedJobs = mockJobs.filter(j => j.status === 'queued')
  const recentJobs = mockJobs.filter(j => j.status === 'complete' || j.status === 'failed')

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600">
            <Bot className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Bug Bot</h1>
            <p className="text-muted-foreground">Autonomous bug fixing agent</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
            <Label className="text-sm">Agent</Label>
            <Switch checked={botEnabled} onCheckedChange={setBotEnabled} />
            <Badge variant={botEnabled ? 'default' : 'secondary'}>
              {botEnabled ? 'Active' : 'Paused'}
            </Badge>
          </div>
          <Button variant="outline">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
          <Button>
            <Bug className="h-4 w-4 mr-2" />
            Submit Bug
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/30 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 dark:text-blue-400">Active Jobs</p>
                <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">{mockStats.activeJobs}</p>
              </div>
              <Activity className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/30 dark:to-amber-900/30 border-amber-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-amber-600 dark:text-amber-400">Queued</p>
                <p className="text-3xl font-bold text-amber-700 dark:text-amber-300">{mockStats.queuedJobs}</p>
              </div>
              <Clock className="h-8 w-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/30 dark:to-green-900/30 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 dark:text-green-400">Success Rate</p>
                <p className="text-3xl font-bold text-green-700 dark:text-green-300">{mockStats.successRate}%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/30 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600 dark:text-purple-400">Total Cost</p>
                <p className="text-3xl font-bold text-purple-700 dark:text-purple-300">${mockStats.totalCost}</p>
              </div>
              <DollarSign className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Active Jobs */}
        <Card className="col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-blue-500" />
                  Active Jobs
                </CardTitle>
                <CardDescription>Currently processing</CardDescription>
              </div>
              <Badge variant="secondary">{runningJobs.length} running</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {runningJobs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Bot className="h-12 w-12 mx-auto mb-2 opacity-30" />
                <p>No active jobs</p>
              </div>
            ) : (
              runningJobs.map(job => (
                <Card key={job.id} className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <StatusIcon status={job.status} />
                          <Badge variant="outline">{job.repo}</Badge>
                        </div>
                        <p className="font-medium">{job.title}</p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem><Eye className="h-4 w-4 mr-2" />View details</DropdownMenuItem>
                          <DropdownMenuItem><Terminal className="h-4 w-4 mr-2" />View logs</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive">
                            <Square className="h-4 w-4 mr-2" />Stop job
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-medium">{job.progress}%</span>
                      </div>
                      <Progress value={job.progress} className="h-2" />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Started {job.startedAt}</span>
                        <span>Est. {job.estimatedCompletion} remaining</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}

            {queuedJobs.length > 0 && (
              <>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>Queued ({queuedJobs.length})</span>
                </div>
                {queuedJobs.map(job => (
                  <Card key={job.id} className="border-dashed">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <StatusIcon status={job.status} />
                          <div>
                            <p className="font-medium">{job.title}</p>
                            <p className="text-sm text-muted-foreground">{job.repo}</p>
                          </div>
                        </div>
                        <Button variant="outline" size="sm">
                          <Play className="h-4 w-4 mr-1" />
                          Start Now
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </>
            )}
          </CardContent>
        </Card>

        {/* Activity & Recent */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentActivity.map(item => (
                <div key={item.id} className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{item.action}</p>
                    <p className="text-xs text-muted-foreground">{item.job}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{item.time}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Recent Jobs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentJobs.map(job => (
                <div key={job.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                  <StatusIcon status={job.status} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{job.title}</p>
                    <p className="text-xs text-muted-foreground">${job.cost.toFixed(2)}</p>
                  </div>
                  {job.prUrl && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                      <a href={job.prUrl} target="_blank" rel="noopener noreferrer">
                        <GitPullRequest className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
