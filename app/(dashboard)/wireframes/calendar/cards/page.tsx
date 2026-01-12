'use client'

import { useState } from 'react'
import {
  Calendar as CalendarIcon,
  Clock,
  Video,
  Users,
  MapPin,
  Plus,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  FileText,
  MoreHorizontal,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

const mockMeetings = [
  { id: '1', title: 'Q1 Planning Review', time: '9:00 AM', duration: '1h', type: 'video', attendees: ['JA', 'RK', 'LP'], client: 'Acme Corp', aiPrep: true },
  { id: '2', title: 'Design Review', time: '11:00 AM', duration: '30m', type: 'video', attendees: ['SC', 'EW'], client: null, aiPrep: false },
  { id: '3', title: 'Client Lunch', time: '12:30 PM', duration: '1.5h', type: 'in-person', attendees: ['MB'], client: 'TechStart', location: 'Downtown Cafe', aiPrep: true },
  { id: '4', title: 'Sprint Planning', time: '3:00 PM', duration: '1h', type: 'video', attendees: ['Team'], client: null, aiPrep: false },
]

const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
const currentDay = 2 // Wednesday

export default function CalendarCardsPage() {
  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Calendar</h1>
            <p className="text-muted-foreground">January 2025</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon"><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline">Today</Button>
            <Button variant="outline" size="icon"><ChevronRight className="h-4 w-4" /></Button>
            <Button><Plus className="h-4 w-4 mr-2" />Schedule</Button>
          </div>
        </div>

        {/* Week View */}
        <div className="grid grid-cols-5 gap-4">
          {weekDays.map((day, idx) => (
            <div key={day} className={cn(
              'p-3 rounded-lg border text-center transition-colors',
              idx === currentDay ? 'bg-primary text-primary-foreground' : 'bg-muted/30 hover:bg-muted/50'
            )}>
              <div className="text-sm font-medium">{day}</div>
              <div className="text-2xl font-bold">{13 + idx}</div>
            </div>
          ))}
        </div>

        {/* Today's Meetings */}
        <div className="grid grid-cols-2 gap-6">
          <div>
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Today's Schedule
            </h2>
            <div className="space-y-3">
              {mockMeetings.map(meeting => (
                <Card key={meeting.id} className="hover:shadow-md transition-all">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-medium">{meeting.title}</h3>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {meeting.time} • {meeting.duration}
                        </div>
                      </div>
                      {meeting.aiPrep && (
                        <Badge variant="secondary" className="gap-1">
                          <Sparkles className="h-3 w-3 text-violet-500" />
                          AI Brief
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-sm">
                      <Badge variant={meeting.type === 'video' ? 'default' : 'outline'}>
                        {meeting.type === 'video' ? <Video className="h-3 w-3 mr-1" /> : <MapPin className="h-3 w-3 mr-1" />}
                        {meeting.type === 'video' ? 'Video' : meeting.location}
                      </Badge>
                      {meeting.client && (
                        <Badge variant="outline">{meeting.client}</Badge>
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-3 border-t">
                      <div className="flex -space-x-2">
                        {meeting.attendees.map((a, idx) => (
                          <Avatar key={idx} className="h-6 w-6 border-2 border-background">
                            <AvatarFallback className="text-[10px]">{a}</AvatarFallback>
                          </Avatar>
                        ))}
                      </div>
                      <Button variant="ghost" size="sm">Join</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* AI Prep Briefs */}
          <div>
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-violet-500" />
              AI Meeting Briefs
            </h2>
            <div className="space-y-3">
              {mockMeetings.filter(m => m.aiPrep).map(meeting => (
                <Card key={meeting.id} className="bg-violet-50 dark:bg-violet-950/30 border-violet-200">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4 text-violet-500" />
                      <span className="font-medium">{meeting.title}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      AI-generated brief with context, talking points, and action items from previous meetings.
                    </p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline">View Brief</Button>
                      <Button size="sm" variant="outline">Add Notes</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
