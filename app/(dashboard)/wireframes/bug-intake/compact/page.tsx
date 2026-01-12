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
  CheckCircle2,
  XCircle,
  Eye,
  MessageSquare,
  Bot,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
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

const mockBugs = [
  {
    id: '1',
    title: 'TypeScript compilation error in auth module',
    severity: 'high',
    status: 'new',
    source: 'email',
    reporter: 'Damon Bodine',
    repo: 'place-to-stand-portal',
    createdAt: '15 min ago',
    confidence: 87,
    canAutoFix: true,
  },
  {
    id: '2',
    title: 'N+1 query causing slow page loads',
    severity: 'medium',
    status: 'analyzing',
    source: 'slack',
    reporter: 'Team Member',
    repo: 'place-to-stand-portal',
    createdAt: '1 hour ago',
    confidence: 72,
    canAutoFix: true,
  },
  {
    id: '3',
    title: 'Button click not working on mobile Safari',
    severity: 'medium',
    status: 'new',
    source: 'form',
    reporter: 'User Report',
    repo: 'marketing-site',
    createdAt: '2 hours ago',
    confidence: null,
    canAutoFix: null,
  },
  {
    id: '4',
    title: 'Email notifications not sending',
    severity: 'critical',
    status: 'assigned',
    source: 'email',
    reporter: 'Damon Bodine',
    repo: 'place-to-stand-portal',
    createdAt: '3 hours ago',
    confidence: 95,
    canAutoFix: true,
  },
  {
    id: '5',
    title: 'Dashboard chart showing wrong dates',
    severity: 'low',
    status: 'rejected',
    source: 'manual',
    reporter: 'Damon Bodine',
    repo: 'place-to-stand-portal',
    createdAt: 'Yesterday',
    confidence: 45,
    canAutoFix: false,
  },
]

function SeverityBadge({ severity }: { severity: string }) {
  switch (severity) {
    case 'critical':
      return <Badge className="bg-red-500 text-xs">Critical</Badge>
    case 'high':
      return <Badge className="bg-orange-500 text-xs">High</Badge>
    case 'medium':
      return <Badge className="bg-amber-500 text-xs">Medium</Badge>
    default:
      return <Badge variant="secondary" className="text-xs">Low</Badge>
  }
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'new':
      return <Badge variant="outline" className="text-blue-600 border-blue-200 text-xs">New</Badge>
    case 'analyzing':
      return <Badge variant="outline" className="text-violet-600 border-violet-200 text-xs gap-1"><Loader2 className="h-3 w-3 animate-spin" />Analyzing</Badge>
    case 'assigned':
      return <Badge variant="outline" className="text-green-600 border-green-200 text-xs gap-1"><Bot className="h-3 w-3" />Assigned</Badge>
    case 'rejected':
      return <Badge variant="outline" className="text-gray-600 border-gray-200 text-xs">Rejected</Badge>
    default:
      return <Badge variant="secondary" className="text-xs">{status}</Badge>
  }
}

function SourceIcon({ source }: { source: string }) {
  switch (source) {
    case 'email': return <Mail className="h-3 w-3" />
    case 'slack': return <MessageSquare className="h-3 w-3" />
    case 'form': return <FileCode className="h-3 w-3" />
    default: return <User className="h-3 w-3" />
  }
}

