'use client'

import { useState } from 'react'
import {
  Mail,
  Phone,
  Building2,
  Globe,
  MapPin,
  Calendar,
  Clock,
  ExternalLink,
  Edit,
  MoreHorizontal,
  Linkedin,
  Twitter,
  Users,
  Briefcase,
  DollarSign,
  TrendingUp,
  MessageSquare,
  Video,
  FileText,
  ChevronRight,
  Star,
  StarOff,
  Merge,
  Trash2,
  RefreshCw,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Link2,
  Plus,
  ArrowUpRight,
  Send,
  Activity,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { AppShellHeader } from '@/components/layout/app-shell'

// Mock contact data with enrichment
const mockContact = {
  id: '1',
  name: 'Sarah Chen',
  email: 'sarah@techstart.io',
  phone: '+1 (415) 555-0123',
  title: 'VP of Engineering',
  company: 'TechStart Inc',
  location: 'San Francisco, CA',
  timezone: 'PST (UTC-8)',
  avatar: null,
  starred: true,
  createdAt: 'Jan 5, 2025',
  lastActivity: '2 hours ago',

  // Enrichment data (from Clearbit/Apollo)
  enrichment: {
    source: 'Clearbit',
    lastUpdated: 'Jan 10, 2025',
    confidence: 92,
    linkedin: 'linkedin.com/in/sarahchen',
    twitter: '@sarahchen_tech',
    bio: 'Engineering leader focused on scaling teams and building great products. Previously at Stripe and Google.',
    education: 'Stanford University, MS Computer Science',
    previousCompanies: ['Stripe', 'Google', 'Meta'],
    skills: ['Engineering Management', 'System Design', 'Product Strategy', 'Team Building'],
  },

  // Company enrichment
  companyEnrichment: {
    founded: '2021',
    employees: '50-100',
    funding: '$12M Series A',
    industry: 'B2B SaaS',
    techStack: ['React', 'Node.js', 'PostgreSQL', 'AWS'],
    description: 'TechStart builds developer tools for modern engineering teams.',
  },

  // Linked entities
  linkedTo: {
    leads: [{ id: '1', name: 'TechStart Web App Project', stage: 'Proposal Sent', value: 15000 }],
    clients: [{ id: '1', name: 'TechStart Inc', type: 'Prepaid', status: 'Active' }],
    projects: [{ id: '1', name: 'TechStart Portal', status: 'In Progress' }],
  },

  // Communication stats
  stats: {
    totalEmails: 47,
    emailsSent: 23,
    emailsReceived: 24,
    avgResponseTime: '2.3 hours',
    meetings: 5,
    lastMeeting: 'Jan 8, 2025',
  },
}

// Mock activity timeline
const mockTimeline = [
  {
    id: '1',
    type: 'email_received',
    title: 'Email received',
    description: 'Re: Project Proposal Discussion',
    preview: 'Thanks for sending the proposal! I have a few questions about the timeline...',
    timestamp: '2 hours ago',
    icon: Mail,
  },
  {
    id: '2',
    type: 'email_sent',
    title: 'Email sent',
    description: 'Project Proposal Discussion',
    preview: 'Hi Sarah, Attached is our proposal for the web application project...',
    timestamp: 'Yesterday',
    icon: Send,
  },
  {
    id: '3',
    type: 'meeting',
    title: 'Discovery call',
    description: '45 min · Google Meet',
    preview: 'Discussed requirements, timeline, and budget constraints.',
    timestamp: 'Jan 8, 2025',
    icon: Video,
  },
  {
    id: '4',
    type: 'note',
    title: 'Note added',
    description: 'By Damon Bodine',
    preview: 'Sarah mentioned they have a hard deadline of March 15 for launch.',
    timestamp: 'Jan 8, 2025',
    icon: FileText,
  },
  {
    id: '5',
    type: 'lead_created',
    title: 'Lead created',
    description: 'TechStart Web App Project',
    preview: 'Source: Website contact form',
    timestamp: 'Jan 5, 2025',
    icon: Plus,
  },
]

// Enrichment badge component
function EnrichmentBadge({ source, confidence }: { source: string; confidence: number }) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <Sparkles className="h-3 w-3 text-violet-500" />
      <span>Enriched via {source}</span>
      <span>·</span>
      <span>{confidence}% confidence</span>
    </div>
  )
}

