'use client'

import { useState } from 'react'
import {
  Brain,
  Users,
  Mail,
  Calendar,
  FileText,
  CheckCircle2,
  Sparkles,
  Play,
  X,
  Building2,
  Phone,
  Globe,
  Clock,
  TrendingUp,
  MessageSquare,
  MoreHorizontal,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

// Mock data
const mockClients = [
  { id: '1', name: 'Acme Corp', contact: 'Jennifer Adams', email: 'jadams@acme.com', phone: '+1 (555) 123-4567', website: 'acmecorp.com', health: 85, revenue: 24500, industry: 'Technology' },
  { id: '2', name: 'TechStart', contact: 'Robert Kim', email: 'rkim@techstart.io', phone: '+1 (555) 234-5678', website: 'techstart.io', health: 72, revenue: 18200, industry: 'SaaS' },
  { id: '3', name: 'Innovate Co', contact: 'Lisa Park', email: 'lpark@innovate.co', phone: '+1 (555) 345-6789', website: 'innovate.co', health: 90, revenue: 32100, industry: 'Consulting' },
]

const mockActions = [
  { id: '1', type: 'email', title: 'Draft follow-up email', description: 'Re: Q1 planning discussion', confidence: 94 },
  { id: '2', type: 'task', title: 'Review proposal draft', description: 'Website redesign project', confidence: 87 },
  { id: '3', type: 'schedule', title: 'Schedule quarterly review', description: 'Due next week', confidence: 82 },
]

const mockActivity = [
  { id: '1', type: 'email', title: 'Email sent', description: 'Meeting follow-up', time: '2h ago' },
  { id: '2', type: 'meeting', title: 'Meeting completed', description: 'Q1 Planning Call', time: 'Yesterday' },
  { id: '3', type: 'task', title: 'Task completed', description: 'Proposal review', time: '2 days ago' },
]

export default function AgenticCrmSplitPage() {
  const [selectedClient, setSelectedClient] = useState<string>('1')
  const client = mockClients.find(c => c.id === selectedClient)

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Left Panel - Client List */}
      <div className="w-80 border-r flex flex-col bg-muted/20">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-5 w-5 text-muted-foreground" />
            <h2 className="font-semibold">Clients</h2>
            <Badge variant="secondary" className="ml-auto">{mockClients.length}</Badge>
          </div>
        </div>

        <ScrollArea className="flex-1">
          {mockClients.map(c => (
            <button
              key={c.id}
              className={cn(
                'w-full p-4 text-left border-b hover:bg-muted/50 transition-colors',
                selectedClient === c.id && 'bg-muted border-l-2 border-l-primary'
              )}
              onClick={() => setSelectedClient(c.id)}
            >
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback>{c.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{c.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{c.contact}</div>
                </div>
                <div className="text-right">
                  <div className={cn(
                    'text-xs font-medium',
                    c.health >= 80 ? 'text-green-600' : c.health >= 60 ? 'text-yellow-600' : 'text-red-600'
                  )}>
                    {c.health}%
                  </div>
                </div>
              </div>
            </button>
          ))}
        </ScrollArea>
      </div>

      {/* Right Panel - Client Detail */}
      {client && (
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="p-6 border-b bg-background">
            <div className="flex items-start gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="text-xl">{client.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-xl font-bold">{client.name}</h1>
                  <Badge variant="outline">{client.industry}</Badge>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Building2 className="h-4 w-4" />
                    {client.contact}
                  </span>
                  <span className="flex items-center gap-1">
                    <Mail className="h-4 w-4" />
                    {client.email}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm">
                  <Phone className="h-4 w-4 mr-2" />
                  Call
                </Button>
                <Button variant="outline" size="sm">
                  <Mail className="h-4 w-4 mr-2" />
                  Email
                </Button>
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-4 gap-4 mt-6">
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold">${(client.revenue / 1000).toFixed(1)}K</div>
                <div className="text-xs text-muted-foreground">Revenue</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className="flex items-center justify-center gap-1">
                  <span className="text-2xl font-bold">{client.health}%</span>
                  <TrendingUp className="h-4 w-4 text-green-500" />
                </div>
                <div className="text-xs text-muted-foreground">Health Score</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold">12</div>
                <div className="text-xs text-muted-foreground">Open Tasks</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold">3</div>
                <div className="text-xs text-muted-foreground">Active Projects</div>
              </div>
            </div>
          </div>

          {/* Tabbed Content */}
          <Tabs defaultValue="actions" className="flex-1 flex flex-col">
            <div className="border-b px-6">
              <TabsList className="h-12 bg-transparent p-0 gap-4">
                <TabsTrigger value="actions" className="data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 pb-3">
                  <Sparkles className="h-4 w-4 mr-2" />
                  AI Actions
                </TabsTrigger>
                <TabsTrigger value="activity" className="data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 pb-3">
                  <Clock className="h-4 w-4 mr-2" />
                  Activity
                </TabsTrigger>
                <TabsTrigger value="details" className="data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 pb-3">
                  <FileText className="h-4 w-4 mr-2" />
                  Details
                </TabsTrigger>
              </TabsList>
            </div>

            <ScrollArea className="flex-1">
              <TabsContent value="actions" className="p-6 m-0">
                <div className="space-y-3">
                  {mockActions.map(action => {
                    const icons = { email: Mail, task: CheckCircle2, schedule: Calendar }
                    const Icon = icons[action.type as keyof typeof icons]
                    return (
                      <Card key={action.id}>
                        <CardContent className="p-4 flex items-center gap-4">
                          <div className="p-2 rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-900/30">
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="flex-1">
                            <div className="font-medium">{action.title}</div>
                            <div className="text-sm text-muted-foreground">{action.description}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">{action.confidence}%</Badge>
                            <Button variant="outline" size="sm">Review</Button>
                            <Button size="sm">
                              <Play className="h-4 w-4 mr-1" />
                              Execute
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </TabsContent>

              <TabsContent value="activity" className="p-6 m-0">
                <div className="space-y-4">
                  {mockActivity.map(item => (
                    <div key={item.id} className="flex items-start gap-4">
                      <div className="p-2 rounded-full bg-muted">
                        {item.type === 'email' && <Mail className="h-4 w-4" />}
                        {item.type === 'meeting' && <Calendar className="h-4 w-4" />}
                        {item.type === 'task' && <CheckCircle2 className="h-4 w-4" />}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{item.title}</div>
                        <div className="text-sm text-muted-foreground">{item.description}</div>
                      </div>
                      <div className="text-xs text-muted-foreground">{item.time}</div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="details" className="p-6 m-0">
                <div className="grid grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Contact Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        {client.email}
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        {client.phone}
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        {client.website}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Health Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Engagement</span>
                          <span>90%</span>
                        </div>
                        <Progress value={90} className="h-2" />
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Payment</span>
                          <span>100%</span>
                        </div>
                        <Progress value={100} className="h-2" />
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Satisfaction</span>
                          <span>75%</span>
                        </div>
                        <Progress value={75} className="h-2" />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </div>
      )}
    </div>
  )
}
