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
  Filter,
  Search,
  ChevronDown,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
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
    duration: '5m 23s',
    cost: 2.47,
  },
  {
    id: '2',
    title: 'Resolve N+1 query in projects list',
    repo: 'place-to-stand-portal',
    status: 'complete',
    progress: 100,
    startedAt: '1 hour ago',
    duration: '15m 42s',
    cost: 8.92,
    prUrl: '#',
  },
  {
    id: '3',
    title: 'Fix mobile responsive layout on dashboard',
    repo: 'marketing-site',
    status: 'failed',
    progress: 40,
    startedAt: '2 hours ago',
    duration: '8m 12s',
    cost: 4.21,
  },
  {
    id: '4',
    title: 'Update deprecated API endpoint',
    repo: 'place-to-stand-portal',
    status: 'queued',
    progress: 0,
    queuedAt: '10 min ago',
    duration: '-',
    cost: 0,
  },
  {
    id: '5',
    title: 'Fix date parsing in timezone handler',
    repo: 'api-gateway',
    status: 'complete',
    progress: 100,
    startedAt: '3 hours ago',
    duration: '12m 05s',
    cost: 6.18,
    prUrl: '#',
  },
]

const mockStats = {
  active: 1,
  queued: 1,
  completed: 45,
  failed: 3,
  successRate: 78,
  totalCost: 301.74,
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'running':
      return <Badge className="gap-1 bg-blue-500"><Loader2 className="h-3 w-3 animate-spin" />Running</Badge>
    case 'complete':
      return <Badge className="gap-1 bg-green-500"><CheckCircle2 className="h-3 w-3" />Complete</Badge>
    case 'failed':
      return <Badge className="gap-1 bg-red-500"><XCircle className="h-3 w-3" />Failed</Badge>
    case 'queued':
      return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />Queued</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

export default function BugBotCompactPage() {
  const [selectedJobs, setSelectedJobs] = useState<string[]>([])
  const [botEnabled, setBotEnabled] = useState(true)

  const toggleJob = (id: string) => {
    setSelectedJobs(prev =>
      prev.includes(id) ? prev.filter(j => j !== id) : [...prev, id]
    )
  }

  const toggleAll = () => {
    setSelectedJobs(prev =>
      prev.length === mockJobs.length ? [] : mockJobs.map(j => j.id)
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="border-b px-4 py-2 flex items-center justify-between bg-background">
        <div className="flex items-center gap-3">
          <Bot className="h-5 w-5 text-violet-500" />
          <h1 className="font-semibold">Bug Bot</h1>
          <div className="flex items-center gap-1 text-sm">
            <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
              <Activity className="h-3 w-3" />
              <span>{mockStats.active}</span>
            </div>
            <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
              <Clock className="h-3 w-3" />
              <span>{mockStats.queued}</span>
            </div>
            <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
              <CheckCircle2 className="h-3 w-3" />
              <span>{mockStats.successRate}%</span>
            </div>
            <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-muted text-muted-foreground">
              <DollarSign className="h-3 w-3" />
              <span>${mockStats.totalCost}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch checked={botEnabled} onCheckedChange={setBotEnabled} />
            <span className="text-sm">{botEnabled ? 'Active' : 'Paused'}</span>
          </div>
          <Button variant="outline" size="sm"><Settings className="h-4 w-4" /></Button>
          <Button size="sm"><Bug className="h-4 w-4 mr-1" />New Bug</Button>
        </div>
      </div>

      {/* Tabs & Filters */}
      <div className="border-b px-4 py-2 flex items-center justify-between bg-muted/30">
        <Tabs defaultValue="all" className="w-auto">
          <TabsList className="h-8">
            <TabsTrigger value="all" className="text-xs h-7">All ({mockJobs.length})</TabsTrigger>
            <TabsTrigger value="running" className="text-xs h-7">Running ({mockStats.active})</TabsTrigger>
            <TabsTrigger value="queued" className="text-xs h-7">Queued ({mockStats.queued})</TabsTrigger>
            <TabsTrigger value="complete" className="text-xs h-7">Complete</TabsTrigger>
            <TabsTrigger value="failed" className="text-xs h-7">Failed</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          {selectedJobs.length > 0 && (
            <div className="flex items-center gap-2 mr-2">
              <span className="text-sm text-muted-foreground">{selectedJobs.length} selected</span>
              <Button variant="outline" size="sm">
                <Square className="h-3 w-3 mr-1" />Stop
              </Button>
              <Button variant="outline" size="sm">
                <RefreshCw className="h-3 w-3 mr-1" />Retry
              </Button>
            </div>
          )}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <Input placeholder="Search..." className="h-7 pl-7 w-48 text-xs" />
          </div>
          <Select defaultValue="all">
            <SelectTrigger className="h-7 w-32 text-xs">
              <SelectValue placeholder="Repository" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All repos</SelectItem>
              <SelectItem value="portal">place-to-stand-portal</SelectItem>
              <SelectItem value="marketing">marketing-site</SelectItem>
              <SelectItem value="api">api-gateway</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-background">
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={selectedJobs.length === mockJobs.length}
                  onCheckedChange={toggleAll}
                />
              </TableHead>
              <TableHead className="w-24">Status</TableHead>
              <TableHead>Bug</TableHead>
              <TableHead className="w-40">Repository</TableHead>
              <TableHead className="w-32">Progress</TableHead>
              <TableHead className="w-24">Duration</TableHead>
              <TableHead className="w-20 text-right">Cost</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockJobs.map(job => (
              <TableRow key={job.id} className={cn(selectedJobs.includes(job.id) && 'bg-muted/50')}>
                <TableCell>
                  <Checkbox
                    checked={selectedJobs.includes(job.id)}
                    onCheckedChange={() => toggleJob(job.id)}
                  />
                </TableCell>
                <TableCell><StatusBadge status={job.status} /></TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium text-sm">{job.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {job.status === 'queued' ? `Queued ${job.queuedAt}` : `Started ${job.startedAt}`}
                    </p>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <GitBranch className="h-3 w-3 text-muted-foreground" />
                    <span className="text-sm">{job.repo}</span>
                  </div>
                </TableCell>
                <TableCell>
                  {job.status === 'running' ? (
                    <div className="space-y-1">
                      <Progress value={job.progress} className="h-1.5" />
                      <span className="text-xs text-muted-foreground">{job.progress}%</span>
                    </div>
                  ) : job.status === 'complete' ? (
                    <span className="text-xs text-green-600">100%</span>
                  ) : job.status === 'failed' ? (
                    <span className="text-xs text-red-600">{job.progress}%</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-sm">{job.duration}</TableCell>
                <TableCell className="text-right text-sm">${job.cost.toFixed(2)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {job.prUrl && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                        <a href={job.prUrl}><GitPullRequest className="h-3 w-3" /></a>
                      </Button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreHorizontal className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem><Eye className="h-3 w-3 mr-2" />Details</DropdownMenuItem>
                        <DropdownMenuItem><Terminal className="h-3 w-3 mr-2" />Logs</DropdownMenuItem>
                        {job.status === 'running' && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive">
                              <Square className="h-3 w-3 mr-2" />Stop
                            </DropdownMenuItem>
                          </>
                        )}
                        {job.status === 'failed' && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem>
                              <RefreshCw className="h-3 w-3 mr-2" />Retry
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Footer */}
      <div className="border-t px-4 py-2 flex items-center justify-between text-sm text-muted-foreground bg-muted/30">
        <span>{mockJobs.length} jobs · {mockStats.successRate}% success rate</span>
        <span>Total spend: ${mockStats.totalCost.toFixed(2)}</span>
      </div>
    </div>
  )
}