// Timeline item component
function TimelineItem({ item }: { item: typeof mockTimeline[0] }) {
  const Icon = item.icon
  return (
    <div className="flex gap-3 group">
      <div className="flex flex-col items-center">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1 w-px bg-border mt-2" />
      </div>
      <div className="flex-1 pb-6">
        <div className="flex items-center justify-between">
          <p className="font-medium text-sm">{item.title}</p>
          <span className="text-xs text-muted-foreground">{item.timestamp}</span>
        </div>
        <p className="text-sm text-muted-foreground">{item.description}</p>
        {item.preview && (
          <p className="text-sm mt-1 line-clamp-2">{item.preview}</p>
        )}
        <Button variant="ghost" size="sm" className="mt-1 -ml-2 h-7 opacity-0 group-hover:opacity-100 transition-opacity">
          View details
          <ChevronRight className="h-3 w-3 ml-1" />
        </Button>
      </div>
    </div>
  )
}

// Main contact detail page
export default function ContactDetailWireframePage() {
  const [activeTab, setActiveTab] = useState('overview')
  const contact = mockContact

  return (
    <TooltipProvider>
      <>
        <AppShellHeader>
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-4">
              <Avatar className="h-12 w-12">
                <AvatarFallback className="text-lg">
                  {contact.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-semibold tracking-tight">{contact.name}</h1>
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    {contact.starred ? (
                      <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                    ) : (
                      <StarOff className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-muted-foreground">
                  {contact.title} at {contact.company}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <Mail className="h-4 w-4 mr-2" />
                Email
              </Button>
              <Button variant="outline" size="sm">
                <Video className="h-4 w-4 mr-2" />
                Schedule Meeting
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit contact
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh enrichment
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Merge className="h-4 w-4 mr-2" />
                    Merge with duplicate
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete contact
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </AppShellHeader>

        <div className="p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="emails">Emails</TabsTrigger>
              <TabsTrigger value="meetings">Meetings</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-6">
              <div className="grid grid-cols-3 gap-6">
                {/* Left column - Contact info */}
                <div className="space-y-6">
                  {/* Basic info card */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Contact Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-3">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <a href={`mailto:${contact.email}`} className="text-sm hover:underline">
                          {contact.email}
                        </a>
                      </div>
                      <div className="flex items-center gap-3">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{contact.phone}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{contact.company}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{contact.location}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{contact.timezone}</span>
                      </div>
                      <Separator className="my-3" />
                      <div className="flex items-center gap-3">
                        <Linkedin className="h-4 w-4 text-[#0A66C2]" />
                        <a href="#" className="text-sm hover:underline flex items-center gap-1">
                          {contact.enrichment.linkedin}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                      <div className="flex items-center gap-3">
                        <Twitter className="h-4 w-4 text-[#1DA1F2]" />
                        <a href="#" className="text-sm hover:underline flex items-center gap-1">
                          {contact.enrichment.twitter}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Linked entities */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Linked To</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {contact.linkedTo.leads.map(lead => (
                        <div key={lead.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted cursor-pointer">
                          <div className="flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">{lead.name}</p>
                              <p className="text-xs text-muted-foreground">{lead.stage}</p>
                            </div>
                          </div>
                          <Badge variant="outline">${lead.value.toLocaleString()}</Badge>
                        </div>
                      ))}
                      {contact.linkedTo.clients.map(client => (
                        <div key={client.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted cursor-pointer">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">{client.name}</p>
                              <p className="text-xs text-muted-foreground">{client.type}</p>
                            </div>
                          </div>
                          <Badge variant="secondary">{client.status}</Badge>
                        </div>
                      ))}
                      {contact.linkedTo.projects.map(project => (
                        <div key={project.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted cursor-pointer">
                          <div className="flex items-center gap-2">
                            <Briefcase className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">{project.name}</p>
                              <p className="text-xs text-muted-foreground">{project.status}</p>
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      ))}
                      <Button variant="outline" size="sm" className="w-full mt-2">
                        <Link2 className="h-4 w-4 mr-2" />
                        Link to entity...
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                {/* Middle column - Enrichment */}
                <div className="space-y-6">
                  {/* Person enrichment */}
                  <Card className="border-violet-500/20 bg-gradient-to-br from-violet-500/5 to-purple-500/5">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-violet-500" />
                          Person Enrichment
                        </CardTitle>
                        <Button variant="ghost" size="sm" className="h-7">
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Refresh
                        </Button>
                      </div>
                      <EnrichmentBadge source={contact.enrichment.source} confidence={contact.enrichment.confidence} />
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Bio</p>
                        <p className="text-sm">{contact.enrichment.bio}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Education</p>
                        <p className="text-sm">{contact.enrichment.education}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Previous Companies</p>
                        <div className="flex flex-wrap gap-1">
                          {contact.enrichment.previousCompanies.map(company => (
                            <Badge key={company} variant="secondary">{company}</Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Skills</p>
                        <div className="flex flex-wrap gap-1">
                          {contact.enrichment.skills.map(skill => (
                            <Badge key={skill} variant="outline">{skill}</Badge>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Company enrichment */}
                  <Card className="border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-cyan-500/5">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-blue-500" />
                        Company: {contact.company}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm">{contact.companyEnrichment.description}</p>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">Founded</p>
                          <p className="text-sm font-medium">{contact.companyEnrichment.founded}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">Employees</p>
                          <p className="text-sm font-medium">{contact.companyEnrichment.employees}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">Funding</p>
                          <p className="text-sm font-medium text-green-600">{contact.companyEnrichment.funding}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">Industry</p>
                          <p className="text-sm font-medium">{contact.companyEnrichment.industry}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Tech Stack</p>
                        <div className="flex flex-wrap gap-1">
                          {contact.companyEnrichment.techStack.map(tech => (
                            <Badge key={tech} variant="outline">{tech}</Badge>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Right column - Stats & Timeline */}
                <div className="space-y-6">
                  {/* Communication stats */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Communication Stats</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center p-3 rounded-lg bg-muted/50">
                          <p className="text-2xl font-bold">{contact.stats.totalEmails}</p>
                          <p className="text-xs text-muted-foreground">Total emails</p>
                        </div>
                        <div className="text-center p-3 rounded-lg bg-muted/50">
                          <p className="text-2xl font-bold">{contact.stats.meetings}</p>
                          <p className="text-xs text-muted-foreground">Meetings</p>
                        </div>
                        <div className="text-center p-3 rounded-lg bg-muted/50">
                          <p className="text-2xl font-bold">{contact.stats.avgResponseTime}</p>
                          <p className="text-xs text-muted-foreground">Avg response</p>
                        </div>
                        <div className="text-center p-3 rounded-lg bg-muted/50">
                          <p className="text-2xl font-bold">{contact.stats.emailsSent}</p>
                          <p className="text-xs text-muted-foreground">Emails sent</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Recent activity */}
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">Recent Activity</CardTitle>
                        <Button variant="ghost" size="sm" onClick={() => setActiveTab('activity')}>
                          View all
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-0">
                        {mockTimeline.slice(0, 3).map(item => (
                          <TimelineItem key={item.id} item={item} />
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="activity" className="mt-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Activity Timeline</CardTitle>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm">
                        <FileText className="h-4 w-4 mr-2" />
                        Add Note
                      </Button>
                      <Button variant="outline" size="sm">
                        <Activity className="h-4 w-4 mr-2" />
                        Log Activity
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[500px] pr-4">
                    {mockTimeline.map(item => (
                      <TimelineItem key={item.id} item={item} />
                    ))}
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="emails" className="mt-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Email History</CardTitle>
                    <Button>
                      <Mail className="h-4 w-4 mr-2" />
                      Compose
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[1, 2, 3, 4, 5].map(i => (
                      <div key={i} className="flex items-center gap-4 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
                        <div className={`w-2 h-2 rounded-full ${i === 1 ? 'bg-blue-500' : 'bg-muted'}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">
                              {i % 2 === 0 ? 'You' : contact.name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {i === 1 ? '2 hours ago' : `Jan ${10 - i}, 2025`}
                            </span>
                          </div>
                          <p className="text-sm font-medium truncate">Re: Project Proposal Discussion</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {i % 2 === 0
                              ? 'Hi Sarah, Attached is our proposal for the web application...'
                              : 'Thanks for sending the proposal! I have a few questions...'}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="meetings" className="mt-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Meetings</CardTitle>
                    <Button>
                      <Video className="h-4 w-4 mr-2" />
                      Schedule Meeting
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="flex items-center gap-4 p-4 rounded-lg border">
                        <div className="flex flex-col items-center justify-center w-14 h-14 rounded-lg bg-muted">
                          <span className="text-lg font-bold">{8 - i * 2}</span>
                          <span className="text-xs text-muted-foreground">Jan</span>
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{i === 1 ? 'Discovery Call' : i === 2 ? 'Requirements Review' : 'Initial Contact'}</p>
                          <p className="text-sm text-muted-foreground">
                            {i === 1 ? '45 min' : '30 min'} · Google Meet
                          </p>
                        </div>
                        <Badge variant={i === 1 ? 'default' : 'secondary'}>
                          {i === 1 ? 'Completed' : 'Past'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notes" className="mt-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Notes</CardTitle>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Note
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[1, 2].map(i => (
                      <div key={i} className="p-4 rounded-lg border">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="text-xs">DB</AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium">Damon Bodine</span>
                          </div>
                          <span className="text-xs text-muted-foreground">Jan {8 - i}, 2025</span>
                        </div>
                        <p className="text-sm">
                          {i === 1
                            ? 'Sarah mentioned they have a hard deadline of March 15 for launch. Need to factor this into our proposal timeline.'
                            : 'Great call! Sarah is the key decision maker. They have budget approved and are evaluating 2-3 vendors.'}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </>
    </TooltipProvider>
  )
}
