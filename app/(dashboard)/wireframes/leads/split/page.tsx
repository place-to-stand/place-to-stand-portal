'use client'

import { useState } from 'react'
import {
  Search,
  Mail,
  Phone,
  Building2,
  Globe,
  Calendar,
  DollarSign,
  Sparkles,
  Clock,
  MessageSquare,
  FileText,
  ArrowRight,
  MoreHorizontal,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

const mockLeads = [
  { id: '1', name: 'Sarah Mitchell', company: 'GrowthLabs', email: 'sarah@growthlabs.io', phone: '+1 555-0123', website: 'growthlabs.io', status: 'hot', score: 92, value: 45000, source: 'Website', notes: 'Interested in full redesign. Budget approved.' },
  { id: '2', name: 'James Wilson', company: 'TechVentures', email: 'james@techventures.com', phone: '+1 555-0124', website: 'techventures.com', status: 'warm', score: 75, value: 28000, source: 'Referral', notes: 'Follow up next week after board meeting.' },
  { id: '3', name: 'Emily Chen', company: 'DataFlow Inc', email: 'emily@dataflow.io', phone: '+1 555-0125', website: 'dataflow.io', status: 'warm', score: 68, value: 35000, source: 'LinkedIn', notes: 'Comparing with 2 other agencies.' },
]

const mockActivities = [
  { id: '1', type: 'email', title: 'Email sent', description: 'Introduction and pricing', time: '2 days ago' },
  { id: '2', type: 'call', title: 'Discovery call', description: '30 min call, discussed requirements', time: '1 week ago' },
  { id: '3', type: 'note', title: 'Note added', description: 'Very interested in mobile app', time: '1 week ago' },
]

const statusColors = {
  hot: 'bg-red-100 text-red-700 border-red-200',
  warm: 'bg-orange-100 text-orange-700 border-orange-200',
  cold: 'bg-blue-100 text-blue-700 border-blue-200',
}

export default function LeadsSplitPage() {
  const [selectedLead, setSelectedLead] = useState<string>('1')
  const lead = mockLeads.find(l => l.id === selectedLead)

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Left - Lead List */}
      <div className="w-96 border-r flex flex-col bg-muted/20">
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search leads..." className="pl-9" />
          </div>
        </div>

        <ScrollArea className="flex-1">
          {mockLeads.map(l => (
            <button
              key={l.id}
              className={cn(
                'w-full p-4 text-left border-b hover:bg-muted/50 transition-colors',
                selectedLead === l.id && 'bg-muted border-l-2 border-l-primary'
              )}
              onClick={() => setSelectedLead(l.id)}
            >
              <div className="flex items-start gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback>{l.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium truncate">{l.name}</span>
                    <Badge variant="outline" className={cn('text-xs capitalize', statusColors[l.status as keyof typeof statusColors])}>
                      {l.status}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground truncate">{l.company}</div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Sparkles className="h-3 w-3" />
                      {l.score}%
                    </span>
                    <span className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      ${(l.value / 1000).toFixed(0)}K
                    </span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </ScrollArea>
      </div>

      {/* Right - Lead Detail */}
      {lead && (
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="p-6 border-b bg-background">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="text-xl">{lead.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h1 className="text-xl font-bold">{lead.name}</h1>
                    <Badge variant="outline" className={cn('capitalize', statusColors[lead.status as keyof typeof statusColors])}>
                      {lead.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Building2 className="h-4 w-4" />
                      {lead.company}
                    </span>
                    <span className="flex items-center gap-1">
                      <Globe className="h-4 w-4" />
                      {lead.website}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline">
                  <Mail className="h-4 w-4 mr-2" />
                  Email
                </Button>
                <Button variant="outline">
                  <Phone className="h-4 w-4 mr-2" />
                  Call
                </Button>
                <Button>
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Convert
                </Button>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4 mt-6">
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="h-4 w-4 text-violet-500" />
                  <span className="text-sm text-muted-foreground">Lead Score</span>
                </div>
                <div className="text-2xl font-bold">{lead.score}%</div>
                <Progress value={lead.score} className="h-1.5 mt-2" />
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-muted-foreground">Est. Value</span>
                </div>
                <div className="text-2xl font-bold">${(lead.value / 1000).toFixed(0)}K</div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Globe className="h-4 w-4 text-blue-500" />
                  <span className="text-sm text-muted-foreground">Source</span>
                </div>
                <div className="text-2xl font-bold">{lead.source}</div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="h-4 w-4 text-orange-500" />
                  <span className="text-sm text-muted-foreground">Last Contact</span>
                </div>
                <div className="text-2xl font-bold">2d ago</div>
              </Card>
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="activity" className="flex-1 flex flex-col">
            <div className="border-b px-6">
              <TabsList className="h-12 bg-transparent p-0 gap-4">
                <TabsTrigger value="activity" className="data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 pb-3">
                  Activity
                </TabsTrigger>
                <TabsTrigger value="notes" className="data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 pb-3">
                  Notes
                </TabsTrigger>
                <TabsTrigger value="emails" className="data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 pb-3">
                  Emails
                </TabsTrigger>
              </TabsList>
            </div>

            <ScrollArea className="flex-1 p-6">
              <TabsContent value="activity" className="m-0 space-y-4">
                {mockActivities.map(activity => (
                  <div key={activity.id} className="flex items-start gap-4">
                    <div className="p-2 rounded-full bg-muted">
                      {activity.type === 'email' && <Mail className="h-4 w-4" />}
                      {activity.type === 'call' && <Phone className="h-4 w-4" />}
                      {activity.type === 'note' && <FileText className="h-4 w-4" />}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{activity.title}</div>
                      <div className="text-sm text-muted-foreground">{activity.description}</div>
                    </div>
                    <div className="text-xs text-muted-foreground">{activity.time}</div>
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="notes" className="m-0">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm mb-4">{lead.notes}</p>
                    <Textarea placeholder="Add a note..." className="min-h-[80px]" />
                    <Button size="sm" className="mt-2">Save Note</Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="emails" className="m-0">
                <div className="text-center text-muted-foreground py-8">
                  <Mail className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No emails yet</p>
                  <Button variant="outline" size="sm" className="mt-2">Send Email</Button>
                </div>
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </div>
      )}
    </div>
  )
}
