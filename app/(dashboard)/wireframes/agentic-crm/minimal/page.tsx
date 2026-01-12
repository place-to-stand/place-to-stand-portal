'use client'

import { useState } from 'react'
import {
  Brain,
  Sparkles,
  Play,
  Check,
  X,
  ChevronRight,
  Mail,
  Calendar,
  FileText,
  CheckCircle2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

// Simplified mock data
const mockActions = [
  { id: '1', type: 'email', title: 'Follow up with Jennifer', subtitle: 'Acme Corp • Q1 Planning', confidence: 94, urgent: true },
  { id: '2', type: 'task', title: 'Create proposal', subtitle: 'TechStart • Website Redesign', confidence: 87, urgent: false },
  { id: '3', type: 'schedule', title: 'Book review call', subtitle: 'Innovate Co • Next week', confidence: 82, urgent: false },
  { id: '4', type: 'document', title: 'Generate invoice', subtitle: 'TechStart • December', confidence: 91, urgent: true },
]

const mockClients = [
  { id: '1', name: 'Acme Corp', initials: 'AC', health: 85, pendingActions: 2 },
  { id: '2', name: 'TechStart', initials: 'TS', health: 72, pendingActions: 3 },
  { id: '3', name: 'Innovate Co', initials: 'IC', health: 90, pendingActions: 1 },
]

function ActionCard({ action, onExecute, onDismiss }: {
  action: typeof mockActions[0]
  onExecute: () => void
  onDismiss: () => void
}) {
  const icons = { email: Mail, task: CheckCircle2, schedule: Calendar, document: FileText }
  const Icon = icons[action.type as keyof typeof icons]

  return (
    <div className={cn(
      'p-5 rounded-2xl bg-white dark:bg-neutral-900 shadow-sm border transition-all hover:shadow-md',
      action.urgent && 'border-orange-200 dark:border-orange-800'
    )}>
      <div className="flex items-start gap-4">
        <div className={cn(
          'p-3 rounded-xl',
          action.urgent
            ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30'
            : 'bg-violet-100 text-violet-600 dark:bg-violet-900/30'
        )}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold">{action.title}</h3>
            {action.urgent && (
              <Badge variant="outline" className="text-orange-600 border-orange-300 text-xs">
                Urgent
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{action.subtitle}</p>

          <div className="flex items-center gap-2 mt-4">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Sparkles className="h-3 w-3 text-violet-500" />
              {action.confidence}% match
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-4 pt-4 border-t">
        <Button
          variant="ghost"
          size="sm"
          className="flex-1 h-9"
          onClick={onDismiss}
        >
          <X className="h-4 w-4 mr-1" />
          Dismiss
        </Button>
        <Button
          size="sm"
          className="flex-1 h-9 bg-violet-600 hover:bg-violet-700"
          onClick={onExecute}
        >
          <Play className="h-4 w-4 mr-1" />
          Execute
        </Button>
      </div>
    </div>
  )
}

function ClientPill({ client }: { client: typeof mockClients[0] }) {
  return (
    <button className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-neutral-900 shadow-sm border hover:shadow-md transition-all w-full text-left">
      <Avatar className="h-10 w-10">
        <AvatarFallback className="bg-gradient-to-br from-violet-500 to-blue-500 text-white text-sm">
          {client.initials}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="font-medium">{client.name}</div>
        <div className="text-xs text-muted-foreground">
          {client.pendingActions} pending actions
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <div className={cn(
          'text-sm font-semibold',
          client.health >= 80 ? 'text-green-600' : client.health >= 60 ? 'text-yellow-600' : 'text-red-600'
        )}>
          {client.health}%
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </button>
  )
}

export default function AgenticCrmMinimalPage() {
  const [actions, setActions] = useState(mockActions)

  const handleExecute = (id: string) => {
    setActions(actions.filter(a => a.id !== id))
  }

  const handleDismiss = (id: string) => {
    setActions(actions.filter(a => a.id !== id))
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-muted/30 p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center py-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 mb-4">
            <Brain className="h-5 w-5" />
            <span className="font-medium">AI Assistant</span>
          </div>
          <h1 className="text-3xl font-bold mb-2">Good morning!</h1>
          <p className="text-muted-foreground">
            You have <span className="font-semibold text-foreground">{actions.length} suggested actions</span> waiting for review.
          </p>
        </div>

        {/* Actions */}
        {actions.length > 0 ? (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-violet-500" />
              Suggested Actions
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {actions.map(action => (
                <ActionCard
                  key={action.id}
                  action={action}
                  onExecute={() => handleExecute(action.id)}
                  onDismiss={() => handleDismiss(action.id)}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold mb-2">All caught up!</h2>
            <p className="text-muted-foreground">No pending actions. Great job!</p>
          </div>
        )}

        {/* Clients Overview */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Your Clients</h2>
            <Button variant="ghost" size="sm">
              View all
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {mockClients.map(client => (
              <ClientPill key={client.id} client={client} />
            ))}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4 p-6 rounded-2xl bg-white dark:bg-neutral-900 shadow-sm border">
          <div className="text-center">
            <div className="text-3xl font-bold text-violet-600">94%</div>
            <div className="text-sm text-muted-foreground">AI Accuracy</div>
          </div>
          <div className="text-center border-x">
            <div className="text-3xl font-bold">12</div>
            <div className="text-sm text-muted-foreground">Actions Today</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">2.5h</div>
            <div className="text-sm text-muted-foreground">Time Saved</div>
          </div>
        </div>
      </div>
    </div>
  )
}
