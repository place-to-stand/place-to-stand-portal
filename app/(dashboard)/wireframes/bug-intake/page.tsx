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
  Tag,
  ChevronRight,
  Search,
  Filter,
  Plus,
  MoreHorizontal,
  Sparkles,
  Brain,
  CheckCircle2,
  XCircle,
  Play,
  Eye,
  MessageSquare,
  Link2,
  RefreshCw,
  ArrowUpRight,
  Zap,
  Target,
  Bot,
  Loader2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { AppShellHeader } from '@/components/layout/app-shell'

// Mock bug data
const mockBugs = [
  {
    id: '1',
    title: 'TypeScript compilation error in auth module',
    description: 'Getting TS2322 error when building the project. The auth middleware is throwing type errors after the recent update.',
    severity: 'high',
    status: 'new',
    source: 'email',
    reporter: { name: 'Damon Bodine', email: 'damon@example.com' },
    repo: 'place-to-stand-portal',
    createdAt: '15 minutes ago',
    aiAnalysis: {
      confidence: 87,
      category: 'Type Error',
      suggestedFiles: ['lib/auth/middleware.ts', 'lib/auth/session.ts'],
      estimatedComplexity: 'low',
      canAutoFix: true,
    },
  },
  {
    id: '2',
    title: 'N+1 query causing slow page loads on projects list',
    description: 'The projects page takes 5+ seconds to load when there are many projects. SQL logs show multiple queries per project.',
    severity: 'medium',
    status: 'analyzing',
    source: 'slack',
    reporter: { name: 'Team Member', email: 'team@example.com' },
    repo: 'place-to-stand-portal',
    createdAt: '1 hour ago',
    aiAnalysis: {
      confidence: 72,
      category: 'Performance',
      suggestedFiles: ['lib/queries/projects.ts', 'lib/data/projects.ts'],
      estimatedComplexity: 'medium',
      canAutoFix: true,
    },
  },
  {
    id: '3',
    title: 'Button click not working on mobile Safari',
    description: 'The "Submit" button on the contact form doesn\'t respond to taps on iOS Safari.',
    severity: 'medium',
    status: 'new',
    source: 'form',
    reporter: { name: 'User Report', email: 'user@example.com' },
    repo: 'marketing-site',
    createdAt: '2 hours ago',
    aiAnalysis: null, // Not yet analyzed
  },
  {
    id: '4',
    title: 'Email notifications not sending',
    description: 'Task assignment emails are not being sent. Checked Resend dashboard and no emails are being triggered.',
    severity: 'critical',
    status: 'assigned',
    source: 'email',
    reporter: { name: 'Damon Bodine', email: 'damon@example.com' },
    repo: 'place-to-stand-portal',
    createdAt: '3 hours ago',
    assignedTo: 'bug-bot',
    aiAnalysis: {
      confidence: 95,
      category: 'Integration',
      suggestedFiles: ['lib/email/send.ts', 'app/api/tasks/[taskId]/assign/route.ts'],
      estimatedComplexity: 'medium',
      canAutoFix: true,
    },
  },
  {
    id: '5',
    title: 'Dashboard chart showing wrong dates',
    description: 'The timeline chart on the dashboard shows dates off by one day, likely a timezone issue.',
    severity: 'low',
    status: 'rejected',
    source: 'manual',
    reporter: { name: 'Damon Bodine', email: 'damon@example.com' },
    repo: 'place-to-stand-portal',
    createdAt: 'Yesterday',
    rejectionReason: 'Duplicate of #42',
    aiAnalysis: {
      confidence: 45,
      category: 'UI Bug',
      suggestedFiles: ['components/dashboard/timeline-chart.tsx'],
      estimatedComplexity: 'low',
      canAutoFix: false,
    },
  },
]

// Severity badge helper
function SeverityBadge({ severity }: { severity: string }) {
  switch (severity) {
    case 'critical':
      return <Badge className="bg-red-500 gap-1"><AlertCircle className="h-3 w-3" />Critical</Badge>
    case 'high':
      return <Badge className="bg-orange-500 gap-1"><AlertTriangle className="h-3 w-3" />High</Badge>
    case 'medium':
      return <Badge className="bg-amber-500 gap-1"><Info className="h-3 w-3" />Medium</Badge>
    case 'low':
      return <Badge variant="secondary" className="gap-1"><Info className="h-3 w-3" />Low</Badge>
    default:
      return <Badge variant="secondary">{severity}</Badge>
  }
}

