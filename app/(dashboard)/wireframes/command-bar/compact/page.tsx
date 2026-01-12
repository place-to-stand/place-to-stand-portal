'use client'

import { useState, useEffect } from 'react'
import {
  Command,
  Sparkles,
  Mail,
  Calendar,
  FileText,
  CheckCircle2,
  Clock,
  Plus,
  MessageSquare,
  Target,
  ChevronRight,
  Loader2,
  Bot,
  Mic,
  X,
  History,
  Send,
  ArrowRight,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

const quickActions = [
  { icon: Mail, label: 'Email', shortcut: 'E', color: 'text-blue-500' },
  { icon: Calendar, label: 'Meeting', shortcut: 'M', color: 'text-green-500' },
  { icon: Plus, label: 'Task', shortcut: 'T', color: 'text-amber-500' },
  { icon: Target, label: 'Lead', shortcut: 'L', color: 'text-red-500' },
  { icon: FileText, label: 'Doc', shortcut: 'D', color: 'text-purple-500' },
]

const recentCommands = [
  { query: "Email Sarah about the timeline", time: '2h ago' },
  { query: "Show hot leads", time: '3h ago' },
  { query: "Schedule standup for tomorrow", time: '1d ago' },
  { query: "Create task to review docs", time: '2d ago' },
]

const suggestions = [
  "Schedule a call with Sarah Chen",
  "Send follow-up to TechStart",
  "What's the status of Acme project?",
  "Create task for API review",
]

interface CommandResult {
  query: string
  steps: { name: string; status: 'complete' | 'running' | 'pending'; result?: string }[]
}

export default function CommandBarCompactPage() {
  const [query, setQuery] = useState('')
  const [processing, setProcessing] = useState(false)
  const [result, setResult] = useState<CommandResult | null>(null)
  const [focused, setFocused] = useState(false)

  const handleSubmit = () => {
    if (!query.trim()) return
    setProcessing(true)
    setResult(null)

    setTimeout(() => {
      setProcessing(false)
      setResult({
        query,
        steps: [
          { name: 'Parse intent', status: 'complete', result: 'schedule_meeting' },
          { name: 'Find entities', status: 'complete', result: 'Sarah Chen, next Tuesday' },
          { name: 'Check availability', status: 'complete', result: '10am, 2pm, 4pm available' },
          { name: 'Execute action', status: 'complete', result: 'Ready to create meeting' },
        ],
      })
    }, 2000)
  }

  const clearResult = () => {
    setQuery('')
    setResult(null)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header with inline command bar */}
      <div className="border-b px-4 py-3 bg-background">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-violet-500" />
            <span className="font-semibold">AI Commands</span>
          </div>

          <div className="flex-1 relative">
            <div className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg border transition-all',
              focused ? 'border-primary ring-2 ring-primary/20' : 'border-input'
            )}>
              <Sparkles className="h-4 w-4 text-violet-500" />
              <input
                type="text"
                placeholder="What would you like to do? (⌘K)"
                className="flex-1 bg-transparent outline-none text-sm"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setTimeout(() => setFocused(false), 200)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              />
              {query && (
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={clearResult}>
                  <X className="h-3 w-3" />
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <Mic className="h-4 w-4" />
              </Button>
              <Button size="sm" className="h-7" onClick={handleSubmit} disabled={!query.trim() || processing}>
                {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>

            {/* Dropdown suggestions */}
            {focused && !result && (
              <div className="absolute top-full left-0 right-0 mt-1 p-2 bg-background border rounded-lg shadow-lg z-50">
                {query ? (
                  <div className="space-y-1">
                    {suggestions.filter(s => s.toLowerCase().includes(query.toLowerCase())).map((s, i) => (
                      <button
                        key={i}
                        className="flex items-center gap-2 w-full p-2 rounded hover:bg-muted text-left text-sm"
                        onClick={() => setQuery(s)}
                      >
                        <Sparkles className="h-3 w-3 text-violet-500" />
                        {s}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    {quickActions.map((action) => (
                      <button
                        key={action.label}
                        className="flex items-center gap-1 px-2 py-1 rounded hover:bg-muted text-xs"
                        onClick={() => setQuery(action.label.toLowerCase() + ' ')}
                      >
                        <action.icon className={cn('h-3 w-3', action.color)} />
                        {action.label}
                        <kbd className="ml-1 px-1 rounded bg-muted text-[10px]">⌘{action.shortcut}</kbd>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto">
        {result ? (
          <div className="p-4 max-w-2xl mx-auto">
            {/* Query */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 mb-4">
              <Avatar className="h-8 w-8">
                <AvatarFallback>U</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="font-medium">{result.query}</p>
              </div>
            </div>

            {/* Steps */}
            <div className="space-y-2 mb-4">
              {result.steps.map((step, i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium flex-1">{step.name}</span>
                  {step.result && (
                    <span className="text-xs text-muted-foreground">{step.result}</span>
                  )}
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button className="flex-1">
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Confirm
              </Button>
              <Button variant="outline">Modify</Button>
              <Button variant="ghost" onClick={clearResult}>Cancel</Button>
            </div>
          </div>
        ) : processing ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-violet-500 mx-auto mb-3" />
              <p className="font-medium">Processing...</p>
              <p className="text-sm text-muted-foreground">&quot;{query}&quot;</p>
            </div>
          </div>
        ) : (
          <div className="p-4 max-w-2xl mx-auto">
            <Tabs defaultValue="recent">
              <TabsList className="mb-4">
                <TabsTrigger value="recent">Recent</TabsTrigger>
                <TabsTrigger value="suggestions">Suggestions</TabsTrigger>
              </TabsList>

              <TabsContent value="recent">
                <div className="space-y-2">
                  {recentCommands.map((cmd, i) => (
                    <button
                      key={i}
                      className="flex items-center gap-3 w-full p-3 rounded-lg border hover:bg-muted text-left"
                      onClick={() => setQuery(cmd.query)}
                    >
                      <History className="h-4 w-4 text-muted-foreground" />
                      <span className="flex-1 text-sm">{cmd.query}</span>
                      <span className="text-xs text-muted-foreground">{cmd.time}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="suggestions">
                <div className="space-y-2">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      className="flex items-center gap-3 w-full p-3 rounded-lg border hover:bg-muted text-left"
                      onClick={() => setQuery(s)}
                    >
                      <Sparkles className="h-4 w-4 text-violet-500" />
                      <span className="flex-1 text-sm">&quot;{s}&quot;</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t px-4 py-2 flex items-center justify-between text-xs text-muted-foreground bg-muted/30">
        <div className="flex items-center gap-4">
          <span><kbd className="px-1 rounded bg-muted">↵</kbd> submit</span>
          <span><kbd className="px-1 rounded bg-muted">⌘K</kbd> focus</span>
        </div>
        <Badge variant="outline" className="gap-1">
          <Bot className="h-3 w-3" />
          AI Powered
        </Badge>
      </div>
    </div>
  )
}
