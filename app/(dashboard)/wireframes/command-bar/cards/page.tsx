'use client'

import { useState, useEffect } from 'react'
import {
  Command,
  Sparkles,
  Mail,
  Calendar,
  FileText,
  User,
  Building2,
  Folder,
  CheckCircle2,
  Clock,
  Plus,
  ArrowRight,
  MessageSquare,
  Target,
  ChevronRight,
  Loader2,
  Bot,
  Mic,
  X,
  History,
  Zap,
  Video,
  Send,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

const commandCategories = [
  {
    id: 'email',
    name: 'Email',
    icon: Mail,
    color: 'bg-blue-500',
    commands: [
      'Send follow-up to Sarah about proposal',
      'Reply to all unread emails',
      'Draft email to TechStart team',
    ],
  },
  {
    id: 'calendar',
    name: 'Calendar',
    icon: Calendar,
    color: 'bg-green-500',
    commands: [
      'Schedule meeting with client',
      'Block focus time tomorrow',
      'Show my schedule for next week',
    ],
  },
  {
    id: 'tasks',
    name: 'Tasks',
    icon: CheckCircle2,
    color: 'bg-amber-500',
    commands: [
      'Create task to review docs',
      'Show my blocked tasks',
      'Move all backlog to on deck',
    ],
  },
  {
    id: 'crm',
    name: 'CRM',
    icon: Target,
    color: 'bg-red-500',
    commands: [
      'What\'s the pipeline value?',
      'Show hot leads',
      'Update Acme deal status',
    ],
  },
  {
    id: 'documents',
    name: 'Documents',
    icon: FileText,
    color: 'bg-purple-500',
    commands: [
      'Generate proposal for TechStart',
      'Create meeting notes',
      'Find Q4 report',
    ],
  },
  {
    id: 'search',
    name: 'Search',
    icon: MessageSquare,
    color: 'bg-cyan-500',
    commands: [
      'Find emails about budget',
      'Search tasks containing API',
      'Who is Sarah Chen?',
    ],
  },
]

const recentCommands = [
  { query: "Email Sarah about the timeline", result: 'Draft created', time: '2 hours ago' },
  { query: "Show hot leads", result: '5 leads found', time: '3 hours ago' },
  { query: "Schedule standup for tomorrow", result: 'Meeting created', time: 'Yesterday' },
]

const suggestedActions = [
  { icon: Mail, label: '3 emails need follow-up', action: 'View emails' },
  { icon: Calendar, label: 'Meeting in 30 minutes', action: 'Join call' },
  { icon: CheckCircle2, label: '2 tasks due today', action: 'View tasks' },
]

function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [processing, setProcessing] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  const handleSubmit = () => {
    if (!query.trim()) return
    setProcessing(true)
    setTimeout(() => {
      setProcessing(false)
      // Show result
    }, 1500)
  }

  const category = commandCategories.find(c => c.id === selectedCategory)

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl p-0 gap-0">
        {/* Search input */}
        <div className="flex items-center gap-3 p-4 border-b">
          <Sparkles className="h-5 w-5 text-violet-500 shrink-0" />
          <input
            type="text"
            placeholder="What would you like to do?"
            className="flex-1 bg-transparent outline-none text-lg"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            autoFocus
          />
          <Button variant="ghost" size="icon">
            <Mic className="h-5 w-5" />
          </Button>
          {query && (
            <Button variant="ghost" size="icon" onClick={() => setQuery('')}>
              <X className="h-5 w-5" />
            </Button>
          )}
        </div>

        <ScrollArea className="max-h-[60vh]">
          <div className="p-4">
            {processing ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <Loader2 className="h-10 w-10 animate-spin text-violet-500 mx-auto mb-3" />
                  <p className="font-medium">Processing your request...</p>
                  <p className="text-sm text-muted-foreground">This usually takes a few seconds</p>
                </div>
              </div>
            ) : selectedCategory && category ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setSelectedCategory(null)}>
                    <ArrowRight className="h-4 w-4 rotate-180 mr-1" />
                    Back
                  </Button>
                  <div className={cn('p-2 rounded-lg', category.color)}>
                    <category.icon className="h-4 w-4 text-white" />
                  </div>
                  <span className="font-semibold">{category.name} Commands</span>
                </div>
                <div className="space-y-2">
                  {category.commands.map((cmd, i) => (
                    <button
                      key={i}
                      className="flex items-center gap-3 w-full p-3 rounded-lg border hover:bg-muted text-left"
                      onClick={() => { setQuery(cmd); setSelectedCategory(null) }}
                    >
                      <Sparkles className="h-4 w-4 text-violet-500" />
                      <span className="flex-1">&quot;{cmd}&quot;</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Suggested actions */}
                {suggestedActions.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-3">SUGGESTED</p>
                    <div className="space-y-2">
                      {suggestedActions.map((item, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200">
                          <item.icon className="h-5 w-5 text-amber-600" />
                          <span className="flex-1">{item.label}</span>
                          <Button size="sm" variant="outline">{item.action}</Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Categories */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-3">COMMAND CATEGORIES</p>
                  <div className="grid grid-cols-3 gap-3">
                    {commandCategories.map((cat) => (
                      <Card
                        key={cat.id}
                        className="cursor-pointer hover:border-primary/50 transition-colors"
                        onClick={() => setSelectedCategory(cat.id)}
                      >
                        <CardContent className="p-4">
                          <div className={cn('p-2 rounded-lg w-fit mb-3', cat.color)}>
                            <cat.icon className="h-5 w-5 text-white" />
                          </div>
                          <p className="font-medium">{cat.name}</p>
                          <p className="text-xs text-muted-foreground">{cat.commands.length} commands</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                {/* Recent */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-3">RECENT COMMANDS</p>
                  <div className="space-y-2">
                    {recentCommands.map((cmd, i) => (
                      <button
                        key={i}
                        className="flex items-center gap-3 w-full p-3 rounded-lg hover:bg-muted text-left"
                        onClick={() => setQuery(cmd.query)}
                      >
                        <History className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{cmd.query}</p>
                          <p className="text-xs text-muted-foreground">{cmd.result}</p>
                        </div>
                        <span className="text-xs text-muted-foreground">{cmd.time}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="flex items-center justify-between p-3 border-t bg-muted/30">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono">↵</kbd>
              submit
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono">esc</kbd>
              close
            </span>
          </div>
          <Badge variant="outline" className="gap-1">
            <Bot className="h-3 w-3" />
            AI Powered
          </Badge>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function CommandBarCardsPage() {
  const [showPalette, setShowPalette] = useState(false)

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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">AI Command Bar</h1>
            <p className="text-muted-foreground">Natural language interface</p>
          </div>
        </div>
        <Button onClick={() => setShowPalette(true)}>
          <Command className="h-4 w-4 mr-2" />
          Open Command Bar
          <kbd className="ml-2 px-1.5 py-0.5 rounded bg-primary-foreground/20 text-xs">⌘K</kbd>
        </Button>
      </div>

      {/* Hero */}
      <Card className="bg-gradient-to-br from-violet-500/10 to-purple-500/10 border-violet-200">
        <CardContent className="p-8 text-center">
          <h2 className="text-2xl font-bold mb-2">What would you like to do?</h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Just type naturally. Schedule meetings, send emails, create tasks, and more.
          </p>
          <Button
            size="lg"
            className="rounded-xl"
            onClick={() => setShowPalette(true)}
          >
            <Sparkles className="h-5 w-5 mr-2" />
            Try It Now
          </Button>
        </CardContent>
      </Card>

      {/* Categories Grid */}
      <div>
        <h3 className="font-semibold mb-4">Command Categories</h3>
        <div className="grid grid-cols-3 gap-4">
          {commandCategories.map((cat) => (
            <Card key={cat.id} className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => setShowPalette(true)}>
              <CardContent className="p-6">
                <div className={cn('p-3 rounded-xl w-fit mb-4', cat.color)}>
                  <cat.icon className="h-6 w-6 text-white" />
                </div>
                <h4 className="font-semibold mb-1">{cat.name}</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  {cat.commands[0]}...
                </p>
                <Badge variant="secondary">{cat.commands.length} commands</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Recent */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Commands</CardTitle>
          <CardDescription>Your command history</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentCommands.map((cmd, i) => (
              <div key={i} className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                <History className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="font-medium">{cmd.query}</p>
                  <p className="text-sm text-muted-foreground">{cmd.result}</p>
                </div>
                <span className="text-sm text-muted-foreground">{cmd.time}</span>
                <Button variant="outline" size="sm">Run Again</Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <CommandPalette open={showPalette} onClose={() => setShowPalette(false)} />
    </div>
  )
}
