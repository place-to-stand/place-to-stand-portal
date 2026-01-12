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
  Trash2,
  Star,
  StarOff,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

interface CommandHistoryItem {
  id: string
  query: string
  result: string
  time: string
  starred: boolean
}

const commandHistory: CommandHistoryItem[] = [
  { id: '1', query: "Schedule call with Sarah for Tuesday", result: 'Meeting created', time: '10:30 AM', starred: false },
  { id: '2', query: "Send follow-up to TechStart", result: 'Email drafted', time: '9:15 AM', starred: true },
  { id: '3', query: "What's the status of Acme project?", result: '65% complete', time: 'Yesterday', starred: false },
  { id: '4', query: "Show hot leads", result: '5 leads found', time: 'Yesterday', starred: true },
  { id: '5', query: "Create task to review API docs", result: 'Task created', time: '2 days ago', starred: false },
]

const suggestions = [
  "Schedule a meeting with...",
  "Send email to...",
  "Create task for...",
  "What's the status of...",
]

interface CommandStep {
  name: string
  status: 'complete' | 'running' | 'pending'
  result?: string
}

export default function CommandBarSplitPage() {
  const [query, setQuery] = useState('')
  const [processing, setProcessing] = useState(false)
  const [selectedHistory, setSelectedHistory] = useState<CommandHistoryItem | null>(null)
  const [steps, setSteps] = useState<CommandStep[]>([])
  const [currentStep, setCurrentStep] = useState(0)

  const handleSubmit = () => {
    if (!query.trim()) return
    setProcessing(true)
    setSteps([
      { name: 'Parse intent', status: 'pending' },
      { name: 'Extract entities', status: 'pending' },
      { name: 'Check context', status: 'pending' },
      { name: 'Execute action', status: 'pending' },
    ])
    setCurrentStep(0)
  }

  useEffect(() => {
    if (processing && currentStep < steps.length) {
      const timer = setTimeout(() => {
        setSteps(prev => prev.map((s, i) =>
          i === currentStep ? { ...s, status: 'complete', result: 'Done' } :
          i === currentStep + 1 ? { ...s, status: 'running' } : s
        ))
        setCurrentStep(prev => prev + 1)
      }, 700)
      return () => clearTimeout(timer)
    } else if (processing && currentStep >= steps.length) {
      setProcessing(false)
    }
  }, [processing, currentStep, steps.length])

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Left - History */}
      <div className="w-80 border-r flex flex-col bg-muted/20">
        <div className="p-3 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-muted-foreground" />
            <span className="font-semibold">History</span>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {commandHistory.map(item => (
              <button
                key={item.id}
                className={cn(
                  'w-full p-3 rounded-lg text-left transition-colors',
                  selectedHistory?.id === item.id
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted'
                )}
                onClick={() => { setSelectedHistory(item); setQuery(item.query) }}
              >
                <div className="flex items-start gap-2">
                  <Sparkles className="h-4 w-4 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium line-clamp-2">{item.query}</p>
                    <p className="text-xs opacity-70 mt-1">{item.result}</p>
                  </div>
                  {item.starred && <Star className="h-3 w-3 fill-current shrink-0" />}
                </div>
                <p className="text-xs opacity-50 mt-2">{item.time}</p>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Right - Command Interface */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="font-semibold">AI Command Bar</h1>
            <p className="text-sm text-muted-foreground">Natural language interface</p>
          </div>
        </div>

        {/* Main area */}
        <ScrollArea className="flex-1 p-4">
          <div className="max-w-xl mx-auto space-y-6">
            {/* Suggestions */}
            {!processing && steps.length === 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">SUGGESTIONS</p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      className="px-3 py-1.5 rounded-full border text-sm hover:bg-muted"
                      onClick={() => setQuery(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Current query */}
            {(processing || steps.length > 0) && (
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>U</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{query}</p>
                    <p className="text-xs text-muted-foreground mt-1">Just now</p>
                  </div>
                </div>

                {/* Processing steps */}
                <div className="space-y-2">
                  {steps.map((step, i) => (
                    <div
                      key={i}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-lg transition-all',
                        step.status === 'running' ? 'bg-violet-50 dark:bg-violet-950/30' : 'bg-muted/30'
                      )}
                    >
                      {step.status === 'complete' ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : step.status === 'running' ? (
                        <Loader2 className="h-5 w-5 text-violet-500 animate-spin" />
                      ) : (
                        <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />
                      )}
                      <span className={cn(
                        'flex-1 font-medium',
                        step.status === 'pending' && 'text-muted-foreground'
                      )}>{step.name}</span>
                      {step.result && (
                        <span className="text-sm text-muted-foreground">{step.result}</span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Action buttons */}
                {!processing && steps.length > 0 && (
                  <div className="flex gap-2 pt-2">
                    <Button className="flex-1">
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Confirm
                    </Button>
                    <Button variant="outline">Modify</Button>
                    <Button
                      variant="ghost"
                      onClick={() => { setSteps([]); setQuery('') }}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="p-4 border-t bg-muted/30">
          <div className="flex items-center gap-3 max-w-xl mx-auto">
            <div className="flex-1 flex items-center gap-2 px-4 py-3 rounded-xl border bg-background">
              <Sparkles className="h-5 w-5 text-violet-500" />
              <input
                type="text"
                placeholder="What would you like to do?"
                className="flex-1 bg-transparent outline-none"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              />
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Mic className="h-4 w-4" />
              </Button>
            </div>
            <Button onClick={handleSubmit} disabled={!query.trim() || processing}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
