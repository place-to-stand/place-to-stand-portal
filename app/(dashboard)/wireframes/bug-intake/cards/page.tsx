'use client'

import { useState } from 'react'
import {
  Bug,
  AlertTriangle,
  AlertCircle,
  Info,
  Clock,
  User,
  Mail,
  GitBranch,
  FileCode,
  Search,
  Plus,
  MoreHorizontal,
  Sparkles,
  Brain,
  CheckCircle2,
  XCircle,
  Eye,
  MessageSquare,
  Bot,
  Loader2,
  Filter,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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

const mockBugs = [
  {
    id: '1',
    title: 'TypeScript compilation error in auth module',
    description: 'Getting TS2322 error when building the project.',
    severity: 'high',
    status: 'new',
    source: 'email',
    reporter: { name: 'Damon Bodine', initials: 'DB' },
    repo: 'place-to-stand-portal',
    createdAt: '15 minutes ago',
    aiAnalysis: { confidence: 87, category: 'Type Error', canAutoFix: true },
  },
  {
    id: '2',
    title: 'N+1 query causing slow page loads',
    description: 'The projects page takes 5+ seconds to load.',
    severity: 'medium',
    status: 'analyzing',
    source: 'slack',
    reporter: { name: 'Team Member', initials: 'TM' },
    repo: 'place-to-stand-portal',
    createdAt: '1 hour ago',
    aiAnalysis: { confidence: 72, category: 'Performance', canAutoFix: true },
  },
  {
    id: '3',
    title: 'Button click not working on mobile Safari',
    description: 'The Submit button doesn\'t respond to taps on iOS.',
    severity: 'medium',
    status: 'new',
    source: 'form',
    reporter: { name: 'User Report', initials: 'UR' },
    repo: 'marketing-site',
    createdAt: '2 hours ago',
    aiAnalysis: null,
  },
  {
    id: '4',
    title: 'Email notifications not sending',
    description: 'Task assignment emails are not being sent.',
    severity: 'critical',
    status: 'assigned',
    source: 'email',
    reporter: { name: 'Damon Bodine', initials: 'DB' },
    repo: 'place-to-stand-portal',
    createdAt: '3 hours ago',
    aiAnalysis: { confidence: 95, category: 'Integration', canAutoFix: true },
  },
]

const stats = {
  new: 2,
  analyzing: 1,
  assigned: 1,
  total: 4,
}

function SeverityBadge({ severity }: { severity: string }) {
  switch (severity) {
    case 'critical':
      return <Badge className="bg-red-500"><AlertCircle className="h-3 w-3 mr-1" />Critical</Badge>
    case 'high':
      return <Badge className="bg-orange-500"><AlertTriangle className="h-3 w-3 mr-1" />High</Badge>
    case 'medium':
      return <Badge className="bg-amber-500"><Info className="h-3 w-3 mr-1" />Medium</Badge>
    default:
      return <Badge variant="secondary"><Info className="h-3 w-3 mr-1" />Low</Badge>
  }
}

function SourceIcon({ source }: { source: string }) {
  switch (source) {
    case 'email': return <Mail className="h-4 w-4" />
    case 'slack': return <MessageSquare className="h-4 w-4" />
    case 'form': return <FileCode className="h-4 w-4" />
    default: return <User className="h-4 w-4" />
  }
}

export default function BugIntakeCardsPage() {
  const [statusFilter, setStatusFilter] = useState('all')

  const filteredBugs = statusFilter === 'all'
    ? mockBugs
    : mockBugs.filter(b => b.status === statusFilter)

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bug Intake</h1>
          <p className="text-muted-foreground">Manage incoming bug reports</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Submit Bug
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/30 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600">New</p>
                <p className="text-3xl font-bold text-blue-700">{stats.new}</p>
              </div>
              <Bug className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-violet-50 to-violet-100 dark:from-violet-950/30 dark:to-violet-900/30 border-violet-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-violet-600">Analyzing</p>
                <p className="text-3xl font-bold text-violet-700">{stats.analyzing}</p>
              </div>
              <Brain className="h-8 w-8 text-violet-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/30 dark:to-green-900/30 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600">Assigned</p>
                <p className="text-3xl font-bold text-green-700">{stats.assigned}</p>
              </div>
              <Bot className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-3xl font-bold">{stats.total}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search bugs..." className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="analyzing">Analyzing</SelectItem>
            <SelectItem value="assigned">Assigned</SelectItem>
          </SelectContent>
        </Select>
        <Select defaultValue="all">
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severity</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bug Cards */}
      <div className="grid grid-cols-2 gap-4">
        {filteredBugs.map(bug => (
          <Card key={bug.id} className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <SeverityBadge severity={bug.severity} />
                  {bug.status === 'analyzing' && (
                    <Badge variant="outline" className="gap-1 text-violet-600">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Analyzing
                    </Badge>
                  )}
                  {bug.status === 'assigned' && (
                    <Badge variant="outline" className="gap-1 text-green-600">
                      <Bot className="h-3 w-3" />
                      Assigned
                    </Badge>
                  )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem><Eye className="h-4 w-4 mr-2" />View details</DropdownMenuItem>
                    <DropdownMenuItem><Bot className="h-4 w-4 mr-2" />Assign to Bug Bot</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive">
                      <XCircle className="h-4 w-4 mr-2" />Reject
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <h3 className="font-semibold mb-1">{bug.title}</h3>
              <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{bug.description}</p>

              <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                <div className="flex items-center gap-1">
                  <SourceIcon source={bug.source} />
                  <span className="capitalize">{bug.source}</span>
                </div>
                <div className="flex items-center gap-1">
                  <GitBranch className="h-4 w-4" />
                  {bug.repo}
                </div>
              </div>

              {bug.aiAnalysis ? (
                <div className={cn(
                  'p-3 rounded-lg',
                  bug.aiAnalysis.canAutoFix
                    ? 'bg-green-50 dark:bg-green-950/20 border border-green-200'
                    : 'bg-amber-50 dark:bg-amber-950/20 border border-amber-200'
                )}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-violet-500" />
                      <span className="text-sm font-medium">{bug.aiAnalysis.category}</span>
                    </div>
                    <Badge variant="outline">{bug.aiAnalysis.confidence}%</Badge>
                  </div>
                  {bug.aiAnalysis.canAutoFix && (
                    <div className="flex items-center gap-1 text-xs text-green-600">
                      <CheckCircle2 className="h-3 w-3" />
                      Can auto-fix
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3 rounded-lg border border-dashed text-center">
                  <Brain className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Awaiting analysis</p>
                </div>
              )}

              <div className="flex items-center justify-between mt-3 pt-3 border-t">
                <div className="flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-xs">{bug.reporter.initials}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm">{bug.reporter.name}</span>
                </div>
                <span className="text-xs text-muted-foreground">{bug.createdAt}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
