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
  ArrowLeft,
  MoreHorizontal,
  Users,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

const mockMeetings = [
  { id: '1', title: 'Q1 Planning Review', time: '9:00 AM', duration: '1h', type: 'video', attendees: ['JA', 'RK', 'LP'], client: 'Acme Corp', aiPrep: true },
  { id: '2', title: 'Design Review', time: '11:00 AM', duration: '30m', type: 'video', attendees: ['SC', 'EW'], client: null, aiPrep: false },
  { id: '3', title: 'Client Lunch', time: '12:30 PM', duration: '1.5h', type: 'in-person', location: 'Downtown Cafe', attendees: ['MB'], client: 'TechStart', aiPrep: true },
  { id: '4', title: 'Sprint Planning', time: '3:00 PM', duration: '1h', type: 'video', attendees: ['Team'], client: null, aiPrep: false },
]

export default function CalendarMinimalPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const meeting = mockMeetings.find(m => m.id === selectedId)

  if (meeting) {
    return (
      <div className="h-[calc(100vh-4rem)] bg-muted/30">
        <div className="max-w-lg mx-auto h-full flex flex-col bg-white dark:bg-neutral-900">
          {/* Header */}
          <div className="p-4 flex items-center gap-3 border-b">
            <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setSelectedId(null)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <span className="font-semibold flex-1">Meeting Details</span>
            <Button variant="ghost" size="icon" className="rounded-full">
              <MoreHorizontal className="h-5 w-5" />
            </Button>
          </div>

          <ScrollArea className="flex-1">
            {/* Meeting Info */}
            <div className="p-6 text-center border-b">
              <div className={cn(
                'w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4',
                meeting.type === 'video' ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-green-100 dark:bg-green-900/30'
              )}>
                {meeting.type === 'video' ? (
                  <Video className="h-8 w-8 text-blue-600" />
                ) : (
                  <MapPin className="h-8 w-8 text-green-600" />
                )}
              </div>
              <h1 className="text-xl font-bold mb-1">{meeting.title}</h1>
              <p className="text-muted-foreground mb-2">{meeting.time} • {meeting.duration}</p>
              {meeting.client && (
                <Badge variant="secondary">{meeting.client}</Badge>
              )}
            </div>

            {/* Quick Actions */}
            <div className="flex justify-center gap-8 p-6 border-b">
              <button className="flex flex-col items-center gap-2">
                <div className="p-4 rounded-2xl bg-primary text-primary-foreground">
                  <Video className="h-6 w-6" />
                </div>
                <span className="text-xs">Join</span>
              </button>
              <button className="flex flex-col items-center gap-2">
                <div className="p-4 rounded-2xl bg-muted">
                  <CalendarIcon className="h-6 w-6" />
                </div>
                <span className="text-xs">Reschedule</span>
              </button>
              <button className="flex flex-col items-center gap-2">
                <div className="p-4 rounded-2xl bg-muted">
                  <Users className="h-6 w-6" />
                </div>
                <span className="text-xs">Attendees</span>
              </button>
            </div>

            {/* Attendees */}
            <div className="px-6 py-4">
              <h3 className="font-semibold mb-3">Attendees</h3>
              <div className="flex items-center gap-3">
                {meeting.attendees.map((a, idx) => (
                  <Avatar key={idx} className="h-10 w-10">
                    <AvatarFallback>{a}</AvatarFallback>
                  </Avatar>
                ))}
              </div>
            </div>

            {/* AI Prep */}
            {meeting.aiPrep && (
              <div className="px-6 py-4">
                <div className="p-4 rounded-2xl bg-violet-50 dark:bg-violet-950/30">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="h-5 w-5 text-violet-500" />
                    <span className="font-semibold">AI Brief Available</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    AI-generated context and talking points based on previous meetings and communications.
                  </p>
                  <Button className="w-full">View Brief</Button>
                </div>
              </div>
            )}

            {/* Location */}
            {meeting.type === 'in-person' && meeting.location && (
              <div className="px-6 py-4">
                <h3 className="font-semibold mb-3">Location</h3>
                <div className="p-4 rounded-2xl bg-muted/50 flex items-center gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground" />
                  <span>{meeting.location}</span>
                </div>
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-4rem)] bg-muted/30">
      <div className="max-w-lg mx-auto h-full flex flex-col bg-white dark:bg-neutral-900">
        {/* Header */}
        <div className="p-4 flex items-center justify-between border-b">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8"><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8"><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <span className="font-semibold">Wed, Jan 15</span>
          <Button size="sm"><Plus className="h-4 w-4" /></Button>
        </div>

        {/* Date Pills */}
        <div className="px-4 py-3 flex gap-2 overflow-x-auto border-b">
          {[13, 14, 15, 16, 17].map((date, idx) => (
            <button
              key={date}
              className={cn(
                'flex-shrink-0 w-12 py-2 rounded-xl text-center transition-colors',
                date === 15 ? 'bg-primary text-primary-foreground' : 'bg-muted/50 hover:bg-muted'
              )}
            >
              <div className="text-[10px]">{['M', 'T', 'W', 'T', 'F'][idx]}</div>
              <div className="text-lg font-semibold">{date}</div>
            </button>
          ))}
        </div>

        {/* Meeting List */}
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-3">
            {mockMeetings.map(m => (
              <button
                key={m.id}
                className="w-full p-4 rounded-2xl bg-muted/50 text-left hover:bg-muted transition-colors"
                onClick={() => setSelectedId(m.id)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-medium">{m.title}</div>
                    <div className="text-sm text-muted-foreground">{m.time} • {m.duration}</div>
                  </div>
                  {m.aiPrep && <Sparkles className="h-4 w-4 text-violet-500" />}
                </div>
                <div className="flex items-center gap-2">
                  {m.type === 'video' ? (
                    <Badge variant="outline" className="text-xs gap-1">
                      <Video className="h-3 w-3" />Video
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs gap-1">
                      <MapPin className="h-3 w-3" />{m.location}
                    </Badge>
                  )}
                  {m.client && <Badge variant="secondary" className="text-xs">{m.client}</Badge>}
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>

        {/* Bottom Nav */}
        <div className="border-t p-4 flex justify-around">
          <button className="flex flex-col items-center gap-1 text-primary">
            <CalendarIcon className="h-5 w-5" />
            <span className="text-[10px]">Day</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-muted-foreground">
            <CalendarIcon className="h-5 w-5" />
            <span className="text-[10px]">Week</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-muted-foreground">
            <CalendarIcon className="h-5 w-5" />
            <span className="text-[10px]">Month</span>
          </button>
        </div>
      </div>
    </div>
  )
}
