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
  FileText,
  Users,
  Search,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

const mockMeetings = [
  { id: '1', title: 'Q1 Planning Review', time: '9:00 AM', duration: '1h', type: 'video', attendees: ['JA', 'RK', 'LP'], client: 'Acme Corp', aiPrep: true, notes: 'Review quarterly goals and KPIs' },
  { id: '2', title: 'Design Review', time: '11:00 AM', duration: '30m', type: 'video', attendees: ['SC', 'EW'], client: null, aiPrep: false, notes: '' },
  { id: '3', title: 'Client Lunch', time: '12:30 PM', duration: '1.5h', type: 'in-person', attendees: ['MB'], client: 'TechStart', location: 'Downtown Cafe', aiPrep: true, notes: 'Discuss expansion plans' },
  { id: '4', title: 'Sprint Planning', time: '3:00 PM', duration: '1h', type: 'video', attendees: ['Team'], client: null, aiPrep: false, notes: '' },
]

const weekDays = [
  { day: 'Mon', date: 13, meetings: 2 },
  { day: 'Tue', date: 14, meetings: 3 },
  { day: 'Wed', date: 15, meetings: 4 },
  { day: 'Thu', date: 16, meetings: 1 },
  { day: 'Fri', date: 17, meetings: 2 },
]

export default function CalendarSplitPage() {
  const [selectedId, setSelectedId] = useState('1')
  const [selectedDay, setSelectedDay] = useState(2)
  const meeting = mockMeetings.find(m => m.id === selectedId)

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Left - Calendar & Meeting List */}
      <div className="w-96 border-r flex flex-col bg-muted/20">
        {/* Mini Calendar Header */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-4">
            <span className="font-semibold">January 2025</span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8"><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8"><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="grid grid-cols-5 gap-1">
            {weekDays.map((d, idx) => (
              <button
                key={d.day}
                onClick={() => setSelectedDay(idx)}
                className={cn(
                  'p-2 rounded-lg text-center transition-colors',
                  selectedDay === idx ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                )}
              >
                <div className="text-xs">{d.day}</div>
                <div className="text-lg font-semibold">{d.date}</div>
                <div className="text-[10px] text-muted-foreground">{d.meetings} mtg</div>
              </button>
            ))}
          </div>
        </div>

        {/* Meeting List */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm">Today's Meetings</h3>
            <Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" />Add</Button>
          </div>
        </div>

        <ScrollArea className="flex-1">
          {mockMeetings.map(m => (
            <button
              key={m.id}
              className={cn(
                'w-full p-4 text-left border-b hover:bg-muted/50 transition-colors',
                selectedId === m.id && 'bg-muted border-l-2 border-l-primary'
              )}
              onClick={() => setSelectedId(m.id)}
            >
              <div className="flex items-start justify-between mb-1">
                <span className="font-medium">{m.title}</span>
                {m.aiPrep && <Sparkles className="h-4 w-4 text-violet-500" />}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-3 w-3" />
                {m.time} • {m.duration}
              </div>
              <div className="flex items-center gap-2 mt-2">
                {m.type === 'video' && <Badge variant="outline" className="text-xs"><Video className="h-3 w-3 mr-1" />Video</Badge>}
                {m.type === 'in-person' && <Badge variant="outline" className="text-xs"><MapPin className="h-3 w-3 mr-1" />{m.location}</Badge>}
                {m.client && <Badge variant="secondary" className="text-xs">{m.client}</Badge>}
              </div>
            </button>
          ))}
        </ScrollArea>
      </div>

      {/* Right - Meeting Detail */}
      {meeting && (
        <div className="flex-1 flex flex-col">
          {/* Meeting Header */}
          <div className="p-6 border-b bg-background">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-xl font-bold mb-1">{meeting.title}</h1>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{meeting.time}</span>
                  <span>{meeting.duration}</span>
                  {meeting.type === 'video' && <span className="flex items-center gap-1"><Video className="h-4 w-4" />Video Call</span>}
                  {meeting.type === 'in-person' && <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{meeting.location}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button>Join Meeting</Button>
                <Button variant="outline">Reschedule</Button>
              </div>
            </div>
          </div>

          {/* Meeting Content */}
          <ScrollArea className="flex-1 p-6">
            <Tabs defaultValue="details">
              <TabsList className="mb-6">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="prep">AI Prep</TabsTrigger>
                <TabsTrigger value="notes">Notes</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-6">
                {/* Attendees */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Users className="h-4 w-4" />Attendees
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-3">
                      {meeting.attendees.map((a, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">{a}</AvatarFallback>
                          </Avatar>
                        </div>
                      ))}
                      <Button variant="outline" size="sm"><Plus className="h-4 w-4 mr-1" />Add</Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Client Info */}
                {meeting.client && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Associated Client</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback>{meeting.client.slice(0, 2)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{meeting.client}</div>
                          <div className="text-sm text-muted-foreground">View client profile</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="prep">
                {meeting.aiPrep ? (
                  <Card className="bg-violet-50 dark:bg-violet-950/30 border-violet-200">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-2 mb-4">
                        <Sparkles className="h-5 w-5 text-violet-500" />
                        <h3 className="font-semibold">AI Meeting Brief</h3>
                      </div>
                      <div className="space-y-4 text-sm">
                        <div>
                          <h4 className="font-medium mb-1">Context</h4>
                          <p className="text-muted-foreground">Last meeting was 2 weeks ago. Discussed Q4 results and preliminary Q1 planning.</p>
                        </div>
                        <div>
                          <h4 className="font-medium mb-1">Key Points to Address</h4>
                          <ul className="list-disc list-inside text-muted-foreground space-y-1">
                            <li>Review Q1 budget allocation</li>
                            <li>Discuss hiring timeline</li>
                            <li>Product roadmap updates</li>
                          </ul>
                        </div>
                        <div>
                          <h4 className="font-medium mb-1">Open Items from Last Meeting</h4>
                          <ul className="list-disc list-inside text-muted-foreground space-y-1">
                            <li>Marketing campaign approval (pending)</li>
                            <li>Technical debt sprint (completed)</li>
                          </ul>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No AI prep available for this meeting</p>
                    <Button variant="outline" size="sm" className="mt-4">Generate Brief</Button>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="notes">
                <Card>
                  <CardContent className="p-4">
                    <textarea
                      className="w-full min-h-[200px] bg-transparent border-none resize-none focus:outline-none"
                      placeholder="Add meeting notes..."
                      defaultValue={meeting.notes}
                    />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </ScrollArea>
        </div>
      )}
    </div>
  )
}
