'use client'

import {
  Mail,
  Phone,
  Globe,
  Building2,
  Calendar,
  MessageSquare,
  FileText,
  Clock,
  MapPin,
  Linkedin,
  Twitter,
  MoreHorizontal,
  Plus,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'

const contact = {
  name: 'Jennifer Adams',
  title: 'VP of Product',
  company: 'Acme Corp',
  email: 'jadams@acmecorp.com',
  phone: '+1 (555) 123-4567',
  location: 'San Francisco, CA',
  website: 'acmecorp.com',
  linkedin: 'linkedin.com/in/jadams',
  twitter: '@jadams',
  tags: ['Decision Maker', 'High Value', 'Active'],
}

const enrichment = {
  score: 92,
  engagement: 'High',
  lastContact: '2 days ago',
  totalInteractions: 24,
}

const activities = [
  { type: 'email', title: 'Email sent', description: 'Q1 planning follow-up', time: '2 days ago' },
  { type: 'meeting', title: 'Meeting completed', description: '30 min discovery call', time: '1 week ago' },
  { type: 'note', title: 'Note added', description: 'Very interested in mobile features', time: '1 week ago' },
]

export default function ContactDetailCardsPage() {
  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto grid grid-cols-3 gap-6">
        {/* Left Column - Profile */}
        <div className="space-y-6">
          {/* Profile Card */}
          <Card>
            <CardContent className="pt-6">
              <div className="text-center mb-4">
                <Avatar className="h-20 w-20 mx-auto mb-4">
                  <AvatarFallback className="text-2xl">JA</AvatarFallback>
                </Avatar>
                <h1 className="text-xl font-bold">{contact.name}</h1>
                <p className="text-muted-foreground">{contact.title}</p>
                <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground mt-1">
                  <Building2 className="h-4 w-4" />
                  {contact.company}
                </div>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {contact.tags.map(tag => (
                  <Badge key={tag} variant="secondary">{tag}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" className="justify-start">
                <Mail className="h-4 w-4 mr-2" />Email
              </Button>
              <Button variant="outline" size="sm" className="justify-start">
                <Phone className="h-4 w-4 mr-2" />Call
              </Button>
              <Button variant="outline" size="sm" className="justify-start">
                <Calendar className="h-4 w-4 mr-2" />Schedule
              </Button>
              <Button variant="outline" size="sm" className="justify-start">
                <FileText className="h-4 w-4 mr-2" />Note
              </Button>
            </CardContent>
          </Card>

          {/* Contact Info */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Contact Info</CardTitle>
            </CardHeader>
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
                <MapPin className="h-4 w-4 text-muted-foreground" />
                {contact.location}
              </div>
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                {contact.website}
              </div>
              <div className="flex items-center gap-2">
                <Linkedin className="h-4 w-4 text-muted-foreground" />
                {contact.linkedin}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Center Column - Enrichment & Activity */}
        <div className="col-span-2 space-y-6">
          {/* AI Enrichment */}
          <Card className="bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/30 border-violet-200">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-violet-500" />
                <CardTitle className="text-sm">AI Enrichment</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center p-3 bg-white/50 dark:bg-neutral-900/50 rounded-lg">
                  <div className="text-2xl font-bold text-violet-600">{enrichment.score}%</div>
                  <div className="text-xs text-muted-foreground">Contact Score</div>
                </div>
                <div className="text-center p-3 bg-white/50 dark:bg-neutral-900/50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{enrichment.engagement}</div>
                  <div className="text-xs text-muted-foreground">Engagement</div>
                </div>
                <div className="text-center p-3 bg-white/50 dark:bg-neutral-900/50 rounded-lg">
                  <div className="text-2xl font-bold">{enrichment.lastContact}</div>
                  <div className="text-xs text-muted-foreground">Last Contact</div>
                </div>
                <div className="text-center p-3 bg-white/50 dark:bg-neutral-900/50 rounded-lg">
                  <div className="text-2xl font-bold">{enrichment.totalInteractions}</div>
                  <div className="text-xs text-muted-foreground">Interactions</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Activity Timeline */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Activity Timeline</CardTitle>
                <Button variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Log Activity
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-4">
                  {activities.map((activity, idx) => (
                    <div key={idx} className="flex items-start gap-4 p-4 rounded-lg border">
                      <div className="p-2 rounded-full bg-muted">
                        {activity.type === 'email' && <Mail className="h-4 w-4" />}
                        {activity.type === 'meeting' && <Calendar className="h-4 w-4" />}
                        {activity.type === 'note' && <FileText className="h-4 w-4" />}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{activity.title}</div>
                        <div className="text-sm text-muted-foreground">{activity.description}</div>
                      </div>
                      <div className="text-xs text-muted-foreground">{activity.time}</div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
