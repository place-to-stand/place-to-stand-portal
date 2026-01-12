'use client'

import { useState } from 'react'
import {
  Calendar as CalendarIcon,
  Clock,
  Video,
  MapPin,
  Plus,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  MoreHorizontal,
  Users,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

const mockMeetings = [
  { id: '1', title: 'Q1 Planning Review', time: '9:00', duration: '1h', type: 'video', client: 'Acme Corp', hasPrep: true },
  { id: '2', title: 'Design Review', time: '11:00', duration: '30m', type: 'video', client: null, hasPrep: false },
  { id: '3', title: 'Client Lunch', time: '12:30', duration: '1.5h', type: 'location', client: 'TechStart', hasPrep: true },
  { id: '4', title: 'Sprint Planning', time: '15:00', duration: '1h', type: 'video', client: null, hasPrep: false },
]

const hours = Array.from({ length: 10 }, (_, i) => i + 8) // 8am to 5pm

export default function CalendarCompactPage() {
  const [view, setView] = useState<'day' | 'week'>('day')

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <div className="border-b px-4 py-2 flex items-center gap-4 bg-background">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8"><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" className="h-8">Today</Button>
          <Button variant="ghost" size="icon" className="h-8 w-8"><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <span className="font-semibold">Wed, Jan 15</span>
        <div className="flex items-center gap-1 ml-auto">
          <Button variant={view === 'day' ? 'secondary' : 'ghost'} size="sm" className="h-8" onClick={() => setView('day')}>Day</Button>
          <Button variant={view === 'week' ? 'secondary' : 'ghost'} size="sm" className="h-8" onClick={() => setView('week')}>Week</Button>
        </div>
        <Button size="sm" className="h-8"><Plus className="h-4 w-4 mr-1" />New</Button>
      </div>

      <div className="flex-1 flex">
        {/* Time Column */}
        <div className="w-16 border-r flex-shrink-0">
          <div className="h-10 border-b" />
          {hours.map(hour => (
            <div key={hour} className="h-16 border-b px-2 py-1 text-xs text-muted-foreground">
              {hour}:00
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <ScrollArea className="flex-1">
          <div className="relative min-h-full">
            {/* Hour Lines */}
            <div className="h-10 border-b bg-muted/30 px-2 py-1 text-xs font-medium">
              Wednesday, January 15
            </div>
            {hours.map(hour => (
              <div key={hour} className="h-16 border-b" />
            ))}

            {/* Events */}
            <div className="absolute inset-0 top-10 px-2">
              {mockMeetings.map((meeting, idx) => {
                const startHour = parseInt(meeting.time.split(':')[0])
                const top = (startHour - 8) * 64
                const duration = parseFloat(meeting.duration)
                const height = duration * 64

                return (
                  <div
                    key={meeting.id}
                    className={cn(
                      'absolute left-2 right-2 rounded-lg p-2 cursor-pointer transition-all hover:shadow-md',
                      meeting.client ? 'bg-blue-100 dark:bg-blue-900/30 border-l-4 border-blue-500' : 'bg-muted border-l-4 border-muted-foreground'
                    )}
                    style={{ top: `${top}px`, height: `${height - 4}px` }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm truncate">{meeting.title}</span>
                      {meeting.hasPrep && <Sparkles className="h-3 w-3 text-violet-500 flex-shrink-0" />}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      <span>{meeting.time}</span>
                      <span>•</span>
                      <span>{meeting.duration}</span>
                      {meeting.type === 'video' && <Video className="h-3 w-3" />}
                      {meeting.type === 'location' && <MapPin className="h-3 w-3" />}
                    </div>
                    {meeting.client && (
                      <Badge variant="outline" className="mt-1 text-[10px] h-4">{meeting.client}</Badge>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </ScrollArea>

        {/* Mini Agenda */}
        <div className="w-64 border-l bg-muted/20 flex-shrink-0">
          <div className="p-3 border-b">
            <h3 className="font-semibold text-sm">Upcoming</h3>
          </div>
          <ScrollArea className="h-[calc(100%-48px)]">
            <div className="p-2 space-y-2">
              {mockMeetings.map(meeting => (
                <div key={meeting.id} className="p-2 rounded-lg bg-background border text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium truncate">{meeting.title}</span>
                    {meeting.hasPrep && <Sparkles className="h-3 w-3 text-violet-500" />}
                  </div>
                  <div className="text-xs text-muted-foreground">{meeting.time} • {meeting.duration}</div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}
