'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Mail,
  Phone,
  Building2,
  Globe,
  Calendar,
  Clock,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Target,
  Sparkles,
  Send,
  Reply,
  FileText,
  Video,
  Users,
  DollarSign,
  Flame,
  ThermometerSun,
  Snowflake,
  ChevronRight,
  ExternalLink,
  Plus,
  MoreHorizontal,
  Filter,
  Search,
  RefreshCw,
  Star,
  X,
  MapPin,
  Briefcase,
  Activity,
  Brain,
  ArrowUpRight,
  MessageSquare,
  UserPlus,
  FolderKanban,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Sheet,
  SheetContent,
  SheetDescription,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { AppShellHeader } from '@/components/layout/app-shell'
import { cn } from '@/lib/utils'

// ============================================================================
// MOCK DATA
// ============================================================================

const STAGE_CONFIG = {
  new: { label: 'New', token: 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300' },
  active: { label: 'Active', token: 'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300' },
  proposal: { label: 'Proposal Sent', token: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300' },
  on_ice: { label: 'On Ice', token: 'bg-slate-100 text-slate-700 dark:bg-slate-700/50 dark:text-slate-300' },
  won: { label: 'Closed Won', token: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' },
  lost: { label: 'Closed Lost', token: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' },
}

const mockLeads = [
  {
    id: '1',
    name: 'Sarah Chen',
    company: 'TechStart Inc',
    email: 'sarah@techstart.io',
    phone: '+1 (415) 555-0123',
    website: 'techstart.io',
    stage: 'proposal' as const,
    score: 82,
    priority: 'hot' as const,
    value: 15000,
    probability: 72,
    daysInStage: 3,
    lastActivity: '2 hours ago',
    nextAction: 'Reply to pricing questions',
    nextActionUrgent: true,
    assignee: { name: 'Damon Bodine', initials: 'DB', email: 'damon@example.com' },
    source: 'Website',
    createdAt: 'Jan 5, 2025',
    signals: [
      { type: 'positive', text: 'Fast response time (< 4 hrs)' },
      { type: 'positive', text: 'CTO involved in thread' },
      { type: 'positive', text: 'Asked detailed technical questions' },
      { type: 'warning', text: 'Mentioned competitor (AgencyCo)' },
    ],
    enrichment: {
      funding: 'Series A ($5M)',
      employees: '25-50',
      industry: 'B2B SaaS, Fintech',
      location: 'San Francisco, CA',
      techStack: ['React', 'Node.js', 'AWS'],
      recentNews: 'TechStart launches new analytics product',
    },
    threadCount: 4,
    meetingCount: 1,
  },
  {
    id: '2',
    name: 'Robert Kim',
    company: 'DataFlow Labs',
    email: 'rkim@dataflow.com',
    phone: '+1 (212) 555-0456',
    website: 'dataflow.com',
    stage: 'proposal' as const,
    score: 58,
    priority: 'warm' as const,
    value: 25000,
    probability: 45,
    daysInStage: 8,
    lastActivity: '5 days ago',
    nextAction: 'Follow up on proposal',
    nextActionUrgent: true,
    assignee: { name: 'Mike Rodriguez', initials: 'MR', email: 'mike@example.com' },
    source: 'Referral',
    createdAt: 'Dec 28, 2024',
    signals: [
      { type: 'positive', text: 'High-value opportunity' },
      { type: 'warning', text: 'No response to proposal (5 days)' },
      { type: 'negative', text: 'Slowing momentum' },
    ],
    enrichment: {
      funding: 'Series B ($15M)',
      employees: '50-100',
      industry: 'Data Analytics',
      location: 'New York, NY',
      techStack: ['Python', 'PostgreSQL', 'GCP'],
      recentNews: null,
    },
    threadCount: 3,
    meetingCount: 2,
  },
  {
    id: '3',
    name: 'Lisa Park',
    company: 'Innovate Co',
    email: 'lpark@innovate.co',
    phone: '+1 (512) 555-0789',
    website: 'innovate.co',
    stage: 'active' as const,
    score: 71,
    priority: 'warm' as const,
    value: 18000,
    probability: 55,
    daysInStage: 5,
    lastActivity: '1 day ago',
    nextAction: 'Schedule discovery call',
    nextActionUrgent: false,
    assignee: { name: 'Sarah Wilson', initials: 'SW', email: 'sarah@example.com' },
    source: 'Website',
    createdAt: 'Jan 2, 2025',
    signals: [
      { type: 'positive', text: 'Engaged in discovery call' },
      { type: 'positive', text: 'Budget confirmed' },
    ],
    enrichment: {
      funding: 'Bootstrapped',
      employees: '10-25',
      industry: 'E-commerce',
      location: 'Austin, TX',
      techStack: ['Shopify', 'React'],
      recentNews: null,
    },
    threadCount: 2,
    meetingCount: 1,
  },
  {
    id: '4',
    name: 'James Wilson',
    company: 'CloudNine Tech',
    email: 'jwilson@cloudnine.io',
    phone: null,
    website: 'cloudnine.io',
    stage: 'new' as const,
    score: 45,
    priority: 'cold' as const,
    value: 8000,
    probability: 25,
    daysInStage: 2,
    lastActivity: '2 days ago',
    nextAction: 'Send intro email',
    nextActionUrgent: false,
    assignee: null,
    source: 'Event',
    createdAt: 'Jan 9, 2025',
    signals: [
      { type: 'warning', text: '"Just exploring options" in initial email' },
    ],
    enrichment: {
      funding: 'Seed',
      employees: '5-10',
      industry: 'Cloud Services',
      location: 'Seattle, WA',
      techStack: ['AWS', 'Kubernetes'],
      recentNews: null,
    },
    threadCount: 1,
    meetingCount: 0,
  },
  {
    id: '5',
    name: 'Emily Zhang',
    company: 'RetailMax',
    email: 'ezhang@retailmax.com',
    phone: '+1 (303) 555-1234',
    website: 'retailmax.com',
    stage: 'active' as const,
    score: 67,
    priority: 'warm' as const,
    value: 22000,
    probability: 50,
    daysInStage: 7,
    lastActivity: '3 days ago',
    nextAction: 'Send proposal',
    nextActionUrgent: false,
    assignee: { name: 'Damon Bodine', initials: 'DB', email: 'damon@example.com' },
    source: 'Referral',
    createdAt: 'Jan 1, 2025',
    signals: [
      { type: 'positive', text: 'Clear project requirements' },
      { type: 'positive', text: 'Q1 deadline mentioned' },
    ],
    enrichment: {
      funding: 'Series C ($50M)',
      employees: '200-500',
      industry: 'Retail Tech',
      location: 'Denver, CO',
      techStack: ['React', 'Ruby on Rails', 'AWS'],
      recentNews: 'RetailMax expands to European markets',
    },
    threadCount: 5,
    meetingCount: 2,
  },
  {
    id: '6',
    name: 'Marcus Johnson',
    company: 'FinServ Pro',
    email: 'mjohnson@finservpro.com',
    phone: '+1 (617) 555-5678',
    website: 'finservpro.com',
    stage: 'on_ice' as const,
    score: 52,
    priority: 'cold' as const,
    value: 35000,
    probability: 20,
    daysInStage: 21,
    lastActivity: '3 weeks ago',
    nextAction: 'Check in Q2',
    nextActionUrgent: false,
    assignee: { name: 'Mike Rodriguez', initials: 'MR', email: 'mike@example.com' },
    source: 'Website',
    createdAt: 'Nov 15, 2024',
    signals: [
      { type: 'warning', text: '"Budget freeze until Q2"' },
      { type: 'negative', text: 'No engagement for 3 weeks' },
    ],
    enrichment: {
      funding: 'Private Equity',
      employees: '100-200',
      industry: 'Financial Services',
      location: 'Boston, MA',
      techStack: ['Java', '.NET', 'Azure'],
      recentNews: null,
    },
    threadCount: 4,
    meetingCount: 1,
  },
]

const mockSuggestedActions = [
  { id: '1', leadId: '1', title: 'Reply to pricing questions', urgent: true, hasDraft: true },
  { id: '2', leadId: '2', title: 'Follow up on proposal (5 days)', urgent: true, hasDraft: true },
  { id: '3', leadId: '5', title: 'Send proposal to RetailMax', urgent: false, hasDraft: false },
]

const mockTimeline = [
  { id: '1', type: 'email_in', title: 'Email from Sarah Chen', preview: 'Thanks for the proposal! Questions about pricing...', time: '2 hours ago', unread: true },
  { id: '2', type: 'email_out', title: 'Proposal sent', preview: 'Attached is our proposal for the TechStart project...', time: 'Jan 15, 2:30 PM', unread: false },
  { id: '3', type: 'meeting', title: 'Discovery call', preview: '45 min call with Sarah Chen (CTO)', time: 'Jan 12, 10:00 AM', unread: false },
  { id: '4', type: 'email_in', title: 'Email from Sarah Chen', preview: 'Great chatting! Yes, let\'s schedule a follow-up...', time: 'Jan 8, 4:15 PM', unread: false },
  { id: '5', type: 'email_out', title: 'Initial outreach', preview: 'Thank you for reaching out! I\'d love to learn more...', time: 'Jan 6, 9:00 AM', unread: false },
  { id: '6', type: 'created', title: 'Lead created', preview: 'Via website contact form', time: 'Jan 5, 3:22 PM', unread: false },
]

// ============================================================================
// COMPONENTS
// ============================================================================

function PriorityIndicator({ priority }: { priority: 'hot' | 'warm' | 'cold' }) {
  const config = {
    hot: { icon: Flame, className: 'text-red-500', label: 'Hot' },
    warm: { icon: ThermometerSun, className: 'text-amber-500', label: 'Warm' },
    cold: { icon: Snowflake, className: 'text-blue-400', label: 'Cold' },
  }
  const { icon: Icon, className, label } = config[priority]

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <Icon className={cn('h-4 w-4', className)} />
        </TooltipTrigger>
        <TooltipContent>{label} lead</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 70
    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
    : score >= 50
    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
    : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'

  return (
    <Badge variant="secondary" className={cn('text-xs font-semibold tabular-nums', color)}>
      {score}
    </Badge>
  )
}

function SignalItem({ signal }: { signal: { type: string; text: string } }) {
  const config = {
    positive: { icon: CheckCircle2, className: 'text-emerald-600 dark:text-emerald-400' },
    warning: { icon: AlertTriangle, className: 'text-amber-600 dark:text-amber-400' },
    negative: { icon: X, className: 'text-red-600 dark:text-red-400' },
  }
  const { icon: Icon, className } = config[signal.type as keyof typeof config] || config.warning

  return (
    <div className="flex items-start gap-2 text-sm">
      <Icon className={cn('h-4 w-4 mt-0.5 flex-shrink-0', className)} />
      <span className="text-muted-foreground">{signal.text}</span>
    </div>
  )
}

function SuggestedActionsBar() {
  if (mockSuggestedActions.filter(a => a.urgent).length === 0) return null

  return (
    <div className="bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 border-b px-6 py-3">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <Sparkles className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-sm font-medium text-violet-700 dark:text-violet-300">AI Actions</span>
        </div>
        <Separator orientation="vertical" className="h-5" />
        <div className="flex items-center gap-2 overflow-x-auto">
          {mockSuggestedActions.filter(a => a.urgent).map(action => (
            <Button
              key={action.id}
              variant="outline"
              size="sm"
              className="h-7 text-xs bg-white dark:bg-neutral-900 hover:bg-violet-100 dark:hover:bg-violet-900/30 border-violet-200 dark:border-violet-800 gap-1.5 whitespace-nowrap"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
              {action.title}
              {action.hasDraft && (
                <Badge variant="secondary" className="h-4 px-1 text-[10px] ml-1">Draft</Badge>
              )}
            </Button>
          ))}
        </div>
        <Button variant="ghost" size="sm" className="ml-auto text-xs text-muted-foreground">
          View all suggestions
        </Button>
      </div>
    </div>
  )
}

function LeadDetailSheet({
  lead,
  open,
  onClose
}: {
  lead: typeof mockLeads[0] | null
  open: boolean
  onClose: () => void
}) {
  const [activeTab, setActiveTab] = useState('overview')

  if (!lead) return null

  const stageConfig = STAGE_CONFIG[lead.stage]

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex h-full w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        {/* Header */}
        <div className="bg-muted/50 flex-shrink-0 border-b px-6 pt-4 pb-3">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1 pr-10">
              <div className="flex items-center gap-2 mb-1">
                <SheetTitle className="text-lg">{lead.name}</SheetTitle>
                <PriorityIndicator priority={lead.priority} />
              </div>
              <SheetDescription className="flex items-center gap-2">
                <Building2 className="h-3.5 w-3.5" />
                {lead.company}
                <span className="text-muted-foreground/50">·</span>
                <Badge className={cn('text-xs', stageConfig.token)}>{stageConfig.label}</Badge>
              </SheetDescription>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-4 gap-4 mt-4 pt-3 border-t">
            <div className="text-center">
              <div className="text-lg font-bold">{lead.score}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Score</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold">{lead.probability}%</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Probability</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold">${(lead.value / 1000).toFixed(0)}k</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Value</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold">{lead.daysInStage}d</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">In Stage</div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 mt-4">
            <Button size="sm" className="gap-1.5">
              <Mail className="h-3.5 w-3.5" />
              Email
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              Schedule
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Proposal
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>Edit lead</DropdownMenuItem>
                <DropdownMenuItem>Change stage</DropdownMenuItem>
                <DropdownMenuItem>Reassign</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-emerald-600">Convert to client</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-red-600">Archive</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <div className="border-b px-6">
            <TabsList className="h-10 p-0 bg-transparent gap-4">
              <TabsTrigger value="overview" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-0 pb-2 text-sm">
                Overview
              </TabsTrigger>
              <TabsTrigger value="timeline" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-0 pb-2 text-sm">
                Timeline
              </TabsTrigger>
              <TabsTrigger value="compose" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-0 pb-2 text-sm">
                Compose
              </TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="flex-1">
            <TabsContent value="overview" className="m-0 p-6 space-y-6">
              {/* Contact Info */}
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Contact</h4>
                <div className="space-y-1.5 text-sm">
                  <a href={`mailto:${lead.email}`} className="flex items-center gap-2 text-primary hover:underline">
                    <Mail className="h-3.5 w-3.5" />
                    {lead.email}
                  </a>
                  {lead.phone && (
                    <a href={`tel:${lead.phone}`} className="flex items-center gap-2 text-muted-foreground hover:text-primary">
                      <Phone className="h-3.5 w-3.5" />
                      {lead.phone}
                    </a>
                  )}
                  {lead.website && (
                    <a href={`https://${lead.website}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-muted-foreground hover:text-primary">
                      <Globe className="h-3.5 w-3.5" />
                      {lead.website}
                    </a>
                  )}
                </div>
              </div>

              <Separator />

              {/* AI Intelligence */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <Brain className="h-3.5 w-3.5 text-violet-500" />
                    AI Intelligence
                  </h4>
                  <Button variant="ghost" size="sm" className="h-6 text-xs gap-1">
                    <RefreshCw className="h-3 w-3" />
                    Refresh
                  </Button>
                </div>
                <div className="space-y-2">
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Engagement</span>
                      <span className="font-medium">22/25</span>
                    </div>
                    <Progress value={88} className="h-1.5" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Fit</span>
                      <span className="font-medium">18/25</span>
                    </div>
                    <Progress value={72} className="h-1.5" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Intent</span>
                      <span className="font-medium">23/25</span>
                    </div>
                    <Progress value={92} className="h-1.5" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Momentum</span>
                      <span className="font-medium">19/25</span>
                    </div>
                    <Progress value={76} className="h-1.5" />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Signals */}
              <div className="space-y-3">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5" />
                  Detected Signals
                </h4>
                <div className="space-y-2">
                  {lead.signals.map((signal, idx) => (
                    <SignalItem key={idx} signal={signal} />
                  ))}
                </div>
              </div>

              <Separator />

              {/* Company Intel */}
              <div className="space-y-3">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" />
                  Company Intel
                  <Badge variant="outline" className="text-[10px] h-4 ml-auto">Auto-enriched</Badge>
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-xs text-muted-foreground">Funding</span>
                    <div className="font-medium">{lead.enrichment.funding}</div>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Employees</span>
                    <div className="font-medium">{lead.enrichment.employees}</div>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Industry</span>
                    <div className="font-medium">{lead.enrichment.industry}</div>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Location</span>
                    <div className="font-medium">{lead.enrichment.location}</div>
                  </div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Tech Stack</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {lead.enrichment.techStack.map(tech => (
                      <Badge key={tech} variant="secondary" className="text-[10px]">{tech}</Badge>
                    ))}
                  </div>
                </div>
                {lead.enrichment.recentNews && (
                  <div className="p-2 rounded-md bg-muted/50 text-sm">
                    <span className="text-xs text-muted-foreground">Recent News</span>
                    <div>{lead.enrichment.recentNews}</div>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="timeline" className="m-0 p-6">
              <div className="space-y-3">
                {mockTimeline.map((event, idx) => (
                  <div key={event.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={cn(
                        'h-8 w-8 rounded-full flex items-center justify-center',
                        event.type === 'email_in' && 'bg-blue-100 dark:bg-blue-900/50',
                        event.type === 'email_out' && 'bg-emerald-100 dark:bg-emerald-900/50',
                        event.type === 'meeting' && 'bg-violet-100 dark:bg-violet-900/50',
                        event.type === 'created' && 'bg-amber-100 dark:bg-amber-900/50',
                      )}>
                        {event.type === 'email_in' && <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
                        {event.type === 'email_out' && <Send className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
                        {event.type === 'meeting' && <Video className="h-4 w-4 text-violet-600 dark:text-violet-400" />}
                        {event.type === 'created' && <Star className="h-4 w-4 text-amber-600 dark:text-amber-400" />}
                      </div>
                      {idx < mockTimeline.length - 1 && (
                        <div className="w-px h-full bg-border flex-1 my-1" />
                      )}
                    </div>
                    <div className={cn(
                      'flex-1 pb-3 rounded-lg border p-3',
                      event.unread && 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900'
                    )}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm">{event.title}</span>
                        <span className="text-xs text-muted-foreground">{event.time}</span>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">{event.preview}</p>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="compose" className="m-0 p-6 space-y-4">
              {lead.nextActionUrgent && (
                <div className="rounded-lg border p-3 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-4 w-4 text-violet-500" />
                    <span className="font-medium text-sm text-violet-700 dark:text-violet-300">AI Draft Available</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">Response to pricing questions</p>
                  <Button size="sm" className="gap-1">
                    <FileText className="h-3 w-3" />
                    Load Draft
                  </Button>
                </div>
              )}

              <div>
                <label className="text-sm font-medium mb-2 block">To</label>
                <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/30">
                  <Avatar className="h-5 w-5">
                    <AvatarFallback className="text-[10px]">{lead.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm">{lead.name} &lt;{lead.email}&gt;</span>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Subject</label>
                <Input defaultValue={`RE: ${lead.company} Project`} />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Message</label>
                <Textarea className="min-h-[150px] resize-none" placeholder="Write your message..." />
              </div>

              <div className="flex items-center justify-between pt-2">
                <Button variant="ghost" size="sm" className="gap-1">
                  <Sparkles className="h-4 w-4" />
                  AI Assist
                </Button>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm">Save Draft</Button>
                  <Button size="sm" className="gap-1">
                    <Send className="h-4 w-4" />
                    Send
                  </Button>
                </div>
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function LeadsWireframePage() {
  const [selectedLead, setSelectedLead] = useState<typeof mockLeads[0] | null>(null)
  const [stageFilter, setStageFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredLeads = mockLeads.filter(lead => {
    if (stageFilter !== 'all' && lead.stage !== stageFilter) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return lead.name.toLowerCase().includes(q) || lead.company.toLowerCase().includes(q)
    }
    return true
  })

  const stageCounts = {
    all: mockLeads.length,
    new: mockLeads.filter(l => l.stage === 'new').length,
    active: mockLeads.filter(l => l.stage === 'active').length,
    proposal: mockLeads.filter(l => l.stage === 'proposal').length,
    on_ice: mockLeads.filter(l => l.stage === 'on_ice').length,
  }

  const pipelineValue = mockLeads.reduce((sum, l) => sum + l.value, 0)
  const weightedValue = mockLeads.reduce((sum, l) => sum + (l.value * l.probability / 100), 0)

  return (
    <>
      <AppShellHeader>
        <div className="flex items-center justify-between w-full">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
            <p className="text-muted-foreground text-sm">
              {mockLeads.length} leads · ${pipelineValue.toLocaleString()} pipeline · ${Math.round(weightedValue).toLocaleString()} weighted
            </p>
          </div>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Add Lead
          </Button>
        </div>
      </AppShellHeader>

      {/* AI Actions Bar */}
      <SuggestedActionsBar />

      {/* Main Content */}
      <section className="bg-background rounded-xl border shadow-sm mx-6 mb-6">
        {/* Filters */}
        <div className="p-4 border-b flex items-center gap-4">
          <Tabs value={stageFilter} onValueChange={setStageFilter}>
            <TabsList className="h-8">
              <TabsTrigger value="all" className="text-xs h-7 px-3">All ({stageCounts.all})</TabsTrigger>
              <TabsTrigger value="new" className="text-xs h-7 px-3">New ({stageCounts.new})</TabsTrigger>
              <TabsTrigger value="active" className="text-xs h-7 px-3">Active ({stageCounts.active})</TabsTrigger>
              <TabsTrigger value="proposal" className="text-xs h-7 px-3">Proposal ({stageCounts.proposal})</TabsTrigger>
              <TabsTrigger value="on_ice" className="text-xs h-7 px-3">On Ice ({stageCounts.on_ice})</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search leads..."
                className="pl-8 h-8 w-64 text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select defaultValue="score">
              <SelectTrigger className="h-8 w-32 text-xs">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="score">Score</SelectItem>
                <SelectItem value="value">Value</SelectItem>
                <SelectItem value="activity">Last Activity</SelectItem>
                <SelectItem value="created">Created</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Table */}
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="w-[28%]">Lead</TableHead>
              <TableHead className="w-[12%]">Stage</TableHead>
              <TableHead className="w-[8%] text-center">Score</TableHead>
              <TableHead className="w-[10%] text-right">Value</TableHead>
              <TableHead className="w-[14%]">Last Activity</TableHead>
              <TableHead className="w-[16%]">Next Action</TableHead>
              <TableHead className="w-[12%]">Assignee</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLeads.map(lead => {
              const stageConfig = STAGE_CONFIG[lead.stage]
              return (
                <TableRow
                  key={lead.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setSelectedLead(lead)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <PriorityIndicator priority={lead.priority} />
                      <div className="min-w-0">
                        <div className="font-medium flex items-center gap-2">
                          {lead.name}
                          {lead.threadCount > 0 && (
                            <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                              <Mail className="h-3 w-3" />
                              {lead.threadCount}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {lead.company}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={cn('text-xs', stageConfig.token)}>
                      {stageConfig.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <ScoreBadge score={lead.score} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="font-medium">${lead.value.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">{lead.probability}% likely</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{lead.lastActivity}</div>
                    <div className="text-xs text-muted-foreground">{lead.daysInStage}d in stage</div>
                  </TableCell>
                  <TableCell>
                    <div className={cn(
                      'text-sm truncate',
                      lead.nextActionUrgent && 'text-red-600 dark:text-red-400 font-medium'
                    )}>
                      {lead.nextActionUrgent && <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500 mr-1.5 animate-pulse" />}
                      {lead.nextAction}
                    </div>
                  </TableCell>
                  <TableCell>
                    {lead.assignee ? (
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-[10px]">{lead.assignee.initials}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm truncate">{lead.assignee.name.split(' ')[0]}</span>
                      </div>
                    ) : (
                      <Badge variant="outline" className="text-xs">Unassigned</Badge>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>

        {filteredLeads.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            No leads found matching your filters.
          </div>
        )}
      </section>

      {/* Lead Detail Sheet */}
      <LeadDetailSheet
        lead={selectedLead}
        open={!!selectedLead}
        onClose={() => setSelectedLead(null)}
      />
    </>
  )
}