export default function BugIntakeCompactPage() {
  const [selectedBugs, setSelectedBugs] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState('all')

  const toggleBug = (id: string) => {
    setSelectedBugs(prev =>
      prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]
    )
  }

  const toggleAll = () => {
    setSelectedBugs(prev =>
      prev.length === mockBugs.length ? [] : mockBugs.map(b => b.id)
    )
  }

  const filteredBugs = activeTab === 'all'
    ? mockBugs
    : mockBugs.filter(b => b.status === activeTab)

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="border-b px-4 py-2 flex items-center justify-between bg-background">
        <div className="flex items-center gap-3">
          <Bug className="h-5 w-5 text-violet-500" />
          <h1 className="font-semibold">Bug Intake</h1>
          <div className="flex items-center gap-1 text-xs">
            <Badge variant="secondary">{mockBugs.filter(b => b.status === 'new').length} new</Badge>
            <Badge variant="secondary">{mockBugs.filter(b => b.status === 'analyzing').length} analyzing</Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm"><RefreshCw className="h-4 w-4 mr-1" />Sync</Button>
          <Button size="sm"><Plus className="h-4 w-4 mr-1" />New Bug</Button>
        </div>
      </div>

      {/* Tabs & Filters */}
      <div className="border-b px-4 py-2 flex items-center justify-between bg-muted/30">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto">
          <TabsList className="h-8">
            <TabsTrigger value="all" className="text-xs h-7">All ({mockBugs.length})</TabsTrigger>
            <TabsTrigger value="new" className="text-xs h-7">New</TabsTrigger>
            <TabsTrigger value="analyzing" className="text-xs h-7">Analyzing</TabsTrigger>
            <TabsTrigger value="assigned" className="text-xs h-7">Assigned</TabsTrigger>
            <TabsTrigger value="rejected" className="text-xs h-7">Rejected</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          {selectedBugs.length > 0 && (
            <div className="flex items-center gap-2 mr-2">
              <span className="text-sm text-muted-foreground">{selectedBugs.length} selected</span>
              <Button variant="outline" size="sm"><Bot className="h-3 w-3 mr-1" />Assign</Button>
              <Button variant="outline" size="sm"><XCircle className="h-3 w-3 mr-1" />Reject</Button>
            </div>
          )}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <Input placeholder="Search..." className="h-7 pl-7 w-48 text-xs" />
          </div>
          <Select defaultValue="all">
            <SelectTrigger className="h-7 w-28 text-xs">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
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
                <Checkbox checked={selectedBugs.length === mockBugs.length} onCheckedChange={toggleAll} />
              </TableHead>
              <TableHead className="w-20">Severity</TableHead>
              <TableHead>Bug</TableHead>
              <TableHead className="w-24">Status</TableHead>
              <TableHead className="w-32">Repository</TableHead>
              <TableHead className="w-24">Source</TableHead>
              <TableHead className="w-24">Confidence</TableHead>
              <TableHead className="w-24">Reported</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredBugs.map(bug => (
              <TableRow key={bug.id} className={cn(selectedBugs.includes(bug.id) && 'bg-muted/50')}>
                <TableCell>
                  <Checkbox checked={selectedBugs.includes(bug.id)} onCheckedChange={() => toggleBug(bug.id)} />
                </TableCell>
                <TableCell><SeverityBadge severity={bug.severity} /></TableCell>
                <TableCell>
                  <p className="font-medium text-sm truncate max-w-md">{bug.title}</p>
                  <p className="text-xs text-muted-foreground">{bug.reporter}</p>
                </TableCell>
                <TableCell><StatusBadge status={bug.status} /></TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 text-sm">
                    <GitBranch className="h-3 w-3 text-muted-foreground" />
                    <span className="truncate">{bug.repo}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 text-sm capitalize">
                    <SourceIcon source={bug.source} />
                    {bug.source}
                  </div>
                </TableCell>
                <TableCell>
                  {bug.confidence !== null ? (
                    <div className="flex items-center gap-2">
                      <Progress value={bug.confidence} className="w-12 h-1.5" />
                      <span className="text-xs">{bug.confidence}%</span>
                      {bug.canAutoFix && <CheckCircle2 className="h-3 w-3 text-green-500" />}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{bug.createdAt}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <MoreHorizontal className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem><Eye className="h-3 w-3 mr-2" />Details</DropdownMenuItem>
                      <DropdownMenuItem><Bot className="h-3 w-3 mr-2" />Assign to Bot</DropdownMenuItem>
                      <DropdownMenuItem><Sparkles className="h-3 w-3 mr-2" />Re-analyze</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive"><XCircle className="h-3 w-3 mr-2" />Reject</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Footer */}
      <div className="border-t px-4 py-2 flex items-center justify-between text-sm text-muted-foreground bg-muted/30">
        <span>{filteredBugs.length} bugs</span>
        <span>{mockBugs.filter(b => b.canAutoFix).length} can auto-fix</span>
      </div>
    </div>
  )
}
