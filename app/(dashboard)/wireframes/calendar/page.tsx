'use client'

import { useState } from 'react'
import {
  Calendar as CalendarIcon,
  Clock,
  Video,
  MapPin,
  Users,
  ChevronLeft,
  ChevronRight,
  Plus,
  MoreHorizontal,
  ExternalLink,
  Link2,
  Sparkles,
  FileText,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Globe,
  Building2,
  Mail,
  Phone,
  Briefcase,
  Star,
  Copy,
  Settings,
  Zap,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { AppShellHeader } from '@/components/layout/app-shell'

// Mock calendar data
const mockEvents = [
  {
    id: '1',
    title: 'Discovery Call - TechStart',
    start: '10:00 AM',
    end: '10:45 AM',
    type: 'meeting',
    attendees: [
      { name: 'Sarah Chen', email: 'sarah@techstart.io', status: 'accepted' },
      { name: 'Damon Bodine', email: 'damon@example.com', status: 'accepted' },
    ],
    meetLink: 'https://meet.google.com/abc-defg-hij',
    linkedTo: { type: 'lead', name: 'TechStart Web App', id: '1' },
    hasPrep: true,
  },
  {
    id: '2',
    title: 'Team Standup',
    start: '11:00 AM',
    end: '11:15 AM',
    type: 'internal',
    attendees: [
      { name: 'Damon Bodine', email: 'damon@example.com', status: 'accepted' },
      { name: 'Team Member', email: 'team@example.com', status: 'accepted' },
    ],
    meetLink: 'https://meet.google.com/xyz-uvwx-rst',
    recurring: true,
  },
  {
    id: '3',
    title: 'Proposal Review - Acme Corp',
    start: '2:00 PM',
    end: '2:30 PM',
    type: 'meeting',
    attendees: [
      { name: 'Michael Park', email: 'michael@acmecorp.com', status: 'tentative' },
      { name: 'Damon Bodine', email: 'damon@example.com', status: 'accepted' },
    ],
    meetLink: 'https://meet.google.com/mno-pqrs-tuv',
    linkedTo: { type: 'client', name: 'Acme Corp', id: '2' },
    hasPrep: true,
  },
]

const mockAvailability = [
  { time: '9:00 AM', available: true },
  { time: '9:30 AM', available: true },
  { time: '10:00 AM', available: false },
  { time: '10:30 AM', available: false },
  { time: '11:00 AM', available: false },
  { time: '11:30 AM', available: true },
  { time: '12:00 PM', available: true },
  { time: '12:30 PM', available: true },
  { time: '1:00 PM', available: true },
  { time: '1:30 PM', available: true },
  { time: '2:00 PM', available: false },
  { time: '2:30 PM', available: true },
  { time: '3:00 PM', available: true },
  { time: '3:30 PM', available: true },
  { time: '4:00 PM', available: true },
  { time: '4:30 PM', available: true },
]

const mockPrepBrief = {
  contact: {
    name: 'Sarah Chen',
    title: 'VP of Engineering',
    company: 'TechStart Inc',
    email: 'sarah@techstart.io',
    phone: '+1 (415) 555-0123',
  },
  context: {
    leadStage: 'Proposal Sent',
    dealValue: '$15,000',
    score: 82,
    daysSinceFirstContact: 6,
  },
  keyPoints: [
    'Sarah mentioned hard deadline of March 15 for launch',
    'Budget is approved, evaluating 2-3 vendors',
    'Main concern is timeline and post-launch support',
    'Tech stack preference: React, Node.js, PostgreSQL',
  ],
  suggestedTopics: [
    'Walk through proposal timeline and milestones',
    'Discuss post-launch support options',
    'Address questions from last email',
    'Clarify scope for phase 2',
  ],
  previousMeetings: [
    { date: 'Jan 6, 2025', title: 'Initial Contact', summary: 'Introduction call, discussed their needs' },
  ],
  recentEmails: 3,
}

// Event card in calendar
function EventCard({ event, onClick }: { event: typeof mockEvents[0], onClick: () => void }) {
  const bgColor = event.type === 'internal' ? 'bg-muted' : 'bg-blue-500/10 border-blue-500/20'
  const textColor = event.type === 'internal' ? 'text-foreground' : 'text-blue-700 dark:text-blue-300'

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-2 rounded-md border ${bgColor} hover:ring-2 hover:ring-ring transition-all`}
    >
      <div className="flex items-center justify-between">
        <p className={`font-medium text-sm ${textColor}`}>{event.title}</p>
        {event.hasPrep && (
          <Tooltip>
            <TooltipTrigger>
              <Sparkles className="h-3 w-3 text-violet-500" />
            </TooltipTrigger>
            <TooltipContent>AI prep brief available</TooltipContent>
          </Tooltip>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{event.start} - {event.end}</p>
      <div className="flex items-center gap-1 mt-1">
        {event.attendees.slice(0, 3).map((a, i) => (
          <Avatar key={i} className="h-5 w-5 border-2 border-background -ml-1 first:ml-0">
            <AvatarFallback className="text-[8px]">
              {a.name.split(' ').map(n => n[0]).join('')}
            </AvatarFallback>
          </Avatar>
        ))}
        {event.attendees.length > 3 && (
          <span className="text-xs text-muted-foreground ml-1">+{event.attendees.length - 3}</span>
        )}
      </div>
    </button>
  )
}

// Prep brief sheet
function PrepBriefSheet({ event, open, onClose }: { event: typeof mockEvents[0] | null, open: boolean, onClose: () => void }) {
  if (!event) return null

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-[500px] sm:max-w-[500px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-500" />
            Meeting Prep Brief
          </SheetTitle>
          <SheetDescription>{event.title}</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Meeting details */}
          <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
            <div className="flex flex-col items-center justify-center w-14 h-14 rounded-lg bg-background border">
              <span className="text-lg font-bold">11</span>
              <span className="text-xs text-muted-foreground">Jan</span>
            </div>
            <div>
              <p className="font-medium">{event.start} - {event.end}</p>
              <div className="flex items-center gap-2 mt-1">
                <Video className="h-4 w-4 text-muted-foreground" />
                <a href={event.meetLink} className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                  Join Google Meet
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </div>

          {/* Contact info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback>SC</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{mockPrepBrief.contact.name}</p>
                  <p className="text-sm text-muted-foreground">{mockPrepBrief.contact.title}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3">
                <div className="flex items-center gap-2 text-sm">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  {mockPrepBrief.contact.company}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  {mockPrepBrief.contact.email}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Deal context */}
          <Card className="border-amber-500/20 bg-amber-500/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" />
                Deal Context
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Stage</p>
                  <Badge variant="secondary">{mockPrepBrief.context.leadStage}</Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Value</p>
                  <p className="font-medium">{mockPrepBrief.context.dealValue}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Lead Score</p>
                  <p className="font-medium">{mockPrepBrief.context.score}/100</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Days Active</p>
                  <p className="font-medium">{mockPrepBrief.context.daysSinceFirstContact}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Key points */}
          <Card className="border-violet-500/20 bg-violet-500/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-violet-500" />
                Key Points to Remember
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {mockPrepBrief.keyPoints.map((point, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-violet-500 mt-0.5 shrink-0" />
                    {point}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Suggested topics */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Suggested Discussion Topics</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {mockPrepBrief.suggestedTopics.map((topic, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="flex items-center justify-center h-5 w-5 rounded-full bg-muted text-xs font-medium">
                      {i + 1}
                    </span>
                    {topic}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Previous meetings */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Previous Meetings</CardTitle>
            </CardHeader>
            <CardContent>
              {mockPrepBrief.previousMeetings.map((meeting, i) => (
                <div key={i} className="flex items-start gap-3 p-2 rounded-md hover:bg-muted">
                  <CalendarIcon className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">{meeting.title}</p>
                    <p className="text-xs text-muted-foreground">{meeting.date}</p>
                    <p className="text-sm mt-1">{meeting.summary}</p>
                  </div>
                </div>
              ))}
              <p className="text-sm text-muted-foreground mt-2">
                + {mockPrepBrief.recentEmails} emails exchanged
              </p>
            </CardContent>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// Schedule meeting sheet
function ScheduleMeetingSheet({ open, onClose }: { open: boolean, onClose: () => void }) {
  const [duration, setDuration] = useState('30')
  const [includeLink, setIncludeLink] = useState(true)

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-[500px] sm:max-w-[500px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Schedule Meeting</SheetTitle>
          <SheetDescription>Create a new meeting with Google Calendar</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div>
            <Label>Meeting Title</Label>
            <Input placeholder="e.g., Discovery Call" className="mt-1" />
          </div>

          <div>
            <Label>Attendees</Label>
            <Input placeholder="Add people..." className="mt-1" />
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="secondary" className="gap-1">
                Sarah Chen
                <button className="ml-1 hover:text-destructive">×</button>
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Date</Label>
              <Input type="date" className="mt-1" defaultValue="2025-01-13" />
            </div>
            <div>
              <Label>Time</Label>
              <Input type="time" className="mt-1" defaultValue="10:00" />
            </div>
          </div>

          <div>
            <Label>Duration</Label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15 minutes</SelectItem>
                <SelectItem value="30">30 minutes</SelectItem>
                <SelectItem value="45">45 minutes</SelectItem>
                <SelectItem value="60">1 hour</SelectItem>
                <SelectItem value="90">1.5 hours</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Availability preview */}
          <div>
            <Label className="mb-2 block">Your Availability (Jan 13)</Label>
            <div className="grid grid-cols-4 gap-1">
              {mockAvailability.map((slot, i) => (
                <button
                  key={i}
                  disabled={!slot.available}
                  className={`p-2 text-xs rounded border transition-colors ${
                    slot.available
                      ? 'hover:bg-primary hover:text-primary-foreground cursor-pointer'
                      : 'bg-muted text-muted-foreground cursor-not-allowed'
                  }`}
                >
                  {slot.time}
                </button>
              ))}
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Add Google Meet link</Label>
              <p className="text-xs text-muted-foreground">Auto-generate video call link</p>
            </div>
            <Switch checked={includeLink} onCheckedChange={setIncludeLink} />
          </div>

          <div>
            <Label>Link to</Label>
            <Select>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select lead, client, or project..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lead-1">Lead: TechStart Web App</SelectItem>
                <SelectItem value="client-1">Client: TechStart Inc</SelectItem>
                <SelectItem value="project-1">Project: TechStart Portal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Description</Label>
            <Textarea placeholder="Meeting agenda or notes..." className="mt-1" rows={3} />
          </div>

          <div className="flex gap-2 pt-4">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button className="flex-1">
              <CalendarIcon className="h-4 w-4 mr-2" />
              Create Meeting
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// Main calendar page
export default function CalendarWireframePage() {
  const [selectedEvent, setSelectedEvent] = useState<typeof mockEvents[0] | null>(null)
  const [showSchedule, setShowSchedule] = useState(false)
  const [currentDate] = useState(new Date(2025, 0, 11)) // Jan 11, 2025

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const hours = Array.from({ length: 10 }, (_, i) => i + 8) // 8 AM to 5 PM

  return (
    <TooltipProvider>
      <>
        <AppShellHeader>
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" className="h-8 w-8">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="font-medium">January 2025</span>
                <Button variant="outline" size="icon" className="h-8 w-8">
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" className="ml-2">Today</Button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Sync
              </Button>
              <Button onClick={() => setShowSchedule(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Meeting
              </Button>
            </div>
          </div>
        </AppShellHeader>

        <div className="flex h-[calc(100vh-8rem)]">
          {/* Calendar grid */}
          <div className="flex-1 border-r overflow-auto">
            {/* Week header */}
            <div className="grid grid-cols-8 border-b sticky top-0 bg-background z-10">
              <div className="p-2 border-r" /> {/* Time column header */}
              {days.map((day, i) => {
                const date = new Date(2025, 0, 5 + i) // Week of Jan 5
                const isToday = date.getDate() === 11
                return (
                  <div key={day} className={`p-2 text-center border-r last:border-r-0 ${isToday ? 'bg-primary/5' : ''}`}>
                    <p className="text-xs text-muted-foreground">{day}</p>
                    <p className={`text-lg font-medium ${isToday ? 'text-primary' : ''}`}>{date.getDate()}</p>
                  </div>
                )
              })}
            </div>

            {/* Time grid */}
            <div className="grid grid-cols-8">
              {/* Time labels */}
              <div className="border-r">
                {hours.map(hour => (
                  <div key={hour} className="h-20 border-b px-2 py-1">
                    <span className="text-xs text-muted-foreground">
                      {hour > 12 ? hour - 12 : hour} {hour >= 12 ? 'PM' : 'AM'}
                    </span>
                  </div>
                ))}
              </div>

              {/* Day columns */}
              {days.map((day, dayIndex) => {
                const date = new Date(2025, 0, 5 + dayIndex)
                const isToday = date.getDate() === 11
                const dayEvents = isToday ? mockEvents : []

                return (
                  <div key={day} className={`border-r last:border-r-0 relative ${isToday ? 'bg-primary/5' : ''}`}>
                    {hours.map(hour => (
                      <div key={hour} className="h-20 border-b" />
                    ))}

                    {/* Events overlay */}
                    {dayEvents.map(event => {
                      // Calculate position based on time
                      const startHour = parseInt(event.start.split(':')[0])
                      const startMinute = event.start.includes('PM') && startHour !== 12 ? startHour + 12 : startHour
                      const top = (startMinute - 8) * 80 + (parseInt(event.start.split(':')[0]) === 12 ? 0 : 0)

                      return (
                        <div
                          key={event.id}
                          className="absolute left-1 right-1"
                          style={{ top: `${(parseInt(event.start) - 8 + (event.start.includes('PM') && !event.start.includes('12') ? 12 : 0)) * 80}px` }}
                        >
                          <EventCard event={event} onClick={() => setSelectedEvent(event)} />
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Sidebar - Upcoming & Quick actions */}
          <div className="w-80 p-4 overflow-y-auto">
            <h2 className="font-semibold mb-4">Today&apos;s Meetings</h2>

            <div className="space-y-3">
              {mockEvents.map(event => (
                <Card key={event.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setSelectedEvent(event)}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant={event.type === 'internal' ? 'secondary' : 'default'}>
                        {event.start}
                      </Badge>
                      {event.hasPrep && (
                        <Badge variant="outline" className="gap-1 text-violet-600 border-violet-200">
                          <Sparkles className="h-3 w-3" />
                          Prep ready
                        </Badge>
                      )}
                    </div>
                    <p className="font-medium text-sm">{event.title}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex -space-x-2">
                        {event.attendees.slice(0, 3).map((a, i) => (
                          <Avatar key={i} className="h-6 w-6 border-2 border-background">
                            <AvatarFallback className="text-[10px]">
                              {a.name.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                        ))}
                      </div>
                      <Button variant="ghost" size="sm" className="ml-auto h-7" asChild>
                        <a href={event.meetLink} target="_blank" rel="noopener noreferrer">
                          <Video className="h-3 w-3 mr-1" />
                          Join
                        </a>
                      </Button>
                    </div>
                    {event.linkedTo && (
                      <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                        <Link2 className="h-3 w-3" />
                        {event.linkedTo.type}: {event.linkedTo.name}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            <Separator className="my-6" />

            <h2 className="font-semibold mb-4">Quick Actions</h2>
            <div className="space-y-2">
              <Button variant="outline" className="w-full justify-start" onClick={() => setShowSchedule(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Schedule meeting
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Link2 className="h-4 w-4 mr-2" />
                Share availability
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Settings className="h-4 w-4 mr-2" />
                Calendar settings
              </Button>
            </div>

            <Separator className="my-6" />

            <h2 className="font-semibold mb-4">Connected Calendars</h2>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span className="text-sm">damon@example.com</span>
                </div>
                <Badge variant="secondary">Primary</Badge>
              </div>
            </div>
          </div>
        </div>

        <PrepBriefSheet event={selectedEvent} open={!!selectedEvent} onClose={() => setSelectedEvent(null)} />
        <ScheduleMeetingSheet open={showSchedule} onClose={() => setShowSchedule(false)} />
      </>
    </TooltipProvider>
  )
}
