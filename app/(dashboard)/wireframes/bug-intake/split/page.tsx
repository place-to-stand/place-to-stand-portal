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
  Sparkles,
  Brain,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Bot,
  Loader2,
  Link2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

const mockBugs = [
  {
    id: '1',
    title: 'TypeScript compilation error in auth module',
    description: 'Getting TS2322 error when building the project. The auth middleware is throwing type errors after the recent update.',
    severity: 'high',
    status: 'new',
    source: 'email',
    reporter: { name: 'Damon Bodine', email: 'damon@example.com', initials: 'DB' },
    repo: 'place-to-stand-portal',
    createdAt: '15 minutes ago',
    aiAnalysis: {
      confidence: 87,
      category: 'Type Error',
      suggestedFiles: ['lib/auth/middleware.ts', 'lib/auth/session.ts'],
      complexity: 'low',
      canAutoFix: true,
    },
  },
  {
    id: '2',
    title: 'N+1 query causing slow page loads',
    description: 'The projects page takes 5+ seconds to load when there are many projects.',
    severity: 'medium',
    status: 'analyzing',
    source: 'slack',
    reporter: { name: 'Team Member', email: 'team@example.com', initials: 'TM' },
    repo: 'place-to-stand-portal',
    createdAt: '1 hour ago',
    aiAnalysis: {
      confidence: 72,
      category: 'Performance',
      suggestedFiles: ['lib/queries/projects.ts'],
      complexity: 'medium',
      canAutoFix: true,
    },
  },
  {
    id: '3',
    title: 'Button click not working on mobile Safari',
    description: 'The Submit button doesn\'t respond to taps on iOS Safari.',
    severity: 'medium',
    status: 'new',
    source: 'form',
    reporter: { name: 'User Report', email: 'user@example.com', initials: 'UR' },
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
    reporter: { name: 'Damon Bodine', email: 'damon@example.com', initials: 'DB' },
    repo: 'place-to-stand-portal',
    createdAt: '3 hours ago',
    aiAnalysis: {
      confidence: 95,
      category: 'Integration',
      suggestedFiles: ['lib/email/send.ts'],
      complexity: 'medium',
      canAutoFix: true,
    },
  },
]

