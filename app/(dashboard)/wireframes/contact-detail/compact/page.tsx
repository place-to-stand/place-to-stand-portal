'use client'

import {
  Mail,
  Phone,
  Building2,
  Calendar,
  FileText,
  Clock,
  Sparkles,
  ChevronRight,
  MoreHorizontal,
  ArrowLeft,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const contact = {
  name: 'Jennifer Adams',
  title: 'VP of Product',
  company: 'Acme Corp',
  email: 'jadams@acmecorp.com',
  phone: '+1 (555) 123-4567',
  score: 92,
  tags: ['Decision Maker', 'High Value'],
}

const activities = [
  { type: 'email', title: 'Email sent', time: '2 days ago' },
  { type: 'meeting', title: 'Discovery call', time: '1 week ago' },
  { type: 'note', title: 'Note added', time: '1 week ago' },
  { type: 'email', title: 'Introduction email', time: '2 weeks ago' },
]

export default function ContactDetailCompactPage() {
  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <div className="border-b px-4 py-3 flex items-center gap-4 bg-background">
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Avatar className="h-10 w-10">
          <AvatarFallback>JA</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{contact.name}</span>
            <Badge variant="secondary" className="text-xs">{contact.score}%</Badge>
          </div>
          <div className="text-sm text-muted-foreground flex items-center gap-1">
            <Building2 className="h-3 w-3" />
            {contact.company} • {contact.title}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8"><Mail className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8"><Phone className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8"><Calendar className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="px-4 py-2 border-b flex items-center gap-4 text-sm bg-muted/30">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-500" />
          <span className="text-muted-foreground">Score:</span>
          <Progress value={contact.score} className="w-16 h-1.5" />
          <span className="font-medium">{contact.score}%</span>
        </div>
        <Separator orientation="vertical" className="h-4" />
        <span className="text-muted-foreground">Last contact: 2 days ago</span>
        <Separator orientation="vertical" className="h-4" />
        <span className="text-muted-foreground">24 interactions</span>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="activity" className="flex-1 flex flex-col">
        <TabsList className="w-full justify-start rounded-none border-b bg-transparent h-10 p-0 px-4">
          <TabsTrigger value="activity" className="rounded-none data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary h-10">
            Activity
          </TabsTrigger>
          <TabsTrigger value="details" className="rounded-none data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary h-10">
            Details
          </TabsTrigger>
          <TabsTrigger value="emails" className="rounded-none data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary h-10">
            Emails
          </TabsTrigger>
          <TabsTrigger value="notes" className="rounded-none data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary h-10">
            Notes
          </TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1">
          <TabsContent value="activity" className="m-0 p-4">
            <div className="space-y-1">
              {activities.map((activity, idx) => (
                <div key={idx} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer">
                  <div className="p-1.5 rounded bg-muted">
                    {activity.type === 'email' && <Mail className="h-3.5 w-3.5" />}
                    {activity.type === 'meeting' && <Calendar className="h-3.5 w-3.5" />}
                    {activity.type === 'note' && <FileText className="h-3.5 w-3.5" />}
                  </div>
                  <span className="flex-1 text-sm">{activity.title}</span>
                  <span className="text-xs text-muted-foreground">{activity.time}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="details" className="m-0 p-4">
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Email</span>
                <span>{contact.email}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Phone</span>
                <span>{contact.phone}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Company</span>
                <span>{contact.company}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Title</span>
                <span>{contact.title}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">Tags</span>
                <div className="flex gap-1">
                  {contact.tags.map(tag => (
                    <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="emails" className="m-0 p-4">
            <div className="text-center text-muted-foreground py-8">
              <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">4 emails exchanged</p>
            </div>
          </TabsContent>

          <TabsContent value="notes" className="m-0 p-4">
            <div className="text-center text-muted-foreground py-8">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">2 notes</p>
            </div>
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  )
}
