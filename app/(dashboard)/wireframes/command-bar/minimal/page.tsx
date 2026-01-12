'use client'

import { useState, useEffect } from 'react'
import {
  Sparkles,
  Mail,
  Calendar,
  FileText,
  CheckCircle2,
  Plus,
  Target,
  Loader2,
  Bot,
  Mic,
  MicOff,
  ArrowLeft,
  ChevronRight,
  History,
  Send,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

const quickActions = [
  { icon: Mail, label: 'Email', color: 'bg-blue-500' },
  { icon: Calendar, label: 'Meeting', color: 'bg-green-500' },
  { icon: Plus, label: 'Task', color: 'bg-amber-500' },
  { icon: Target, label: 'Lead', color: 'bg-red-500' },
  { icon: FileText, label: 'Doc', color: 'bg-purple-500' },
]

const recentCommands = [
  { query: "Email Sarah about timeline", time: '2h ago' },
  { query: "Show hot leads", time: '3h ago' },
  { query: "Schedule standup tomorrow", time: '1d ago' },
]

const suggestions = [
  "Schedule a call with Sarah",
  "Send follow-up to TechStart",
  "Show project status",
  "Create task for review",
]

interface CommandStep {
  name: string
  status: 'complete' | 'running' | 'pending'
}

export default function CommandBarMinimalPage() {
  const [view, setView] = useState<'home' | 'processing' | 'result'>('home')
  const [query, setQuery] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [steps, setSteps] = useState<CommandStep[]>([])
  const [currentStep, setCurrentStep] = useState(0)

  const handleSubmit = () => {
    if (!query.trim()) return
    setView('processing')
    setSteps([
      { name: 'Understanding request', status: 'running' },
      { name: 'Finding context', status: 'pending' },
      { name: 'Executing action', status: 'pending' },
    ])
    setCurrentStep(0)
  }

  useEffect(() => {
    if (view === 'processing' && currentStep < steps.length) {
      const timer = setTimeout(() => {
        setSteps(prev => prev.map((s, i) =>
          i === currentStep ? { ...s, status: 'complete' } :
          i === currentStep + 1 ? { ...s, status: 'running' } : s
        ))
        setCurrentStep(prev => prev + 1)
      }, 800)
      return () => clearTimeout(timer)
    } else if (view === 'processing' && currentStep >= steps.length) {
      setView('result')
    }
  }, [view, currentStep, steps.length])

  const reset = () => {
    setView('home')
    setQuery('')
    setSteps([])
    setCurrentStep(0)
  }

  if (view === 'result') {
    return (
      <div className="h-[calc(100vh-4rem)] bg-muted/30">
        <div className="max-w-lg mx-auto h-full flex flex-col bg-white dark:bg-neutral-900">
          {/* Header */}
          <div className="p-4 flex items-center gap-3 border-b">
            <Button variant="ghost" size="icon" className="rounded-full" onClick={reset}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <span className="font-semibold flex-1">Result</span>
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          </div>

          <ScrollArea className="flex-1">
            <div className="p-4 space-y-6">
              {/* Query */}
              <div className="p-4 rounded-2xl bg-violet-50 dark:bg-violet-950/30">
                <div className="flex items-start gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>U</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{query}</p>
                    <p className="text-xs text-muted-foreground mt-1">Just now</p>
                  </div>
                </div>
              </div>

              {/* Steps */}
              <div className="space-y-2">
                {steps.map((step, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <span className="font-medium">{step.name}</span>
                  </div>
                ))}
              </div>

              {/* Success message */}
              <div className="p-6 rounded-2xl bg-green-50 dark:bg-green-950/30 text-center">
                <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
                <p className="font-semibold text-green-700 dark:text-green-300">Action Complete!</p>
                <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                  Your request has been processed
                </p>
              </div>
            </div>
          </ScrollArea>

          {/* Actions */}
          <div className="p-4 border-t space-y-2">
            <Button className="w-full rounded-xl">
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Done
            </Button>
            <Button variant="outline" className="w-full rounded-xl" onClick={reset}>
              New Command
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (view === 'processing') {
    return (
      <div className="h-[calc(100vh-4rem)] bg-muted/30">
        <div className="max-w-lg mx-auto h-full flex flex-col bg-white dark:bg-neutral-900">
          {/* Header */}
          <div className="p-4 flex items-center gap-3 border-b">
            <Button variant="ghost" size="icon" className="rounded-full" onClick={reset}>
              <X className="h-5 w-5" />
            </Button>
            <span className="font-semibold flex-1">Processing</span>
            <Loader2 className="h-5 w-5 animate-spin text-violet-500" />
          </div>

          <div className="flex-1 flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-sm space-y-6">
              {/* Query */}
              <div className="text-center">
                <Sparkles className="h-10 w-10 text-violet-500 mx-auto mb-4" />
                <p className="font-medium">&quot;{query}&quot;</p>
              </div>

              {/* Progress */}
              <Progress value={(currentStep / steps.length) * 100} className="h-2" />

              {/* Steps */}
              <div className="space-y-3">
                {steps.map((step, i) => (
                  <div
                    key={i}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-xl transition-all',
                      step.status === 'running' && 'bg-violet-50 dark:bg-violet-950/30'
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
                      'text-sm',
                      step.status === 'pending' && 'text-muted-foreground'
                    )}>{step.name}</span>
                  </div>
                ))}
              </div>
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
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold">AI Commands</h1>
              <p className="text-xs text-muted-foreground">Just say what you need</p>
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-6">
            {/* Quick actions */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-3">QUICK ACTIONS</p>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {quickActions.map((action) => (
                  <button
                    key={action.label}
                    className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-muted/50 min-w-[70px]"
                    onClick={() => setQuery(action.label.toLowerCase() + ' ')}
                  >
                    <div className={cn('p-2 rounded-xl', action.color)}>
                      <action.icon className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-xs">{action.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Recent */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-3">RECENT</p>
              <div className="space-y-2">
                {recentCommands.map((cmd, i) => (
                  <button
                    key={i}
                    className="w-full p-3 rounded-2xl bg-muted/50 flex items-center gap-3 text-left"
                    onClick={() => setQuery(cmd.query)}
                  >
                    <History className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1 text-sm">{cmd.query}</span>
                    <span className="text-xs text-muted-foreground">{cmd.time}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Suggestions */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-3">TRY SAYING</p>
              <div className="space-y-2">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    className="w-full p-3 rounded-2xl bg-muted/50 flex items-center gap-3 text-left"
                    onClick={() => setQuery(s)}
                  >
                    <Sparkles className="h-4 w-4 text-violet-500" />
                    <span className="flex-1 text-sm">&quot;{s}&quot;</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="p-4 border-t">
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 px-4 py-3 rounded-2xl border bg-muted/50">
              <Sparkles className="h-5 w-5 text-violet-500 shrink-0" />
              <input
                type="text"
                placeholder="What would you like to do?"
                className="flex-1 bg-transparent outline-none text-sm"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              />
              <Button
                variant="ghost"
                size="icon"
                className={cn('h-8 w-8 rounded-full', isListening && 'text-red-500')}
                onClick={() => setIsListening(!isListening)}
              >
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
            </div>
            <Button
              className="rounded-2xl h-12 w-12"
              onClick={handleSubmit}
              disabled={!query.trim()}
            >
              <Send className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