function SeverityIcon({ severity }: { severity: string }) {
  switch (severity) {
    case 'critical': return <AlertCircle className="h-4 w-4 text-red-500" />
    case 'high': return <AlertTriangle className="h-4 w-4 text-orange-500" />
    case 'medium': return <Info className="h-4 w-4 text-amber-500" />
    default: return <Info className="h-4 w-4 text-muted-foreground" />
  }
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'new':
      return <Badge variant="outline" className="text-blue-600 border-blue-200">New</Badge>
    case 'analyzing':
      return <Badge variant="outline" className="text-violet-600 border-violet-200 gap-1"><Loader2 className="h-3 w-3 animate-spin" />Analyzing</Badge>
    case 'assigned':
      return <Badge variant="outline" className="text-green-600 border-green-200 gap-1"><Bot className="h-3 w-3" />Assigned</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
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

export default function BugIntakeSplitPage() {
  const [selectedBug, setSelectedBug] = useState<typeof mockBugs[0] | null>(mockBugs[0])
  const [statusFilter, setStatusFilter] = useState('all')

  const filteredBugs = statusFilter === 'all'
    ? mockBugs
    : mockBugs.filter(b => b.status === statusFilter)

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Left - Bug List */}
      <div className="w-96 border-r flex flex-col bg-muted/20">
        <div className="p-3 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bug className="h-5 w-5 text-violet-500" />
            <span className="font-semibold">Bug Intake</span>
          </div>
          <Button size="sm"><Plus className="h-4 w-4" /></Button>
        </div>

        <div className="p-3 border-b flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search..." className="pl-8 h-8" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-28 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="analyzing">Analyzing</SelectItem>
              <SelectItem value="assigned">Assigned</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {filteredBugs.map(bug => (
              <button
                key={bug.id}
                className={cn(
                  'w-full p-3 rounded-lg text-left transition-colors',
                  selectedBug?.id === bug.id
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted'
                )}
                onClick={() => setSelectedBug(bug)}
              >
                <div className="flex items-center gap-2 mb-1">
                  <SeverityIcon severity={bug.severity} />
                  <StatusBadge status={bug.status} />
                </div>
                <p className="text-sm font-medium line-clamp-2">{bug.title}</p>
                <div className="flex items-center justify-between mt-2 text-xs opacity-70">
                  <span>{bug.repo}</span>
                  <span>{bug.createdAt}</span>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Right - Bug Detail */}
      <div className="flex-1 flex flex-col">
        {selectedBug ? (
          <>
            <div className="p-4 border-b flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <SeverityIcon severity={selectedBug.severity} />
                  <Badge className={cn(
                    selectedBug.severity === 'critical' && 'bg-red-500',
                    selectedBug.severity === 'high' && 'bg-orange-500',
                    selectedBug.severity === 'medium' && 'bg-amber-500'
                  )}>{selectedBug.severity}</Badge>
                  <StatusBadge status={selectedBug.status} />
                </div>
                <h2 className="text-lg font-semibold">{selectedBug.title}</h2>
              </div>
            </div>

            <ScrollArea className="flex-1 p-4">
              <div className="space-y-6 max-w-2xl">
                {/* Description */}
                <div>
                  <h3 className="text-sm font-medium mb-2">Description</h3>
                  <p className="text-muted-foreground">{selectedBug.description}</p>
                </div>

                {/* Metadata */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Source</p>
                    <div className="flex items-center gap-2">
                      <SourceIcon source={selectedBug.source} />
                      <span className="capitalize">{selectedBug.source}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Repository</p>
                    <div className="flex items-center gap-2">
                      <GitBranch className="h-4 w-4" />
                      {selectedBug.repo}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Reporter</p>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-5 w-5">
                        <AvatarFallback className="text-[10px]">{selectedBug.reporter.initials}</AvatarFallback>
                      </Avatar>
                      {selectedBug.reporter.name}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Reported</p>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      {selectedBug.createdAt}
                    </div>
                  </div>
                </div>

                <Separator />

                {/* AI Analysis */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="h-4 w-4 text-violet-500" />
                    <h3 className="text-sm font-medium">AI Analysis</h3>
                  </div>
                  {selectedBug.aiAnalysis ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Confidence</span>
                        <div className="flex items-center gap-2">
                          <Progress value={selectedBug.aiAnalysis.confidence} className="w-24 h-2" />
                          <span className="font-medium">{selectedBug.aiAnalysis.confidence}%</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Category</p>
                          <p className="font-medium">{selectedBug.aiAnalysis.category}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Complexity</p>
                          <Badge variant="secondary" className="capitalize">{selectedBug.aiAnalysis.complexity}</Badge>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">Suggested Files</p>
                        <div className="space-y-1">
                          {selectedBug.aiAnalysis.suggestedFiles.map((file, i) => (
                            <div key={i} className="flex items-center gap-2 p-2 rounded bg-muted/50 text-sm font-mono">
                              <FileCode className="h-4 w-4 text-muted-foreground" />
                              {file}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className={cn(
                        'p-3 rounded-lg',
                        selectedBug.aiAnalysis.canAutoFix
                          ? 'bg-green-50 dark:bg-green-950/20 border border-green-200'
                          : 'bg-amber-50 dark:bg-amber-950/20 border border-amber-200'
                      )}>
                        <div className="flex items-center gap-2">
                          {selectedBug.aiAnalysis.canAutoFix ? (
                            <>
                              <CheckCircle2 className="h-5 w-5 text-green-500" />
                              <div>
                                <p className="font-medium text-green-700">Can Auto-Fix</p>
                                <p className="text-xs text-green-600">Bug Bot can likely fix this</p>
                              </div>
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="h-5 w-5 text-amber-500" />
                              <div>
                                <p className="font-medium text-amber-700">Manual Review</p>
                                <p className="text-xs text-amber-600">Requires human intervention</p>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 text-center border border-dashed rounded-lg">
                      <Brain className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-muted-foreground">Analysis pending...</p>
                      <Button variant="outline" size="sm" className="mt-2">
                        <Sparkles className="h-4 w-4 mr-1" />
                        Analyze Now
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>

            {/* Actions */}
            <div className="p-4 border-t flex gap-2">
              {selectedBug.aiAnalysis?.canAutoFix && selectedBug.status !== 'assigned' && (
                <Button className="flex-1">
                  <Bot className="h-4 w-4 mr-2" />
                  Assign to Bug Bot
                </Button>
              )}
              <Button variant="outline" className="flex-1">
                <User className="h-4 w-4 mr-2" />
                Assign to Human
              </Button>
              <Button variant="outline">
                <Link2 className="h-4 w-4 mr-2" />
                Link Task
              </Button>
              <Button variant="outline" className="text-destructive">
                <XCircle className="h-4 w-4" />
              </Button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Bug className="h-12 w-12 mx-auto mb-2 opacity-30" />
              <p>Select a bug to view details</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
