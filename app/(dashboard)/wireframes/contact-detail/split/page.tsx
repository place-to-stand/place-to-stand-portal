'use client'

import { useState } from 'react'
import {
  Mail,
  Phone,
  Building2,
  Calendar,
  FileText,
  Clock,
  Sparkles,
  Plus,
  Search,
  MoreHorizontal,
  Globe,
  MapPin,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const contacts = [
  { id: '1', name: 'Jennifer Adams', company: 'Acme Corp', title: 'VP of Product', email: 'jadams@acmecorp.com', phone: '+1 555-0123', score: 92 },
  { id: '2', name: 'Robert Kim', company: 'TechStart', title: 'CEO', email: 'rkim@techstart.io', phone: '+1 555-0124', score: 75 },
  { id: '3', name: 'Lisa Park', company: 'Innovate Co', title: 'CTO', email: 'lpark@innovate.co', phone: '+1 555-0125', score: 88 },
]

const activities = [
  { type: 'email', title: 'Email sent', description: 'Q1 planning follow-up', time: '2 days ago' },
  { type: 'meeting', title: 'Discovery call', description: '30 min call', time: '1 week ago' },
  { type: 'note', title: 'Note added', description: 'Interested in mobile', time: '1 week ago' },
]

export default function ContactDetailSplitPage() {
  const [selectedId, setSelectedId] = useState('1')
  const contact = contacts.find(c => c.id === selectedId)

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Left - Contact List */}
      <div className="w-80 border-r flex flex-col bg-muted/20">
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search contacts..." className="pl-9" />
          </div>
        </div>
        <ScrollArea className="flex-1">
          {contacts.map(c => (
            <button
              key={c.id}
              className={cn(
                'w-full p-4 text-left border-b hover:bg-muted/50 transition-colors',
                selectedId === c.id && 'bg-muted border-l-2 border-l-primary'
              )}
              onClick={() => setSelectedId(c.id)}
            >
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback>{c.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{c.company}</div>
                </div>
                <Badge variant="secondary" className="text-xs">{c.score}%</Badge>
              </div>
            </button>
          ))}
        </ScrollArea>
      </div>

      {/* Right - Contact Detail */}
      {contact && (
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="p-6 border-b bg-background">
            <div className="flex items-start gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="text-xl">{contact.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h1 className="text-xl font-bold mb-1">{contact.name}</h1>
                <p className="text-muted-foreground">{contact.title} at {contact.company}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="secondary">Decision Maker</Badge>
                  <Badge variant="secondary">High Value</Badge>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline"><Mail className="h-4 w-4 mr-2" />Email</Button>
                <Button variant="outline"><Phone className="h-4 w-4 mr-2" />Call</Button>
                <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
              </div>
            </div>
          </div>

          {/* Content */}
          <ScrollArea className="flex-1 p-6">
            <div className="grid grid-cols-2 gap-6">
              {/* Info Card */}
              <Card>
                <CardHeader><CardTitle className="text-sm">Contact Info</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    {contact.email}
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    {contact.phone}
                  </div>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    {contact.company}
                  </div>
                </CardContent>
              </Card>

              {/* Score Card */}
              <Card className="bg-violet-50 dark:bg-violet-950/30 border-violet-200">
                <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Sparkles className="h-4 w-4 text-violet-500" />AI Score</CardTitle></CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-violet-600 mb-2">{contact.score}%</div>
                  <Progress value={contact.score} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-2">High engagement probability</p>
                </CardContent>
              </Card>

              {/* Activity */}
              <Card className="col-span-2">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Recent Activity</CardTitle>
                    <Button variant="outline" size="sm"><Plus className="h-4 w-4 mr-1" />Log Activity</Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {activities.map((a, idx) => (
                      <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                        <div className="p-2 rounded bg-background">
                          {a.type === 'email' && <Mail className="h-4 w-4" />}
                          {a.type === 'meeting' && <Calendar className="h-4 w-4" />}
                          {a.type === 'note' && <FileText className="h-4 w-4" />}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-sm">{a.title}</div>
                          <div className="text-xs text-muted-foreground">{a.description}</div>
                        </div>
                        <div className="text-xs text-muted-foreground">{a.time}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  )
}
