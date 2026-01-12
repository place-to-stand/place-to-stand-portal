'use client'

import { useState } from 'react'
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
  MessageSquare,
  Users,
  DollarSign,
  Flame,
  ThermometerSun,
  Snowflake,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  Plus,
  MoreHorizontal,
  ArrowRight,
  Zap,
  Brain,
  BarChart3,
  Activity,
  Linkedin,
  Twitter,
  RefreshCw,
  Star,
  X,
  GripVertical,
  Briefcase,
  MapPin,
  Timer,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

// ============================================================================
// MOCK DATA
// ============================================================================

const mockPipelineStats = {
  totalLeads: 24,
  totalValue: 187500,
  weightedValue: 82400,
  avgDaysToClose: 18,
  conversionRate: 34,
  thisMonth: {
    new: 8,
    closed: 3,
    value: 45000,
  },
}

const mockColumns = [
  {
    id: 'new',
    title: 'New Opportunities',
    color: 'bg-sky-500',
    count: 6,
    value: 45000,
  },
  {
    id: 'active',
    title: 'Active',
    color: 'bg-violet-500',
    count: 8,
    value: 72000,
  },
  {
    id: 'proposal',
    title: 'Proposal Sent',
    color: 'bg-amber-500',
    count: 5,
    value: 55000,
  },
  {
    id: 'on_ice',
    title: 'On Ice',
    color: 'bg-slate-400',
    count: 3,
    value: 12000,
  },
  {
    id: 'won',
    title: 'Closed Won',
    color: 'bg-emerald-500',
    count: 2,
    value: 35000,
  },
]

const mockLeads = [
  {
    id: '1',
    name: 'Sarah Chen',
    company: 'TechStart Inc',
    email: 'sarah@techstart.io',
    phone: '+1 (415) 555-0123',
    website: 'techstart.io',
    status: 'proposal',
    score: 82,
    priority: 'hot' as const,
    value: 15000,
    probability: 72,
    daysInStage: 3,
    lastContact: '2 hours ago',
    assignee: { name: 'You', avatar: 'DB' },
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
  },
  {
    id: '2',
    name: 'Robert Kim',
    company: 'DataFlow Labs',
    email: 'rkim@dataflow.com',
    phone: '+1 (212) 555-0456',
    website: 'dataflow.com',
    status: 'proposal',
    score: 58,
    priority: 'warm' as const,
    value: 25000,
    probability: 45,
    daysInStage: 8,
    lastContact: '5 days ago',
    assignee: { name: 'Mike', avatar: 'MR' },
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
  },
  {
    id: '3',
    name: 'Lisa Park',
    company: 'Innovate Co',
    email: 'lpark@innovate.co',
    status: 'active',
    score: 71,
    priority: 'warm' as const,
    value: 18000,
    probability: 55,
    daysInStage: 5,
    lastContact: '1 day ago',
    assignee: { name: 'Sarah', avatar: 'SC' },
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
  },
  {
    id: '4',
    name: 'James Wilson',
    company: 'CloudNine Tech',
    email: 'jwilson@cloudnine.io',
    status: 'new',
    score: 45,
    priority: 'cold' as const,
    value: 8000,
    probability: 25,
    daysInStage: 12,
    lastContact: '10 days ago',
    assignee: null,
    signals: [
      { type: 'warning', text: '"Just exploring options" in initial email' },
      { type: 'negative', text: 'No response to follow-up' },
    ],
    enrichment: {
      funding: 'Seed',
      employees: '5-10',
      industry: 'Cloud Services',
      location: 'Seattle, WA',
      techStack: ['AWS', 'Kubernetes'],
      recentNews: null,
    },
  },
]

