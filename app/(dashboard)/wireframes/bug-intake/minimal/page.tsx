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
  Plus,
  Sparkles,
  Brain,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Bot,
  Loader2,
  ArrowLeft,
  ChevronRight,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
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
    createdAt: '15 min ago',
    aiAnalysis: {
      confidence: 87,
      category: 'Type Error',
      suggestedFiles: ['lib/auth/middleware.ts', 'lib/auth/session.ts'],
      canAutoFix: true,
    },
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
    aiAnalysis: {
      confidence: 72,
      category: 'Performance',
      suggestedFiles: ['lib/queries/projects.ts'],
      canAutoFix: true,
    },
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
    aiAnalysis: {
      confidence: 95,
      category: 'Integration',
      suggestedFiles: ['lib/email/send.ts'],
      canAutoFix: true,
    },
  },
]

const stats = { new: 2, analyzing: 1, assigned: 1 }

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

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'new': return <div className="h-2 w-2 rounded-full bg-blue-500" />
    case 'analyzing': return <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
    case 'assigned': return <Bot className="h-4 w-4 text-green-500" />
    default: return null
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

export default function BugIntakeMinimalPage() {
  const [view, setView] = useState<'list' | 'detail'>('list')
  const [selectedBug, setSelectedBug] = useState<typeof mockBugs[0] | null>(null)

  const selectBug = (bug: typeof mockBugs[0]) => {
    setSelectedBug(bug)
    setView('detail')
  }

  if (view === 'detail' && selectedBug) {
    return (
      <div className="h-[calc(100vh-4rem)] bg-muted/30">
        <div className="max-w-lg mx-auto h-full flex flex-col bg-white dark:bg-neutral-900">
          {/* Header */}
          <div className="p-4 flex items-center gap-3 border-b">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={() => { setView('list'); setSelectedBug(null) }}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <p className="font-semibold">Bug Details</p>
              <p className="text-xs text-muted-foreground">{selectedBug.repo}</p>
            </div>
            <SeverityBadge severity={selectedBug.severity} />
          </div>

          <ScrollArea className="flex-1">
            <div className="p-4 space-y-6">
              {/* Title & Description */}
              <div>
                <h2 className="text-lg font-semibold mb-2">{selectedBug.title}</h2>
                <p className="text-muted-foreground">{selectedBug.description}</p>
              </div>

              {/* Metadata */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-xl bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1">Source</p>
                  <div className="flex items-center gap-2">
                    <SourceIcon source={selectedBug.source} />
                    <span className="capitalize">{selectedBug.source}</span>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1">Reporter</p>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-5 w-5">
                      <AvatarFallback className="text-[10px]">{selectedBug.reporter.initials}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{selectedBug.reporter.name}</span>
                  </div>
                </div>
              </div>

              {/* AI Analysis */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4 text-violet-500" />
                  <span className="font-medium">AI Analysis</span>
                </div>
                {selectedBug.aiAnalysis ? (
                  <div className="space-y-4">
                    <div className="p-4 rounded-2xl bg-violet-50 dark:bg-violet-950/30">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{selectedBug.aiAnalysis.category}</span>
                        <span className="text-xl font-bold text-violet-600">{selectedBug.aiAnalysis.confidence}%</span>
                      </div>
                      <Progress value={selectedBug.aiAnalysis.confidence} className="h-2" />
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Suggested Files</p>
                      <div className="space-y-2">
                        {selectedBug.aiAnalysis.suggestedFiles.map((file, i) => (
                          <div key={i} className="p-3 rounded-xl bg-muted/50 flex items-center gap-2">
                            <FileCode className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-mono">{file}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {selectedBug.aiAnalysis.canAutoFix && (
                      <div className="p-4 rounded-2xl bg-green-50 dark:bg-green-950/30 flex items-center gap-3">
                        <CheckCircle2 className="h-6 w-6 text-green-500" />
                        <div>
                          <p className="font-medium text-green-700">Can Auto-Fix</p>
                          <p className="text-xs text-green-600">Bug Bot can handle this</p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-6 rounded-2xl border border-dashed text-center">
                    <Brain className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-muted-foreground mb-3">Analysis pending</p>
                    <Button variant="outline" className="rounded-xl">
                      <Sparkles className="h-4 w-4 mr-2" />
                      Analyze Now
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>

          {/* Actions */}
          <div className="p-4 border-t space-y-2">
            {selectedBug.aiAnalysis?.canAutoFix && selectedBug.status !== 'assigned' && (
              <Button className="w-full rounded-xl">
                <Bot className="h-4 w-4 mr-2" />
                Assign to Bug Bot
              </Button>
            )}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 rounded-xl">
                <User className="h-4 w-4 mr-2" />
                Assign Human
              </Button>
              <Button variant="outline" className="rounded-xl text-destructive">
                <XCircle className="h-4 w-4" />
              </Button>
            </div>
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
            <div>
              <h1 className="text-xl font-bold">Bug Intake</h1>
              <p className="text-sm text-muted-foreground">Manage incoming bugs</p>
            </div>
            <Button size="sm" className="rounded-xl">
              <Plus className="h-4 w-4 mr-1" />
              New
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="px-4 py-3 border-b">
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center p-2 rounded-xl bg-blue-50 dark:bg-blue-950/30">
              <p className="text-lg font-bold text-blue-700">{stats.new}</p>
              <p className="text-[10px] text-muted-foreground">New</p>
            </div>
            <div className="text-center p-2 rounded-xl bg-violet-50 dark:bg-violet-950/30">
              <p className="text-lg font-bold text-violet-700">{stats.analyzing}</p>
              <p className="text-[10px] text-muted-foreground">Analyzing</p>
            </div>
            <div className="text-center p-2 rounded-xl bg-green-50 dark:bg-green-950/30">
              <p className="text-lg font-bold text-green-700">{stats.assigned}</p>
              <p className="text-[10px] text-muted-foreground">Assigned</p>
            </div>
          </div>
        </div>

        {/* Bug List */}
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-3">
            {mockBugs.map(bug => (
              <button
                key={bug.id}
                className="w-full p-4 rounded-2xl bg-muted/50 text-left hover:bg-muted transition-colors"
                onClick={() => selectBug(bug)}
              >
                <div className="flex items-start gap-3">
                  <StatusIcon status={bug.status} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <SeverityBadge severity={bug.severity} />
                    </div>
                    <p className="font-medium text-sm line-clamp-2">{bug.title}</p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                      <span>{bug.repo}</span>
                      <span>·</span>
                      <span>{bug.createdAt}</span>
                    </div>
                    {bug.aiAnalysis && (
                      <div className="flex items-center gap-2 mt-2">
                        <Progress value={bug.aiAnalysis.confidence} className="w-16 h-1" />
                        <span className="text-xs">{bug.aiAnalysis.confidence}%</span>
                        {bug.aiAnalysis.canAutoFix && (
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                        )}
                      </div>
                    )}
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
