'use client'

import { useState } from 'react'
import {
  Brain,
  Users,
  Mail,
  Calendar,
  FileText,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  MoreHorizontal,
  Plus,
  Filter,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

// Mock data
const mockStats = [
  { label: 'Active Clients', value: 12, change: '+2 this month', icon: Users, color: 'text-blue-500' },
  { label: 'Pending Tasks', value: 28, change: '5 due today', icon: CheckCircle2, color: 'text-green-500' },
  { label: 'Unread Emails', value: 15, change: '3 need response', icon: Mail, color: 'text-orange-500' },
  { label: 'Meetings Today', value: 4, change: 'Next in 2h', icon: Calendar, color: 'text-purple-500' },
]

const mockAiActions = [
  { id: '1', type: 'email', title: 'Draft follow-up to Acme Corp', description: 'Re: Q1 planning discussion from yesterday', confidence: 94, urgent: true },
  { id: '2', type: 'task', title: 'Create project proposal', description: 'For TechStart website redesign', confidence: 87, urgent: false },
  { id: '3', type: 'schedule', title: 'Schedule check-in call', description: 'With Lisa Park at Innovate Co', confidence: 82, urgent: false },
  { id: '4', type: 'document', title: 'Generate invoice', description: 'December services for Portal MVP', confidence: 91, urgent: true },
]

const mockClients = [
  { id: '1', name: 'Acme Corp', contact: 'Jennifer Adams', health: 85, revenue: '$24,500', status: 'active' },
  { id: '2', name: 'TechStart', contact: 'Robert Kim', health: 72, revenue: '$18,200', status: 'active' },
  { id: '3', name: 'Innovate Co', contact: 'Lisa Park', health: 90, revenue: '$32,100', status: 'active' },
]

function StatCard({ stat }: { stat: typeof mockStats[0] }) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{stat.label}</p>
            <p className="text-3xl font-bold mt-1">{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{stat.change}</p>
          </div>
          <div className={cn('p-3 rounded-xl bg-muted', stat.color)}>
            <stat.icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function AiActionCard({ action }: { action: typeof mockAiActions[0] }) {
  const icons = {
    email: Mail,
    task: CheckCircle2,
    schedule: Calendar,
    document: FileText,
  }
  const Icon = icons[action.type as keyof typeof icons]

  return (
    <Card className={cn('transition-all hover:shadow-md', action.urgent && 'border-orange-200 bg-orange-50/50 dark:bg-orange-950/20')}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={cn(
            'p-2 rounded-lg',
            action.urgent ? 'bg-orange-100 text-orange-600' : 'bg-muted text-muted-foreground'
          )}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-medium text-sm">{action.title}</h4>
              {action.urgent && (
                <Badge variant="outline" className="text-[10px] h-4 px-1 border-orange-300 text-orange-600">
                  Urgent
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{action.description}</p>
            <div className="flex items-center gap-3 mt-3">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Sparkles className="h-3 w-3 text-violet-500" />
                {action.confidence}% confidence
              </div>
              <Button size="sm" variant="outline" className="h-6 text-xs ml-auto">
                Review
              </Button>
              <Button size="sm" className="h-6 text-xs">
                Execute
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function ClientCard({ client }: { client: typeof mockClients[0] }) {
  return (
    <Card className="hover:shadow-md transition-all cursor-pointer">
      <CardContent className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback>{client.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h4 className="font-medium">{client.name}</h4>
            <p className="text-xs text-muted-foreground">{client.contact}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-muted-foreground">Health Score</span>
              <span className={cn(
                'font-medium',
                client.health >= 80 ? 'text-green-600' : client.health >= 60 ? 'text-yellow-600' : 'text-red-600'
              )}>
                {client.health}%
              </span>
            </div>
            <Progress value={client.health} className="h-1.5" />
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Revenue</span>
            <span className="font-medium">{client.revenue}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-4 pt-3 border-t">
          <Button variant="outline" size="sm" className="flex-1 h-8 text-xs">
            View Details
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs">
            <Mail className="h-3 w-3" />
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs">
            <Calendar className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default function AgenticCrmCardsPage() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">CRM Dashboard</h1>
          <p className="text-muted-foreground">AI-powered client management</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </Button>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Client
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {mockStats.map((stat, idx) => (
          <StatCard key={idx} stat={stat} />
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* AI Actions */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-violet-500" />
                  <CardTitle className="text-lg">AI Suggested Actions</CardTitle>
                </div>
                <Badge variant="secondary">{mockAiActions.length} pending</Badge>
              </div>
              <CardDescription>Review and execute AI-generated tasks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {mockAiActions.map(action => (
                  <AiActionCard key={action.id} action={action} />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start h-10">
                <Mail className="h-4 w-4 mr-2" />
                Draft Email
                <ArrowRight className="h-4 w-4 ml-auto" />
              </Button>
              <Button variant="outline" className="w-full justify-start h-10">
                <Calendar className="h-4 w-4 mr-2" />
                Schedule Meeting
                <ArrowRight className="h-4 w-4 ml-auto" />
              </Button>
              <Button variant="outline" className="w-full justify-start h-10">
                <FileText className="h-4 w-4 mr-2" />
                Create Proposal
                <ArrowRight className="h-4 w-4 ml-auto" />
              </Button>
              <Button variant="outline" className="w-full justify-start h-10">
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Add Task
                <ArrowRight className="h-4 w-4 ml-auto" />
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">AI Insights</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-950/30">
                <TrendingUp className="h-4 w-4 text-green-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-green-700 dark:text-green-400">Revenue Up 15%</p>
                  <p className="text-xs text-green-600 dark:text-green-500">Compared to last month</p>
                </div>
              </div>
              <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/30">
                <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">2 Clients Need Attention</p>
                  <p className="text-xs text-yellow-600 dark:text-yellow-500">Low engagement detected</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Clients Grid */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Active Clients</CardTitle>
            <Button variant="outline" size="sm">View All</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mockClients.map(client => (
              <ClientCard key={client.id} client={client} />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