const mockActions = [
  {
    id: '1',
    type: 'respond',
    priority: 'high',
    title: 'Reply to pricing questions',
    description: 'Sarah asked about hourly rate vs fixed pricing',
    dueText: '2 days overdue',
    leadId: '1',
    hasDraft: true,
  },
  {
    id: '2',
    type: 'follow_up',
    priority: 'high',
    title: 'Follow up on proposal',
    description: 'DataFlow Labs - no response for 5 days',
    dueText: 'Due today',
    leadId: '2',
    hasDraft: true,
  },
  {
    id: '3',
    type: 'advance',
    priority: 'medium',
    title: 'Schedule discovery call',
    description: 'Innovate Co is ready for next step',
    dueText: 'Recommended',
    leadId: '3',
    hasDraft: false,
  },
  {
    id: '4',
    type: 'nurture',
    priority: 'low',
    title: 'Send case study',
    description: 'Similar project: E-commerce rebuild for RetailCo',
    dueText: 'Optional',
    leadId: '1',
    hasDraft: false,
  },
]

const mockTimeline = [
  {
    id: '1',
    type: 'email_inbound',
    title: 'Email from Sarah Chen',
    preview: 'Thanks for the proposal! I have a few questions about the pricing...',
    time: '2 hours ago',
    isUnread: true,
  },
  {
    id: '2',
    type: 'email_outbound',
    title: 'Proposal sent',
    preview: 'Attached is our proposal for the TechStart web platform project...',
    time: 'Jan 15, 2:30 PM',
    isUnread: false,
  },
  {
    id: '3',
    type: 'meeting',
    title: 'Discovery call',
    preview: '45 min call with Sarah Chen (CTO)',
    time: 'Jan 12, 10:00 AM',
    isUnread: false,
  },
  {
    id: '4',
    type: 'email_inbound',
    title: 'Email from Sarah Chen',
    preview: 'Great chatting earlier! Yes, let\'s schedule a follow-up call...',
    time: 'Jan 8, 4:15 PM',
    isUnread: false,
  },
  {
    id: '5',
    type: 'email_outbound',
    title: 'Initial outreach',
    preview: 'Thank you for reaching out! I\'d love to learn more about...',
    time: 'Jan 6, 9:00 AM',
    isUnread: false,
  },
  {
    id: '6',
    type: 'lead_created',
    title: 'Lead created',
    preview: 'Via website contact form',
    time: 'Jan 5, 3:22 PM',
    isUnread: false,
  },
]

