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
  AlertTriangle,
  Loader2,
  MoreHorizontal,
  ExternalLink,
  DollarSign,
  Cpu,
  Activity,
  Zap,
  Settings,
  Shield,
  Eye,
  ChevronRight,
  ChevronDown,
  FileCode,
  Folder,
  Search,
  Filter,
  BarChart3,
  TrendingUp,
  AlertCircle,
  Bot,
  Sparkles,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { AppShellHeader } from '@/components/layout/app-shell'

// Mock data for bug jobs
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
  },
  {
    id: '2',
    title: 'Resolve N+1 query in projects list',
    repo: 'place-to-stand-portal',
    status: 'complete',
    progress: 100,
    startedAt: '1 hour ago',
    completedAt: '45 min ago',
    cost: 8.92,
    prUrl: 'https://github.com/org/repo/pull/123',
    steps: [],
  },
  {
    id: '3',
    title: 'Fix mobile responsive layout on dashboard',
    repo: 'marketing-site',
    status: 'failed',
    progress: 40,
    startedAt: '2 hours ago',
    failedAt: '1 hour ago',
    cost: 4.21,
    error: 'Could not identify root cause - multiple layout issues found',
    steps: [],
  },
  {
    id: '4',
    title: 'Update deprecated API endpoint',
    repo: 'place-to-stand-portal',
    status: 'queued',
    progress: 0,
    queuedAt: '10 min ago',
    estimatedStart: '8 min',
    cost: 0,
    steps: [],
  },
]

// Mock stats
const mockStats = {
  totalJobs: 47,
  successRate: 78,
  avgCost: 6.42,
  totalCost: 301.74,
  avgTime: '12 min',
  activeJobs: 1,
  queuedJobs: 1,
}

// Mock repositories
const mockRepos = [
  { id: '1', name: 'place-to-stand-portal', bugs: 12, lastIndexed: '2 hours ago' },
  { id: '2', name: 'marketing-site', bugs: 3, lastIndexed: '1 day ago' },
  { id: '3', name: 'api-gateway', bugs: 5, lastIndexed: '3 hours ago' },
]

// Status badge helper
function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'running':
      return (
        <Badge className="gap-1 bg-blue-500">
          <Loader2 className="h-3 w-3 animate-spin" />
          Running
        </Badge>
      )
    case 'complete':
      return (
        <Badge className="gap-1 bg-green-500">
          <CheckCircle2 className="h-3 w-3" />
          Complete
        </Badge>
      )
    case 'failed':
      return (
        <Badge className="gap-1 bg-red-500">
          <XCircle className="h-3 w-3" />
          Failed
        </Badge>
      )
    case 'queued':
      return (
        <Badge variant="secondary" className="gap-1">
          <Clock className="h-3 w-3" />
          Queued
        </Badge>
      )
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

