'use client'

import { useState } from 'react'
import {
  Search,
  Plus,
  Mail,
  Phone,
  MoreHorizontal,
  Sparkles,
  ArrowRight,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

const mockLeads = [
  { id: '1', name: 'Sarah Mitchell', company: 'GrowthLabs', email: 'sarah@growthlabs.io', status: 'hot', score: 92, value: 45000 },
  { id: '2', name: 'James Wilson', company: 'TechVentures', email: 'james@techventures.com', status: 'warm', score: 75, value: 28000 },
  { id: '3', name: 'Emily Chen', company: 'DataFlow Inc', email: 'emily@dataflow.io', status: 'warm', score: 68, value: 35000 },
  { id: '4', name: 'Michael Brown', company: 'CloudNine', email: 'michael@cloudnine.co', status: 'cold', score: 45, value: 15000 },
]

const statusConfig = {
  hot: { color: 'bg-red-500', label: 'Hot' },
  warm: { color: 'bg-orange-500', label: 'Warm' },
  cold: { color: 'bg-blue-500', label: 'Cold' },
}

function LeadRow({ lead, onClick }: { lead: typeof mockLeads[0], onClick: () => void }) {
  const status = statusConfig[lead.status as keyof typeof statusConfig]

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white dark:bg-neutral-900 shadow-sm border hover:shadow-md transition-all text-left"
    >
      <Avatar className="h-12 w-12">
        <AvatarFallback className="bg-gradient-to-br from-violet-500 to-blue-500 text-white">
          {lead.name.split(' ').map(n => n[0]).join('')}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-semibold">{lead.name}</span>
          <span className={cn('h-2 w-2 rounded-full', status.color)} />
        </div>
        <p className="text-sm text-muted-foreground">{lead.company}</p>
      </div>
      <div className="text-right mr-2">
        <div className="font-semibold">${(lead.value / 1000).toFixed(0)}K</div>
        <div className="text-xs text-muted-foreground flex items-center justify-end gap-1">
          <Sparkles className="h-3 w-3" />
          {lead.score}%
        </div>
      </div>
      <ChevronRight className="h-5 w-5 text-muted-foreground" />
    </button>
  )
}

function LeadDetail({ lead, onBack }: { lead: typeof mockLeads[0], onBack: () => void }) {
  const status = statusConfig[lead.status as keyof typeof statusConfig]

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <span className="font-semibold">Lead Details</span>
      </div>

      <ScrollArea className="flex-1 px-6">
        {/* Profile */}
        <div className="text-center py-6">
          <Avatar className="h-20 w-20 mx-auto mb-4">
            <AvatarFallback className="text-2xl bg-gradient-to-br from-violet-500 to-blue-500 text-white">
              {lead.name.split(' ').map(n => n[0]).join('')}
            </AvatarFallback>
          </Avatar>
          <h1 className="text-xl font-bold mb-1">{lead.name}</h1>
          <p className="text-muted-foreground mb-3">{lead.company}</p>
          <Badge className={cn('capitalize', status.color === 'bg-red-500' ? 'bg-red-100 text-red-700' : status.color === 'bg-orange-500' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700')}>
            {status.label} Lead
          </Badge>
        </div>

        {/* Quick Actions */}
        <div className="flex justify-center gap-4 py-6">
          <Button variant="outline" size="lg" className="flex-col h-auto py-4 px-6 rounded-2xl">
            <Mail className="h-6 w-6 mb-2" />
            <span className="text-xs">Email</span>
          </Button>
          <Button variant="outline" size="lg" className="flex-col h-auto py-4 px-6 rounded-2xl">
            <Phone className="h-6 w-6 mb-2" />
            <span className="text-xs">Call</span>
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 py-6">
          <div className="p-4 rounded-2xl bg-violet-50 dark:bg-violet-900/20 text-center">
            <div className="text-3xl font-bold text-violet-600">{lead.score}%</div>
            <div className="text-sm text-muted-foreground">Lead Score</div>
          </div>
          <div className="p-4 rounded-2xl bg-green-50 dark:bg-green-900/20 text-center">
            <div className="text-3xl font-bold text-green-600">${(lead.value / 1000).toFixed(0)}K</div>
            <div className="text-sm text-muted-foreground">Est. Value</div>
          </div>
        </div>

        {/* Contact */}
        <div className="py-6 space-y-4">
          <h3 className="font-semibold">Contact Info</h3>
          <div className="p-4 rounded-2xl bg-muted/50">
            <div className="text-sm text-muted-foreground mb-1">Email</div>
            <div className="font-medium">{lead.email}</div>
          </div>
        </div>
      </ScrollArea>

      {/* Bottom Action */}
      <div className="p-6 border-t">
        <Button className="w-full h-12 rounded-full text-base">
          <ArrowRight className="h-5 w-5 mr-2" />
          Convert to Client
        </Button>
      </div>
    </div>
  )
}

export default function LeadsMinimalPage() {
  const [view, setView] = useState<'list' | 'detail'>('list')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selectedLead = mockLeads.find(l => l.id === selectedId)

  const openLead = (id: string) => {
    setSelectedId(id)
    setView('detail')
  }

  const goBack = () => {
    setView('list')
    setSelectedId(null)
  }

  return (
    <div className="h-[calc(100vh-4rem)] bg-muted/30">
      {view === 'list' ? (
        <div className="max-w-2xl mx-auto h-full flex flex-col">
          {/* Header */}
          <div className="p-6 pb-4">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-semibold">Leads</h1>
              <Button size="icon" className="rounded-full">
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search leads..."
                className="pl-11 h-11 rounded-full bg-white dark:bg-neutral-900 border shadow-sm"
              />
            </div>
          </div>

          {/* Filter Pills */}
          <div className="px-6 pb-4 flex gap-2">
            <Button size="sm" className="rounded-full">All</Button>
            <Button variant="outline" size="sm" className="rounded-full">
              <span className="h-2 w-2 rounded-full bg-red-500 mr-2" />
              Hot
            </Button>
            <Button variant="outline" size="sm" className="rounded-full">
              <span className="h-2 w-2 rounded-full bg-orange-500 mr-2" />
              Warm
            </Button>
            <Button variant="outline" size="sm" className="rounded-full">
              <span className="h-2 w-2 rounded-full bg-blue-500 mr-2" />
              Cold
            </Button>
          </div>

          {/* Leads List */}
          <ScrollArea className="flex-1 px-6">
            <div className="space-y-3 pb-6">
              {mockLeads.map(lead => (
                <LeadRow key={lead.id} lead={lead} onClick={() => openLead(lead.id)} />
              ))}
            </div>
          </ScrollArea>

          {/* Stats Footer */}
          <div className="p-6 border-t bg-white dark:bg-neutral-900">
            <div className="flex justify-around text-center">
              <div>
                <div className="text-2xl font-bold">{mockLeads.length}</div>
                <div className="text-xs text-muted-foreground">Total Leads</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">${(mockLeads.reduce((a, l) => a + l.value, 0) / 1000).toFixed(0)}K</div>
                <div className="text-xs text-muted-foreground">Pipeline</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-violet-600">{Math.round(mockLeads.reduce((a, l) => a + l.score, 0) / mockLeads.length)}%</div>
                <div className="text-xs text-muted-foreground">Avg Score</div>
              </div>
            </div>
          </div>
        </div>
      ) : selectedLead ? (
        <div className="max-w-2xl mx-auto h-full bg-white dark:bg-neutral-900">
          <LeadDetail lead={selectedLead} onBack={goBack} />
        </div>
      ) : null}
    </div>
  )
}
