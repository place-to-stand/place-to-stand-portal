'use client'

import { useState } from 'react'
import {
  Search,
  Plus,
  Filter,
  MoreHorizontal,
  Mail,
  Phone,
  Building2,
  Globe,
  Calendar,
  DollarSign,
  ArrowRight,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

const mockLeads = [
  { id: '1', name: 'Sarah Mitchell', company: 'GrowthLabs', email: 'sarah@growthlabs.io', phone: '+1 555-0123', website: 'growthlabs.io', status: 'hot', score: 92, value: 45000, source: 'Website', lastContact: '2 hours ago' },
  { id: '2', name: 'James Wilson', company: 'TechVentures', email: 'james@techventures.com', phone: '+1 555-0124', website: 'techventures.com', status: 'warm', score: 75, value: 28000, source: 'Referral', lastContact: '1 day ago' },
  { id: '3', name: 'Emily Chen', company: 'DataFlow Inc', email: 'emily@dataflow.io', phone: '+1 555-0125', website: 'dataflow.io', status: 'warm', score: 68, value: 35000, source: 'LinkedIn', lastContact: '3 days ago' },
  { id: '4', name: 'Michael Brown', company: 'CloudNine', email: 'michael@cloudnine.co', phone: '+1 555-0126', website: 'cloudnine.co', status: 'cold', score: 45, value: 15000, source: 'Cold Email', lastContact: '1 week ago' },
]

const statusColors = {
  hot: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  warm: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  cold: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
}

function LeadCard({ lead }: { lead: typeof mockLeads[0] }) {
  return (
    <Card className="hover:shadow-lg transition-all cursor-pointer group">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="bg-gradient-to-br from-violet-500 to-blue-500 text-white">
                {lead.name.split(' ').map(n => n[0]).join('')}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold">{lead.name}</h3>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                {lead.company}
              </p>
            </div>
          </div>
          <Badge className={cn('capitalize', statusColors[lead.status as keyof typeof statusColors])}>
            {lead.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Score */}
        <div>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-muted-foreground flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-violet-500" />
              Lead Score
            </span>
            <span className={cn(
              'font-semibold',
              lead.score >= 80 ? 'text-green-600' : lead.score >= 50 ? 'text-yellow-600' : 'text-red-600'
            )}>
              {lead.score}%
            </span>
          </div>
          <Progress value={lead.score} className="h-2" />
        </div>

        {/* Details */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <DollarSign className="h-4 w-4" />
            ${(lead.value / 1000).toFixed(0)}K value
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <TrendingUp className="h-4 w-4" />
            {lead.source}
          </div>
        </div>

        {/* Contact Info */}
        <div className="flex items-center gap-2 pt-3 border-t">
          <Button variant="outline" size="sm" className="flex-1 h-8">
            <Mail className="h-3 w-3 mr-1" />
            Email
          </Button>
          <Button variant="outline" size="sm" className="flex-1 h-8">
            <Phone className="h-3 w-3 mr-1" />
            Call
          </Button>
          <Button variant="outline" size="sm" className="h-8">
            <Calendar className="h-3 w-3" />
          </Button>
        </div>

        {/* Last Contact */}
        <div className="text-xs text-muted-foreground text-center">
          Last contact: {lead.lastContact}
        </div>
      </CardContent>
    </Card>
  )
}

export default function LeadsCardsPage() {
  const [filter, setFilter] = useState<'all' | 'hot' | 'warm' | 'cold'>('all')
  const filteredLeads = filter === 'all' ? mockLeads : mockLeads.filter(l => l.status === filter)

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Leads</h1>
          <p className="text-muted-foreground">Manage and track your sales pipeline</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Lead
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search leads..." className="pl-9" />
        </div>
        <div className="flex items-center gap-2">
          {(['all', 'hot', 'warm', 'cold'] as const).map(status => (
            <Button
              key={status}
              variant={filter === status ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(status)}
              className="capitalize"
            >
              {status}
              {status !== 'all' && (
                <Badge variant="secondary" className="ml-2 h-5">
                  {mockLeads.filter(l => l.status === status).length}
                </Badge>
              )}
            </Button>
          ))}
        </div>
        <Button variant="outline" size="icon">
          <Filter className="h-4 w-4" />
        </Button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-2xl font-bold">{mockLeads.length}</div>
          <div className="text-sm text-muted-foreground">Total Leads</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-red-600">{mockLeads.filter(l => l.status === 'hot').length}</div>
          <div className="text-sm text-muted-foreground">Hot Leads</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold">${(mockLeads.reduce((a, l) => a + l.value, 0) / 1000).toFixed(0)}K</div>
          <div className="text-sm text-muted-foreground">Pipeline Value</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold">{Math.round(mockLeads.reduce((a, l) => a + l.score, 0) / mockLeads.length)}%</div>
          <div className="text-sm text-muted-foreground">Avg Score</div>
        </Card>
      </div>

      {/* Cards Grid */}
      <ScrollArea className="h-[calc(100vh-380px)]">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredLeads.map(lead => (
            <LeadCard key={lead.id} lead={lead} />
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