// Status badge helper
function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'new':
      return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">New</Badge>
    case 'analyzing':
      return <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200 gap-1"><Loader2 className="h-3 w-3 animate-spin" />Analyzing</Badge>
    case 'assigned':
      return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1"><Bot className="h-3 w-3" />Assigned</Badge>
    case 'rejected':
      return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">Rejected</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

// Source icon helper
function SourceIcon({ source }: { source: string }) {
  switch (source) {
    case 'email':
      return <Mail className="h-4 w-4" />
    case 'slack':
      return <MessageSquare className="h-4 w-4" />
    case 'form':
      return <FileCode className="h-4 w-4" />
    case 'manual':
      return <User className="h-4 w-4" />
    default:
      return <Bug className="h-4 w-4" />
  }
}

// AI Analysis panel
function AIAnalysisPanel({ analysis }: { analysis: typeof mockBugs[0]['aiAnalysis'] }) {
  if (!analysis) {
    return (
      <div className="p-4 rounded-lg border border-dashed text-center">
        <Brain className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Analysis pending...</p>
        <Button variant="outline" size="sm" className="mt-2">
          <Sparkles className="h-4 w-4 mr-1" />
          Analyze Now
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-500" />
          <span className="font-medium">AI Analysis</span>
        </div>
        <Badge variant="outline" className={analysis.confidence > 80 ? 'text-green-600' : analysis.confidence > 60 ? 'text-amber-600' : 'text-red-600'}>
          {analysis.confidence}% confidence
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-muted-foreground">Category</p>
          <p className="font-medium">{analysis.category}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Complexity</p>
          <Badge variant="secondary" className="capitalize">{analysis.estimatedComplexity}</Badge>
        </div>
      </div>

      <div>
        <p className="text-xs text-muted-foreground mb-2">Suggested Files</p>
        <div className="space-y-1">
          {analysis.suggestedFiles.map((file, i) => (
            <div key={i} className="flex items-center gap-2 text-sm p-1.5 rounded bg-muted/50">
              <FileCode className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="truncate font-mono text-xs">{file}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={`flex items-center gap-2 p-3 rounded-lg ${analysis.canAutoFix ? 'bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900' : 'bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900'}`}>
        {analysis.canAutoFix ? (
          <>
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <div>
              <p className="font-medium text-green-700 dark:text-green-300">Can Auto-Fix</p>
              <p className="text-xs text-green-600 dark:text-green-400">Bug Bot can likely fix this automatically</p>
            </div>
          </>
        ) : (
          <>
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <div>
              <p className="font-medium text-amber-700 dark:text-amber-300">Manual Review Needed</p>
              <p className="text-xs text-amber-600 dark:text-amber-400">This bug requires human intervention</p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// Bug detail sheet
function BugDetailSheet({ bug, open, onClose }: {
  bug: typeof mockBugs[0] | null,
  open: boolean,
  onClose: () => void
}) {
  if (!bug) return null

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-[500px] sm:max-w-[500px] overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <SeverityBadge severity={bug.severity} />
            <StatusBadge status={bug.status} />
          </div>
          <SheetTitle className="text-left">{bug.title}</SheetTitle>
          <SheetDescription className="text-left">{bug.description}</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Actions */}
          <div className="flex gap-2">
            {bug.aiAnalysis?.canAutoFix && bug.status !== 'assigned' && (
              <Button className="flex-1 gap-1">
                <Bot className="h-4 w-4" />
                Assign to Bug Bot
              </Button>
            )}
            <Button variant="outline" className="flex-1">
              <User className="h-4 w-4 mr-1" />
              Assign to Human
            </Button>
          </div>

          <Separator />

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Source</p>
              <div className="flex items-center gap-2 mt-1">
                <SourceIcon source={bug.source} />
                <span className="capitalize">{bug.source}</span>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Repository</p>
              <div className="flex items-center gap-2 mt-1">
                <GitBranch className="h-4 w-4" />
                <span>{bug.repo}</span>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Reporter</p>
              <div className="flex items-center gap-2 mt-1">
                <Avatar className="h-5 w-5">
                  <AvatarFallback className="text-[10px]">
                    {bug.reporter.name.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <span>{bug.reporter.name}</span>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Reported</p>
              <div className="flex items-center gap-2 mt-1">
                <Clock className="h-4 w-4" />
                <span>{bug.createdAt}</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* AI Analysis */}
          <AIAnalysisPanel analysis={bug.aiAnalysis} />

          {bug.rejectionReason && (
            <>
              <Separator />
              <div className="p-3 rounded-lg bg-muted">
                <p className="text-sm font-medium mb-1">Rejection Reason</p>
                <p className="text-sm text-muted-foreground">{bug.rejectionReason}</p>
              </div>
            </>
          )}

          <Separator />

          {/* Actions footer */}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1">
              <Link2 className="h-4 w-4 mr-1" />
              Link to Task
            </Button>
            <Button variant="outline" className="text-destructive hover:text-destructive">
              <XCircle className="h-4 w-4 mr-1" />
              Reject
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// Submit bug form
function SubmitBugSheet({ open, onClose }: { open: boolean, onClose: () => void }) {
  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-[500px] sm:max-w-[500px]">
        <SheetHeader>
          <SheetTitle>Submit Bug Report</SheetTitle>
          <SheetDescription>Report a new bug for analysis</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div>
            <Label>Title</Label>
            <Input placeholder="Brief description of the bug..." className="mt-1" />
          </div>

          <div>
            <Label>Description</Label>
            <Textarea
              placeholder="Detailed description, steps to reproduce, expected vs actual behavior..."
              className="mt-1 min-h-[120px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Severity</Label>
              <Select defaultValue="medium">
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Repository</Label>
              <Select defaultValue="place-to-stand-portal">
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="place-to-stand-portal">place-to-stand-portal</SelectItem>
                  <SelectItem value="marketing-site">marketing-site</SelectItem>
                  <SelectItem value="api-gateway">api-gateway</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Related Files (Optional)</Label>
            <Input placeholder="e.g., lib/auth/middleware.ts" className="mt-1" />
          </div>

          <div className="flex items-center gap-2 p-3 rounded-lg bg-violet-500/10 border border-violet-500/20">
            <Sparkles className="h-4 w-4 text-violet-500" />
            <p className="text-sm">AI will analyze this bug after submission</p>
          </div>

          <div className="flex gap-2 pt-4">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button className="flex-1">
              <Bug className="h-4 w-4 mr-2" />
              Submit Bug
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// Main bug intake page
export default function BugIntakeWireframePage() {
  const [selectedBug, setSelectedBug] = useState<typeof mockBugs[0] | null>(null)
  const [showSubmit, setShowSubmit] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')

  const filteredBugs = statusFilter === 'all'
    ? mockBugs
    : mockBugs.filter(b => b.status === statusFilter)

  return (
    <TooltipProvider>
      <>
        <AppShellHeader>
          <div className="flex items-center justify-between w-full">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Bug Intake</h1>
              <p className="text-muted-foreground text-sm">
                {mockBugs.filter(b => b.status === 'new').length} new · {mockBugs.filter(b => b.status === 'analyzing').length} analyzing
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Check Sources
              </Button>
              <Button onClick={() => setShowSubmit(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Submit Bug
              </Button>
            </div>
          </div>
        </AppShellHeader>

        <div className="p-6">
          {/* Filters */}
          <div className="flex items-center gap-4 mb-6">
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
                <SelectItem value="rejected">Rejected</SelectItem>
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
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Bug list */}
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40%]">Bug</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>AI Confidence</TableHead>
                  <TableHead>Reported</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBugs.map(bug => (
                  <TableRow
                    key={bug.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedBug(bug)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <SourceIcon source={bug.source} />
                        <div className="min-w-0">
                          <p className="font-medium truncate">{bug.title}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <GitBranch className="h-3 w-3" />
                            {bug.repo}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <SeverityBadge severity={bug.severity} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={bug.status} />
                    </TableCell>
                    <TableCell>
                      {bug.aiAnalysis ? (
                        <div className="flex items-center gap-2">
                          <Progress value={bug.aiAnalysis.confidence} className="w-16 h-2" />
                          <span className="text-sm">{bug.aiAnalysis.confidence}%</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{bug.createdAt}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Eye className="h-4 w-4 mr-2" />
                            View details
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Bot className="h-4 w-4 mr-2" />
                            Assign to Bug Bot
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <User className="h-4 w-4 mr-2" />
                            Assign to human
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive">
                            <XCircle className="h-4 w-4 mr-2" />
                            Reject
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>

        <BugDetailSheet bug={selectedBug} open={!!selectedBug} onClose={() => setSelectedBug(null)} />
        <SubmitBugSheet open={showSubmit} onClose={() => setShowSubmit(false)} />
      </>
    </TooltipProvider>
  )
}
