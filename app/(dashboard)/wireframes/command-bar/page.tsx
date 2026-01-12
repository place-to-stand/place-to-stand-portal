'use client'

import { useState, useEffect } from 'react'
import {
  Command,
  Search,
  Sparkles,
  Mail,
  Calendar,
  FileText,
  User,
  Building2,
  Folder,
  CheckCircle2,
  Clock,
  Send,
  Video,
  Plus,
  ArrowRight,
  Zap,
  MessageSquare,
  Target,
  ChevronRight,
  Loader2,
  Bot,
  Mic,
  MicOff,
  X,
  CornerDownLeft,
  History,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import { AppShellHeader } from '@/components/layout/app-shell'

// Example commands
const exampleCommands = [
  {
    query: "Schedule a call with Sarah Chen for next Tuesday",
    intent: 'schedule_meeting',
    entities: { contact: 'Sarah Chen', date: 'next Tuesday' },
    actions: [
      { type: 'find_contact', result: 'Found: Sarah Chen (sarah@techstart.io)' },
      { type: 'check_availability', result: 'Tuesday 10am, 2pm, 4pm available' },
      { type: 'suggest_action', result: 'Create meeting invite?' },
    ],
  },
  {
    query: "Send follow-up to TechStart about the proposal",
    intent: 'send_email',
    entities: { client: 'TechStart', context: 'proposal' },
    actions: [
      { type: 'find_context', result: 'Found: Proposal sent Jan 9, awaiting response' },
      { type: 'draft_email', result: 'Draft generated based on conversation history' },
      { type: 'suggest_action', result: 'Review and send email?' },
    ],
  },
  {
    query: "What's the status of the Acme Corp project?",
    intent: 'query_status',
    entities: { project: 'Acme Corp' },
    actions: [
      { type: 'find_project', result: 'Found: Acme Corp Website Redesign' },
      { type: 'get_status', result: '65% complete, 3 tasks in progress, 2 blocked' },
      { type: 'show_result', result: null },
    ],
  },
  {
    query: "Create a task to review the API documentation",
    intent: 'create_task',
    entities: { task: 'review API documentation' },
    actions: [
      { type: 'suggest_project', result: 'Assign to: PTS Portal (Internal)?' },
      { type: 'create_task', result: 'Task created in backlog' },
    ],
  },
]

// Recent commands
const recentCommands = [
  { query: "Email Sarah about the timeline", time: '2 hours ago' },
  { query: "Show hot leads", time: '3 hours ago' },
  { query: "Schedule standup for tomorrow", time: 'Yesterday' },
]

// Quick actions
const quickActions = [
  { icon: Mail, label: 'Compose email', shortcut: 'E' },
  { icon: Calendar, label: 'Schedule meeting', shortcut: 'M' },
  { icon: Plus, label: 'Create task', shortcut: 'T' },
  { icon: Target, label: 'Add lead', shortcut: 'L' },
  { icon: FileText, label: 'Generate document', shortcut: 'D' },
]

// Command result component
function CommandResult({ command }: { command: typeof exampleCommands[0] }) {
  const [currentStep, setCurrentStep] = useState(0)
  const [complete, setComplete] = useState(false)

  useEffect(() => {
    if (currentStep < command.actions.length) {
      const timer = setTimeout(() => {
        setCurrentStep(prev => prev + 1)
      }, 800)
      return () => clearTimeout(timer)
    } else {
      setComplete(true)
    }
  }, [currentStep, command.actions.length])

  return (
    <div className="space-y-4">
      {/* Query display */}
      <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
        <Avatar className="h-8 w-8">
          <AvatarFallback>U</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <p className="font-medium">{command.query}</p>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="text-xs">
              Intent: {command.intent.replace('_', ' ')}
            </Badge>
            {Object.entries(command.entities).map(([key, value]) => (
              <Badge key={key} variant="secondary" className="text-xs">
                {key}: {value}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      {/* Processing steps */}
      <div className="space-y-2 ml-11">
        {command.actions.map((action, i) => (
          <div
            key={i}
            className={`flex items-center gap-3 p-2 rounded-md transition-all ${
              i < currentStep
                ? 'opacity-100'
                : i === currentStep
                  ? 'opacity-100 bg-violet-500/10'
                  : 'opacity-30'
            }`}
          >
            {i < currentStep ? (
              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
            ) : i === currentStep ? (
              <Loader2 className="h-4 w-4 text-violet-500 animate-spin shrink-0" />
            ) : (
              <div className="h-4 w-4 rounded-full border-2 border-muted shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium capitalize">{action.type.replace('_', ' ')}</p>
              {action.result && i <= currentStep && (
                <p className="text-xs text-muted-foreground">{action.result}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      {complete && (
        <div className="flex gap-2 ml-11 pt-2">
          <Button size="sm" className="gap-1">
            <CheckCircle2 className="h-4 w-4" />
            Confirm
          </Button>
          <Button variant="outline" size="sm">
            Modify
          </Button>
          <Button variant="ghost" size="sm">
            Cancel
          </Button>
        </div>
      )}
    </div>
  )
}

// Command palette dialog
function CommandPalette({ open, onClose }: { open: boolean, onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [processing, setProcessing] = useState(false)
  const [result, setResult] = useState<typeof exampleCommands[0] | null>(null)
  const [isListening, setIsListening] = useState(false)

  const handleSubmit = () => {
    if (!query.trim()) return
    setProcessing(true)

    // Find matching example or use first one
    const example = exampleCommands.find(c =>
      c.query.toLowerCase().includes(query.toLowerCase().split(' ')[0])
    ) || exampleCommands[0]

    setTimeout(() => {
      setProcessing(false)
      setResult({ ...example, query })
    }, 500)
  }

  const handleReset = () => {
    setQuery('')
    setResult(null)
    setProcessing(false)
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl p-0 gap-0">
        {/* Search input */}
        <div className="flex items-center gap-3 p-4 border-b">
          <Sparkles className="h-5 w-5 text-violet-500 shrink-0" />
          <input
            type="text"
            placeholder="Ask me anything... e.g., 'Schedule a call with Sarah'"
            className="flex-1 bg-transparent outline-none text-lg"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            autoFocus
          />
          <Button
            variant="ghost"
            size="icon"
            className={isListening ? 'text-red-500' : ''}
            onClick={() => setIsListening(!isListening)}
          >
            {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </Button>
          {query && (
            <Button variant="ghost" size="icon" onClick={handleReset}>
              <X className="h-5 w-5" />
            </Button>
          )}
        </div>

        {/* Content */}
        <ScrollArea className="max-h-[60vh]">
          <div className="p-4">
            {processing ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
              </div>
            ) : result ? (
              <CommandResult command={result} />
            ) : (
              <div className="space-y-6">
                {/* Quick actions */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">QUICK ACTIONS</p>
                  <div className="grid grid-cols-5 gap-2">
                    {quickActions.map((action) => (
                      <button
                        key={action.label}
                        className="flex flex-col items-center gap-2 p-3 rounded-lg border hover:bg-muted transition-colors"
                        onClick={() => setQuery(action.label)}
                      >
                        <action.icon className="h-5 w-5 text-muted-foreground" />
                        <span className="text-xs">{action.label}</span>
                        <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-muted font-mono">
                          ⌘{action.shortcut}
                        </kbd>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Recent commands */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">RECENT</p>
                  <div className="space-y-1">
                    {recentCommands.map((cmd, i) => (
                      <button
                        key={i}
                        className="flex items-center gap-3 w-full p-2 rounded-md hover:bg-muted text-left"
                        onClick={() => setQuery(cmd.query)}
                      >
                        <History className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="flex-1 text-sm">{cmd.query}</span>
                        <span className="text-xs text-muted-foreground">{cmd.time}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Examples */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">TRY SAYING</p>
                  <div className="space-y-1">
                    {exampleCommands.slice(0, 4).map((cmd, i) => (
                      <button
                        key={i}
                        className="flex items-center gap-3 w-full p-2 rounded-md hover:bg-muted text-left"
                        onClick={() => setQuery(cmd.query)}
                      >
                        <Sparkles className="h-4 w-4 text-violet-500 shrink-0" />
                        <span className="flex-1 text-sm">&quot;{cmd.query}&quot;</span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="flex items-center justify-between p-3 border-t bg-muted/30">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono">↵</kbd>
              to submit
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono">esc</kbd>
              to close
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-violet-500" />
            <span className="text-xs text-muted-foreground">Powered by AI</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Main demo page
export default function CommandBarWireframePage() {
  const [showPalette, setShowPalette] = useState(false)

  // Global keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setShowPalette(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <>
      <AppShellHeader>
        <div className="flex items-center justify-between w-full">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">AI Command Bar</h1>
            <p className="text-muted-foreground text-sm">
              Natural language interface for the portal
            </p>
          </div>
          <Button onClick={() => setShowPalette(true)}>
            <Command className="h-4 w-4 mr-2" />
            Open Command Bar
            <kbd className="ml-2 px-1.5 py-0.5 rounded bg-primary-foreground/20 text-xs font-mono">
              ⌘K
            </kbd>
          </Button>
        </div>
      </AppShellHeader>

      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          {/* Hero section */}
          <Card className="mb-8 bg-gradient-to-br from-violet-500/10 to-purple-500/10 border-violet-500/20">
            <CardContent className="p-8 text-center">
              <div className="flex justify-center mb-4">
                <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600">
                  <Sparkles className="h-8 w-8 text-white" />
                </div>
              </div>
              <h2 className="text-2xl font-bold mb-2">Natural Language Commands</h2>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Just tell the AI what you want to do. Schedule meetings, send emails, create tasks, and more using plain English.
              </p>
              <Button size="lg" onClick={() => setShowPalette(true)}>
                <Command className="h-5 w-5 mr-2" />
                Try It Now
              </Button>
            </CardContent>
          </Card>

          {/* Example commands */}
          <h3 className="font-semibold mb-4">Example Commands</h3>
          <div className="grid grid-cols-2 gap-4 mb-8">
            {exampleCommands.map((cmd, i) => (
              <Card key={i} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setShowPalette(true)}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-violet-500/10">
                      <Sparkles className="h-4 w-4 text-violet-500" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">&quot;{cmd.query}&quot;</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className="text-xs capitalize">
                          {cmd.intent.replace('_', ' ')}
                        </Badge>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {cmd.actions.length} steps
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Capabilities */}
          <h3 className="font-semibold mb-4">What You Can Do</h3>
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <Mail className="h-8 w-8 text-blue-500 mb-3" />
                <h4 className="font-medium mb-1">Email</h4>
                <p className="text-sm text-muted-foreground">
                  Send follow-ups, compose new emails, search conversations
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <Calendar className="h-8 w-8 text-green-500 mb-3" />
                <h4 className="font-medium mb-1">Calendar</h4>
                <p className="text-sm text-muted-foreground">
                  Schedule meetings, check availability, set reminders
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <CheckCircle2 className="h-8 w-8 text-amber-500 mb-3" />
                <h4 className="font-medium mb-1">Tasks</h4>
                <p className="text-sm text-muted-foreground">
                  Create tasks, update status, assign to team members
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <Target className="h-8 w-8 text-red-500 mb-3" />
                <h4 className="font-medium mb-1">CRM</h4>
                <p className="text-sm text-muted-foreground">
                  Query lead status, update deals, get pipeline summary
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <FileText className="h-8 w-8 text-purple-500 mb-3" />
                <h4 className="font-medium mb-1">Documents</h4>
                <p className="text-sm text-muted-foreground">
                  Generate proposals, create meeting notes, find files
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <MessageSquare className="h-8 w-8 text-cyan-500 mb-3" />
                <h4 className="font-medium mb-1">Search</h4>
                <p className="text-sm text-muted-foreground">
                  Find anything across email, tasks, projects, and contacts
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <CommandPalette open={showPalette} onClose={() => setShowPalette(false)} />
    </>
  )
}