// Job card component
function JobCard({ job, onSelect }: { job: typeof mockJobs[0], onSelect: () => void }) {
  return (
    <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={onSelect}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <StatusBadge status={job.status} />
              <Badge variant="outline" className="gap-1">
                <GitBranch className="h-3 w-3" />
                {job.repo}
              </Badge>
            </div>
            <p className="font-medium truncate">{job.title}</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Eye className="h-4 w-4 mr-2" />
                View details
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Terminal className="h-4 w-4 mr-2" />
                View logs
              </DropdownMenuItem>
              {job.status === 'running' && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive">
                    <Square className="h-4 w-4 mr-2" />
                    Stop job
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {job.status === 'running' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Progress</span>
              <span>{job.progress}%</span>
            </div>
            <Progress value={job.progress} className="h-2" />
            <p className="text-xs text-muted-foreground">
              Est. completion: {job.estimatedCompletion}
            </p>
          </div>
        )}

        <div className="flex items-center justify-between mt-3 text-sm text-muted-foreground">
          <span>{job.status === 'queued' ? `Queued ${job.queuedAt}` : `Started ${job.startedAt}`}</span>
          <span className="flex items-center gap-1">
            <DollarSign className="h-3 w-3" />
            {job.cost.toFixed(2)}
          </span>
        </div>

        {job.prUrl && (
          <Button variant="outline" size="sm" className="w-full mt-3 gap-1" asChild onClick={(e) => e.stopPropagation()}>
            <a href={job.prUrl} target="_blank" rel="noopener noreferrer">
              <GitPullRequest className="h-4 w-4" />
              View Pull Request
              <ExternalLink className="h-3 w-3 ml-1" />
            </a>
          </Button>
        )}

        {job.error && (
          <div className="mt-3 p-2 rounded-md bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900">
            <p className="text-xs text-red-600 dark:text-red-400">{job.error}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Active job detail panel
function JobDetailPanel({ job }: { job: typeof mockJobs[0] }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold mb-1">{job.title}</h3>
        <div className="flex items-center gap-2">
          <StatusBadge status={job.status} />
          <Badge variant="outline">{job.repo}</Badge>
        </div>
      </div>

      {job.status === 'running' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>Progress</span>
            <span className="font-medium">{job.progress}%</span>
          </div>
          <Progress value={job.progress} className="h-3" />
        </div>
      )}

      <Separator />

      <div className="space-y-3">
        <p className="text-sm font-medium">Execution Steps</p>
        {job.steps.map((step, i) => (
          <div key={i} className="flex items-center gap-3">
            {step.status === 'complete' ? (
              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
            ) : step.status === 'running' ? (
              <Loader2 className="h-4 w-4 text-blue-500 animate-spin shrink-0" />
            ) : (
              <div className="h-4 w-4 rounded-full border-2 border-muted shrink-0" />
            )}
            <span className={`text-sm flex-1 ${step.status === 'pending' ? 'text-muted-foreground' : ''}`}>
              {step.name}
            </span>
            {step.duration && (
              <span className="text-xs text-muted-foreground">{step.duration}</span>
            )}
          </div>
        ))}
      </div>

      <Separator />

      <div className="space-y-2">
        <p className="text-sm font-medium">Cost Breakdown</p>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Claude API</span>
            <span>${(job.cost * 0.85).toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Compute</span>
            <span>${(job.cost * 0.15).toFixed(2)}</span>
          </div>
        </div>
        <div className="flex justify-between font-medium border-t pt-2">
          <span>Total</span>
          <span>${job.cost.toFixed(2)}</span>
        </div>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" className="flex-1">
          <Terminal className="h-4 w-4 mr-1" />
          Logs
        </Button>
        {job.status === 'running' && (
          <Button variant="destructive" className="flex-1">
            <Square className="h-4 w-4 mr-1" />
            Stop
          </Button>
        )}
      </div>
    </div>
  )
}

// Main bug bot dashboard
export default function BugBotDashboardWireframePage() {
  const [activeTab, setActiveTab] = useState('jobs')
  const [selectedJob, setSelectedJob] = useState<typeof mockJobs[0] | null>(mockJobs[0])
  const [botEnabled, setBotEnabled] = useState(true)

  return (
    <TooltipProvider>
      <>
        <AppShellHeader>
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600">
                <Bot className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Bug Bot</h1>
                <p className="text-muted-foreground text-sm">
                  Autonomous bug fixing agent
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Label className="text-sm">Agent</Label>
                <Switch checked={botEnabled} onCheckedChange={setBotEnabled} />
                <Badge variant={botEnabled ? 'default' : 'secondary'}>
                  {botEnabled ? 'Active' : 'Paused'}
                </Badge>
              </div>
              <Separator orientation="vertical" className="h-8" />
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
              <Button>
                <Bug className="h-4 w-4 mr-2" />
                Submit Bug
              </Button>
            </div>
          </div>
        </AppShellHeader>

        {/* Stats bar */}
        <div className="border-b px-6 py-4">
          <div className="grid grid-cols-6 gap-4">
            <Card className="p-3">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-blue-500" />
                <span className="text-sm text-muted-foreground">Active</span>
              </div>
              <p className="text-2xl font-bold mt-1">{mockStats.activeJobs}</p>
            </Card>
            <Card className="p-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-500" />
                <span className="text-sm text-muted-foreground">Queued</span>
              </div>
              <p className="text-2xl font-bold mt-1">{mockStats.queuedJobs}</p>
            </Card>
            <Card className="p-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-sm text-muted-foreground">Success Rate</span>
              </div>
              <p className="text-2xl font-bold mt-1">{mockStats.successRate}%</p>
            </Card>
            <Card className="p-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-purple-500" />
                <span className="text-sm text-muted-foreground">Total Jobs</span>
              </div>
              <p className="text-2xl font-bold mt-1">{mockStats.totalJobs}</p>
            </Card>
            <Card className="p-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Avg Time</span>
              </div>
              <p className="text-2xl font-bold mt-1">{mockStats.avgTime}</p>
            </Card>
            <Card className="p-3">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-500" />
                <span className="text-sm text-muted-foreground">Total Cost</span>
              </div>
              <p className="text-2xl font-bold mt-1">${mockStats.totalCost}</p>
            </Card>
          </div>
        </div>

        <div className="flex h-[calc(100vh-14rem)]">
          {/* Main content */}
          <div className="flex-1 p-6 overflow-y-auto">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <div className="flex items-center justify-between mb-4">
                <TabsList>
                  <TabsTrigger value="jobs">Jobs</TabsTrigger>
                  <TabsTrigger value="repos">Repositories</TabsTrigger>
                  <TabsTrigger value="costs">Costs</TabsTrigger>
                </TabsList>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search jobs..." className="pl-9 w-64" />
                  </div>
                  <Select defaultValue="all">
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All status</SelectItem>
                      <SelectItem value="running">Running</SelectItem>
                      <SelectItem value="queued">Queued</SelectItem>
                      <SelectItem value="complete">Complete</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <TabsContent value="jobs" className="mt-0">
                <div className="grid grid-cols-2 gap-4">
                  {mockJobs.map(job => (
                    <JobCard
                      key={job.id}
                      job={job}
                      onSelect={() => setSelectedJob(job)}
                    />
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="repos" className="mt-0">
                <Card>
                  <CardHeader>
                    <CardTitle>Indexed Repositories</CardTitle>
                    <CardDescription>Repositories the bug bot can work on</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Repository</TableHead>
                          <TableHead>Open Bugs</TableHead>
                          <TableHead>Last Indexed</TableHead>
                          <TableHead className="w-[100px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mockRepos.map(repo => (
                          <TableRow key={repo.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <GitBranch className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">{repo.name}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">{repo.bugs} bugs</Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{repo.lastIndexed}</TableCell>
                            <TableCell>
                              <Button variant="ghost" size="sm">
                                <RefreshCw className="h-4 w-4 mr-1" />
                                Reindex
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="costs" className="mt-0">
                <div className="grid grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Cost Breakdown</CardTitle>
                      <CardDescription>Last 30 days</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm">Claude API (Opus)</span>
                            <span className="font-medium">$256.48</span>
                          </div>
                          <Progress value={85} className="h-2" />
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm">Compute (Docker)</span>
                            <span className="font-medium">$38.21</span>
                          </div>
                          <Progress value={12} className="h-2" />
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm">GitHub API</span>
                            <span className="font-medium">$7.05</span>
                          </div>
                          <Progress value={3} className="h-2" />
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between font-medium">
                          <span>Total (30 days)</span>
                          <span>$301.74</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Budget Settings</CardTitle>
                      <CardDescription>Control spending limits</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label>Daily limit</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-muted-foreground">$</span>
                          <Input type="number" defaultValue={50} className="w-24" />
                          <span className="text-sm text-muted-foreground">/ day</span>
                        </div>
                      </div>
                      <div>
                        <Label>Per-job limit</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-muted-foreground">$</span>
                          <Input type="number" defaultValue={15} className="w-24" />
                          <span className="text-sm text-muted-foreground">/ job</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Pause on budget exceeded</Label>
                          <p className="text-xs text-muted-foreground">Stop accepting new jobs</p>
                        </div>
                        <Switch defaultChecked />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Job detail sidebar */}
          {selectedJob && (
            <div className="w-80 border-l p-4 overflow-y-auto">
              <JobDetailPanel job={selectedJob} />
            </div>
          )}
        </div>
      </>
    </TooltipProvider>
  )
}
