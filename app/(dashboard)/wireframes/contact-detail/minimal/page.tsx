'use client'

import {
  Mail,
  Phone,
  Building2,
  Calendar,
  ArrowLeft,
  MoreHorizontal,
  Sparkles,
  MessageSquare,
  FileText,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'

const contact = {
  name: 'Jennifer Adams',
  initials: 'JA',
  title: 'VP of Product',
  company: 'Acme Corp',
  email: 'jadams@acmecorp.com',
  phone: '+1 (555) 123-4567',
  score: 92,
}

const quickStats = [
  { label: 'Score', value: '92%', color: 'text-violet-600' },
  { label: 'Emails', value: '12', color: 'text-blue-600' },
  { label: 'Meetings', value: '4', color: 'text-green-600' },
]

const recentActivity = [
  { icon: Mail, label: 'Email sent', time: '2 days ago' },
  { icon: Calendar, label: 'Meeting', time: '1 week ago' },
  { icon: FileText, label: 'Note added', time: '1 week ago' },
]

export default function ContactDetailMinimalPage() {
  return (
    <div className="h-[calc(100vh-4rem)] bg-muted/30">
      <div className="max-w-lg mx-auto h-full flex flex-col bg-white dark:bg-neutral-900">
        {/* Header */}
        <div className="p-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <span className="font-semibold flex-1">Contact</span>
          <Button variant="ghost" size="icon" className="rounded-full">
            <MoreHorizontal className="h-5 w-5" />
          </Button>
        </div>

        <ScrollArea className="flex-1">
          {/* Profile */}
          <div className="text-center px-6 py-8">
            <Avatar className="h-24 w-24 mx-auto mb-4">
              <AvatarFallback className="text-3xl bg-gradient-to-br from-violet-500 to-blue-500 text-white">
                {contact.initials}
              </AvatarFallback>
            </Avatar>
            <h1 className="text-2xl font-bold mb-1">{contact.name}</h1>
            <p className="text-muted-foreground mb-2">{contact.title}</p>
            <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
              <Building2 className="h-4 w-4" />
              {contact.company}
            </div>
            <div className="flex items-center justify-center gap-1 mt-2">
              <Sparkles className="h-4 w-4 text-violet-500" />
              <span className="text-sm font-medium text-violet-600">{contact.score}% match</span>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex justify-center gap-6 px-6 py-4">
            <button className="flex flex-col items-center gap-2">
              <div className="p-4 rounded-2xl bg-blue-100 dark:bg-blue-900/30 text-blue-600">
                <Mail className="h-6 w-6" />
              </div>
              <span className="text-xs">Email</span>
            </button>
            <button className="flex flex-col items-center gap-2">
              <div className="p-4 rounded-2xl bg-green-100 dark:bg-green-900/30 text-green-600">
                <Phone className="h-6 w-6" />
              </div>
              <span className="text-xs">Call</span>
            </button>
            <button className="flex flex-col items-center gap-2">
              <div className="p-4 rounded-2xl bg-orange-100 dark:bg-orange-900/30 text-orange-600">
                <Calendar className="h-6 w-6" />
              </div>
              <span className="text-xs">Schedule</span>
            </button>
            <button className="flex flex-col items-center gap-2">
              <div className="p-4 rounded-2xl bg-purple-100 dark:bg-purple-900/30 text-purple-600">
                <MessageSquare className="h-6 w-6" />
              </div>
              <span className="text-xs">Chat</span>
            </button>
          </div>

          {/* Stats */}
          <div className="mx-6 p-4 rounded-2xl bg-muted/50 flex justify-around">
            {quickStats.map((stat, idx) => (
              <div key={idx} className="text-center">
                <div className={`text-xl font-bold ${stat.color}`}>{stat.value}</div>
                <div className="text-xs text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Contact Info */}
          <div className="px-6 py-6">
            <h3 className="font-semibold mb-4">Contact Info</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="text-xs text-muted-foreground">Email</div>
                  <div className="text-sm">{contact.email}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                <Phone className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="text-xs text-muted-foreground">Phone</div>
                  <div className="text-sm">{contact.phone}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="px-6 pb-6">
            <h3 className="font-semibold mb-4">Recent Activity</h3>
            <div className="space-y-3">
              {recentActivity.map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                  <item.icon className="h-5 w-5 text-muted-foreground" />
                  <span className="flex-1 text-sm">{item.label}</span>
                  <span className="text-xs text-muted-foreground">{item.time}</span>
                </div>
              ))}
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