const mockPredictions = [
  { name: 'TechStart Inc', probability: 72, value: 15000, trend: 'up', change: 12 },
  { name: 'DataFlow Labs', probability: 45, value: 25000, trend: 'down', change: 8 },
  { name: 'Innovate Co', probability: 55, value: 18000, trend: 'up', change: 5 },
]

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function PriorityBadge({ priority }: { priority: 'hot' | 'warm' | 'cold' }) {
  const config = {
    hot: { icon: Flame, label: 'Hot', className: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' },
    warm: { icon: ThermometerSun, label: 'Warm', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300' },
    cold: { icon: Snowflake, label: 'Cold', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' },
  }
  const { icon: Icon, label, className } = config[priority]

  return (
    <Badge variant="secondary" className={cn('text-[10px] h-5 px-1.5 gap-1', className)}>
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  )
}

function ScoreRing({ score, size = 'md' }: { score: number; size?: 'sm' | 'md' | 'lg' }) {
  const sizeConfig = {
    sm: { ring: 32, stroke: 3, text: 'text-xs', inner: 26 },
    md: { ring: 48, stroke: 4, text: 'text-sm font-semibold', inner: 40 },
    lg: { ring: 64, stroke: 5, text: 'text-lg font-bold', inner: 54 },
  }
  const { ring, stroke, text, inner } = sizeConfig[size]
  const circumference = 2 * Math.PI * (ring / 2 - stroke)
  const strokeDashoffset = circumference - (score / 100) * circumference

  const color = score >= 70 ? 'text-emerald-500' : score >= 50 ? 'text-amber-500' : 'text-red-500'

  return (
    <div className="relative" style={{ width: ring, height: ring }}>
      <svg className="transform -rotate-90" width={ring} height={ring}>
        <circle
          cx={ring / 2}
          cy={ring / 2}
          r={ring / 2 - stroke}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-muted/30"
        />
        <circle
          cx={ring / 2}
          cy={ring / 2}
          r={ring / 2 - stroke}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className={color}
        />
      </svg>
      <div className={cn('absolute inset-0 flex items-center justify-center', text)}>
        {score}
      </div>
    </div>
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

// ============================================================================
// PIPELINE STATS BAR
// ============================================================================

function PipelineStatsBar() {
  return (
    <div className="border-b bg-muted/30 px-4 py-3">
      <div className="flex items-center gap-6 overflow-x-auto">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Target className="h-4 w-4 text-primary" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Pipeline Value</div>
            <div className="text-sm font-semibold">${mockPipelineStats.totalValue.toLocaleString()}</div>
          </div>
        </div>

        <Separator orientation="vertical" className="h-8" />

        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <DollarSign className="h-4 w-4 text-emerald-600" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Weighted Value</div>
            <div className="text-sm font-semibold">${mockPipelineStats.weightedValue.toLocaleString()}</div>
          </div>
        </div>

        <Separator orientation="vertical" className="h-8" />

        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
            <TrendingUp className="h-4 w-4 text-violet-600" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Win Rate</div>
            <div className="text-sm font-semibold">{mockPipelineStats.conversionRate}%</div>
          </div>
        </div>

        <Separator orientation="vertical" className="h-8" />

        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <Clock className="h-4 w-4 text-amber-600" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Avg. Days to Close</div>
            <div className="text-sm font-semibold">{mockPipelineStats.avgDaysToClose} days</div>
          </div>
        </div>

        <Separator orientation="vertical" className="h-8" />

        <div className="flex items-center gap-2 ml-auto">
          <Badge variant="secondary" className="gap-1">
            <Plus className="h-3 w-3" />
            {mockPipelineStats.thisMonth.new} new this month
          </Badge>
          <Badge variant="secondary" className="gap-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
            <CheckCircle2 className="h-3 w-3" />
            ${mockPipelineStats.thisMonth.value.toLocaleString()} closed
          </Badge>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// LEAD CARD (KANBAN)
// ============================================================================

function LeadCard({
  lead,
  isSelected,
  onClick,
}: {
  lead: typeof mockLeads[0]
  isSelected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left p-3 rounded-lg border bg-card transition-all',
        'hover:shadow-md hover:border-primary/30',
        isSelected && 'ring-2 ring-primary shadow-md'
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <ScoreRing score={lead.score} size="sm" />
          <PriorityBadge priority={lead.priority} />
        </div>
        <div className="text-right">
          <div className="text-sm font-semibold">${lead.value.toLocaleString()}</div>
          <div className="text-[10px] text-muted-foreground">{lead.probability}% likely</div>
        </div>
      </div>

      <div className="space-y-1">
        <div className="font-medium text-sm line-clamp-1">{lead.name}</div>
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          <Building2 className="h-3 w-3" />
          {lead.company}
        </div>
      </div>

      <div className="flex items-center justify-between mt-3 pt-2 border-t">
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          {lead.lastContact}
        </div>
        {lead.assignee ? (
          <Avatar className="h-5 w-5">
            <AvatarFallback className="text-[8px]">{lead.assignee.avatar}</AvatarFallback>
          </Avatar>
        ) : (
          <Badge variant="outline" className="text-[10px] h-5">Unassigned</Badge>
        )}
      </div>

      {/* Quick signal indicator */}
      {lead.signals.some(s => s.type === 'warning' || s.type === 'negative') && (
        <div className="mt-2 flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-3 w-3" />
          {lead.signals.filter(s => s.type !== 'positive').length} signal(s) need attention
        </div>
      )}
    </button>
  )
}

// ============================================================================
// KANBAN COLUMN
// ============================================================================

function KanbanColumn({
  column,
  leads,
  selectedLead,
  onSelectLead,
}: {
  column: typeof mockColumns[0]
  leads: typeof mockLeads
  selectedLead: string | null
  onSelectLead: (id: string) => void
}) {
  const columnLeads = leads.filter(l => l.status === column.id)

  return (
    <div className="flex-shrink-0 w-72 flex flex-col bg-muted/20 rounded-lg">
      {/* Column Header */}
      <div className="p-3 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn('h-2 w-2 rounded-full', column.color)} />
            <span className="font-medium text-sm">{column.title}</span>
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
              {column.count}
            </Badge>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6">
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          ${column.value.toLocaleString()} total value
        </div>
      </div>

      {/* Cards */}
      <ScrollArea className="flex-1 p-2">
        <div className="space-y-2">
          {columnLeads.map(lead => (
            <LeadCard
              key={lead.id}
              lead={lead}
              isSelected={selectedLead === lead.id}
              onClick={() => onSelectLead(lead.id)}
            />
          ))}
          {columnLeads.length === 0 && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No leads in this stage
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

// ============================================================================
// SUGGESTED ACTIONS PANEL
// ============================================================================

function SuggestedActionsPanel() {
  return (
    <div className="border-b">
      <Collapsible defaultOpen>
        <CollapsibleTrigger className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Sparkles className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-medium text-sm">AI Suggested Actions</span>
            <Badge className="h-5 px-1.5 text-[10px] bg-red-500 hover:bg-red-500">
              {mockActions.filter(a => a.priority === 'high').length} urgent
            </Badge>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-2">
            {mockActions.map(action => (
              <div
                key={action.id}
                className={cn(
                  'p-3 rounded-lg border bg-card',
                  action.priority === 'high' && 'border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {action.priority === 'high' && (
                        <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                      )}
                      <span className="font-medium text-sm">{action.title}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{action.description}</p>
                    <div className="text-[10px] text-muted-foreground mt-1">{action.dueText}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    {action.hasDraft && (
                      <Button size="sm" variant="default" className="h-7 text-xs gap-1">
                        <FileText className="h-3 w-3" />
                        View Draft
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-7 text-xs">
                      Dismiss
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

// ============================================================================
// LEAD DETAIL PANEL
// ============================================================================

function LeadDetailPanel({ lead }: { lead: typeof mockLeads[0] | null }) {
  const [activeTab, setActiveTab] = useState('overview')

  if (!lead) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/10">
        <div className="text-center space-y-2">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto">
            <Target className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground">Select a lead to view details</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 border-l">
      {/* Header */}
      <div className="p-4 border-b bg-card">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="text-lg">{lead.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-lg">{lead.name}</h2>
                <PriorityBadge priority={lead.priority} />
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5">
                <span className="flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5" />
                  {lead.company}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {lead.enrichment.location}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <a href={`mailto:${lead.email}`} className="text-xs text-primary hover:underline flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {lead.email}
                </a>
                {lead.phone && (
                  <a href={`tel:${lead.phone}`} className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {lead.phone}
                  </a>
                )}
                {lead.website && (
                  <a href={`https://${lead.website}`} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1">
                    <Globe className="h-3 w-3" />
                    {lead.website}
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" className="h-8 w-8">
                    <Mail className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Compose email</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" className="h-8 w-8">
                    <Calendar className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Schedule meeting</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" className="h-8 w-8">
                    <FileText className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Create proposal</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>Edit lead</DropdownMenuItem>
                <DropdownMenuItem>Change assignee</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Convert to client</DropdownMenuItem>
                <DropdownMenuItem>Move to On Ice</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-red-600">Archive lead</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <div className="border-b px-4">
          <TabsList className="h-10 p-0 bg-transparent gap-4">
            <TabsTrigger value="overview" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-0 pb-2">
              Overview
            </TabsTrigger>
            <TabsTrigger value="timeline" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-0 pb-2">
              Timeline
            </TabsTrigger>
            <TabsTrigger value="compose" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-0 pb-2">
              Compose
            </TabsTrigger>
          </TabsList>
        </div>

        <ScrollArea className="flex-1">
          <TabsContent value="overview" className="m-0 p-4 space-y-4">
            {/* Score Card */}
            <div className="rounded-lg border bg-gradient-to-br from-card to-muted/30 p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Brain className="h-4 w-4 text-violet-500" />
                  Lead Intelligence
                </h3>
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                  <RefreshCw className="h-3 w-3" />
                  Refresh
                </Button>
              </div>

              <div className="flex items-center gap-6">
                <ScoreRing score={lead.score} size="lg" />
                <div className="flex-1 space-y-2">
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Engagement</span>
                      <span>22/25</span>
                    </div>
                    <Progress value={88} className="h-1.5" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Fit</span>
                      <span>18/25</span>
                    </div>
                    <Progress value={72} className="h-1.5" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Intent</span>
                      <span>23/25</span>
                    </div>
                    <Progress value={92} className="h-1.5" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Momentum</span>
                      <span>19/25</span>
                    </div>
                    <Progress value={76} className="h-1.5" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t">
                <div className="text-center">
                  <div className="text-2xl font-bold">{lead.probability}%</div>
                  <div className="text-xs text-muted-foreground">Close Probability</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">${lead.value.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">Expected Value</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{lead.daysInStage}d</div>
                  <div className="text-xs text-muted-foreground">In Stage</div>
                </div>
              </div>
            </div>

            {/* Signals */}
            <div className="rounded-lg border p-4">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Detected Signals
              </h3>
              <div className="space-y-2">
                {lead.signals.map((signal, idx) => (
                  <SignalItem key={idx} signal={signal} />
                ))}
              </div>
            </div>

            {/* Company Enrichment */}
            <div className="rounded-lg border p-4">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                Company Intel
                <Badge variant="outline" className="text-[10px] h-4 ml-auto">Auto-enriched</Badge>
              </h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Funding</span>
                  <div className="font-medium">{lead.enrichment.funding}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Employees</span>
                  <div className="font-medium">{lead.enrichment.employees}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Industry</span>
                  <div className="font-medium">{lead.enrichment.industry}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Tech Stack</span>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {lead.enrichment.techStack.map(tech => (
                      <Badge key={tech} variant="secondary" className="text-[10px] h-5">{tech}</Badge>
                    ))}
                  </div>
                </div>
              </div>
              {lead.enrichment.recentNews && (
                <div className="mt-3 pt-3 border-t">
                  <div className="text-xs text-muted-foreground mb-1">Recent News</div>
                  <div className="text-sm">{lead.enrichment.recentNews}</div>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="timeline" className="m-0 p-4">
            <div className="space-y-3">
              {mockTimeline.map((event, idx) => (
                <div key={event.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={cn(
                      'h-8 w-8 rounded-full flex items-center justify-center',
                      event.type === 'email_inbound' && 'bg-blue-100 dark:bg-blue-900/50',
                      event.type === 'email_outbound' && 'bg-emerald-100 dark:bg-emerald-900/50',
                      event.type === 'meeting' && 'bg-violet-100 dark:bg-violet-900/50',
                      event.type === 'lead_created' && 'bg-amber-100 dark:bg-amber-900/50',
                    )}>
                      {event.type === 'email_inbound' && <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
                      {event.type === 'email_outbound' && <Send className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
                      {event.type === 'meeting' && <Video className="h-4 w-4 text-violet-600 dark:text-violet-400" />}
                      {event.type === 'lead_created' && <Star className="h-4 w-4 text-amber-600 dark:text-amber-400" />}
                    </div>
                    {idx < mockTimeline.length - 1 && (
                      <div className="w-px h-full bg-border flex-1 my-1" />
                    )}
                  </div>
                  <div className={cn(
                    'flex-1 pb-4 rounded-lg border p-3',
                    event.isUnread && 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900'
                  )}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">{event.title}</span>
                      <span className="text-xs text-muted-foreground">{event.time}</span>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{event.preview}</p>
                    {event.type.includes('email') && (
                      <div className="flex items-center gap-2 mt-2">
                        <Button variant="ghost" size="sm" className="h-6 text-xs gap-1">
                          <Reply className="h-3 w-3" />
                          Reply
                        </Button>
                        <Button variant="ghost" size="sm" className="h-6 text-xs">
                          View full
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="compose" className="m-0 p-4">
            <div className="space-y-4">
              <div className="rounded-lg border p-3 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-violet-500" />
                  <span className="font-medium text-sm text-violet-700 dark:text-violet-300">AI Draft Available</span>
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  Based on Sarah's questions about pricing, here's a suggested response:
                </p>
                <Button size="sm" className="gap-1">
                  <FileText className="h-3 w-3" />
                  Load AI Draft
                </Button>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">To</label>
                <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/30">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-[10px]">SC</AvatarFallback>
                  </Avatar>
                  <span className="text-sm">{lead.name} &lt;{lead.email}&gt;</span>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Subject</label>
                <input
                  type="text"
                  className="w-full p-2 border rounded-md text-sm"
                  defaultValue="RE: Proposal Questions - TechStart Web Platform"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Message</label>
                <Textarea
                  className="min-h-[200px] resize-none"
                  placeholder="Write your message..."
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" className="gap-1">
                    <FileText className="h-4 w-4" />
                    Templates
                  </Button>
                  <Button variant="ghost" size="sm" className="gap-1">
                    <Sparkles className="h-4 w-4" />
                    AI Assist
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm">
                    Save Draft
                  </Button>
                  <Button size="sm" className="gap-1">
                    <Send className="h-4 w-4" />
                    Send Email
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  )
}

// ============================================================================
// PREDICTIONS PANEL
// ============================================================================

function PredictionsPanel() {
  return (
    <div className="border-t bg-muted/20 p-4">
      <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-primary" />
        Pipeline Predictions
      </h3>
      <div className="space-y-2">
        {mockPredictions.map(pred => (
          <div key={pred.name} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{pred.name}</div>
              <div className="text-xs text-muted-foreground">${pred.value.toLocaleString()} expected</div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right">
                <div className="text-sm font-semibold">{pred.probability}%</div>
                <div className={cn(
                  'text-[10px] flex items-center gap-0.5',
                  pred.trend === 'up' ? 'text-emerald-600' : 'text-red-600'
                )}>
                  {pred.trend === 'up' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {pred.change}%
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-3 border-t">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Expected revenue (30d)</span>
          <span className="font-semibold">$42,500</span>
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          Confidence interval: $38,000 - $67,000
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function AgenticCRMWireframePage() {
  const [selectedLead, setSelectedLead] = useState<string | null>('1')

  const lead = mockLeads.find(l => l.id === selectedLead) || null

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Pipeline Stats */}
      <PipelineStatsBar />

      {/* Main Content */}
      <div className="flex-1 flex min-h-0">
        {/* Left: Kanban + Actions */}
        <div className="w-[850px] flex flex-col border-r">
          {/* Suggested Actions */}
          <SuggestedActionsPanel />

          {/* Kanban Board */}
          <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden">
            <div className="flex gap-3 p-4 h-full min-w-max">
              {mockColumns.slice(0, 4).map(column => (
                <KanbanColumn
                  key={column.id}
                  column={column}
                  leads={mockLeads}
                  selectedLead={selectedLead}
                  onSelectLead={setSelectedLead}
                />
              ))}
            </div>
          </div>

          {/* Predictions */}
          <PredictionsPanel />
        </div>

        {/* Right: Lead Detail */}
        <LeadDetailPanel lead={lead} />
      </div>
    </div>
  )
}
