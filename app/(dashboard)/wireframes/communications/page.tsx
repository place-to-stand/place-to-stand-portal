'use client'

import { useState } from 'react'
import {
  Mail,
  MessageSquare,
  Search,
  Plus,
  MoreHorizontal,
  Send,
  Paperclip,
  Smile,
  Building2,
  FolderKanban,
  ChevronDown,
  Filter,
  Archive,
  Star,
  Reply,
  Forward,
  Sparkles,
  Users,
  Hash,
  AtSign,
  Check,
  CheckCheck,
  Phone,
  Video,
  Pin,
  Bell,
  BellOff,
  Settings,
  X,
  Image,
  FileText,
  Calendar,
  Clock,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

// ============================================================================
// MOCK DATA
// ============================================================================

const mockSpaces = [
  { id: '1', name: 'Sarah Chen', type: 'dm', online: true, unread: 2, avatar: 'SC' },
  { id: '2', name: 'Mike Rodriguez', type: 'dm', online: true, unread: 0, avatar: 'MR' },
  { id: '3', name: 'Emily Watson', type: 'dm', online: false, unread: 0, avatar: 'EW' },
  { id: '4', name: 'Product Team', type: 'group', unread: 5, memberCount: 4 },
  { id: '5', name: 'Engineering', type: 'group', unread: 0, memberCount: 6 },
  { id: '6', name: 'Design Reviews', type: 'group', unread: 1, memberCount: 3 },
]

const mockThreads = [
  {
    id: '1',
    subject: 'Q1 Planning Meeting Follow-up',
    source: 'email' as const,
    from: { name: 'Jennifer Adams', email: 'jadams@acmecorp.com', avatar: 'JA' },
    preview: 'Thanks for the great discussion yesterday. I wanted to follow up on the action items...',
    time: '10:42 AM',
    unread: true,
    starred: true,
    client: { name: 'Acme Corp', color: 'blue' },
    project: { name: 'Q1 Roadmap' },
    messageCount: 4,
  },
  {
    id: '2',
    subject: '',
    source: 'chat' as const,
    from: { name: 'Sarah Chen', avatar: 'SC' },
    preview: 'Hey, did you see the latest designs? I think we should discuss the navigation...',
    time: '10:15 AM',
    unread: true,
    starred: false,
    client: null,
    project: null,
    messageCount: 12,
    isTyping: true,
  },
  {
    id: '3',
    subject: 'Invoice #2847 - December Services',
    source: 'email' as const,
    from: { name: 'Robert Kim', email: 'rkim@techstart.io', avatar: 'RK' },
    preview: 'Please find attached the invoice for December services. Let me know if you have any questions.',
    time: '9:30 AM',
    unread: false,
    starred: false,
    client: { name: 'TechStart', color: 'green' },
    project: { name: 'Portal MVP' },
    messageCount: 2,
  },
  {
    id: '4',
    subject: 'RE: Website Redesign Proposal',
    source: 'email' as const,
    from: { name: 'Lisa Park', email: 'lpark@innovate.co', avatar: 'LP' },
    preview: 'The proposal looks great! I have a few minor suggestions on the timeline section...',
    time: 'Yesterday',
    unread: false,
    starred: true,
    client: { name: 'Innovate Co', color: 'purple' },
    project: null,
    messageCount: 7,
  },
  {
    id: '5',
    subject: '',
    source: 'chat' as const,
    from: { name: 'Product Team' },
    preview: 'Mike: Standup in 5 minutes!',
    time: 'Yesterday',
    unread: false,
    starred: false,
    client: null,
    project: null,
    messageCount: 24,
    isGroup: true,
  },
  {
    id: '6',
    subject: 'Contract Review - Annual Retainer',
    source: 'email' as const,
    from: { name: 'David Chen', email: 'dchen@lawfirm.com', avatar: 'DC' },
    preview: 'I have reviewed the contract and have a few suggestions for the service terms...',
    time: 'Mon',
    unread: false,
    starred: false,
    client: { name: 'Acme Corp', color: 'blue' },
    project: { name: 'Legal' },
    messageCount: 3,
  },
]

const mockMessages = [
  {
    id: '1',
    from: { name: 'Jennifer Adams', email: 'jadams@acmecorp.com', avatar: 'JA' },
    time: '10:42 AM',
    content: `Hi Team,

Thanks for the great discussion yesterday at the Q1 planning meeting. I wanted to follow up on the action items we discussed:

1. **Dashboard redesign** - Sarah will create initial mockups by Friday
2. **API integration** - Mike to scope out the technical requirements
3. **User testing** - We'll schedule sessions for the week of Jan 20th

Let me know if I missed anything or if there are any updates.

Best,
Jennifer`,
    isInbound: true,
  },
  {
    id: '2',
    from: { name: 'You', avatar: 'DB' },
    time: '11:15 AM',
    content: `Thanks Jennifer!

This looks accurate. I'll add one more item:

4. **Analytics setup** - I'll configure PostHog events for the new features

I'll have an update on the dashboard progress by end of day tomorrow.`,
    isInbound: false,
  },
  {
    id: '3',
    from: { name: 'Sarah Chen', avatar: 'SC' },
    time: '11:30 AM',
    content: `Perfect! I've already started on the mockups. Here's a quick preview of the direction I'm thinking:

- Clean, minimal interface
- Focus on key metrics at the top
- Expandable sections for details

I'll share the full designs in our Friday review.`,
    isInbound: true,
  },
  {
    id: '4',
    from: { name: 'Jennifer Adams', email: 'jadams@acmecorp.com', avatar: 'JA' },
    time: '11:45 AM',
    content: `Love it! Looking forward to seeing the full designs.

One quick question - can we also include a mobile view in the mockups? Our team uses the dashboard on tablets quite often.`,
    isInbound: true,
  },
]

const mockSuggestions = [
  { type: 'task', title: 'Create dashboard mockups', confidence: 92, project: 'Q1 Roadmap' },
  { type: 'task', title: 'Schedule user testing sessions', confidence: 87, project: 'Q1 Roadmap' },
  { type: 'task', title: 'Configure PostHog events', confidence: 78, project: 'Q1 Roadmap' },
]

// ============================================================================
// PRESENCE INDICATOR
// ============================================================================

function PresenceIndicator({ online, size = 'sm' }: { online: boolean; size?: 'sm' | 'md' }) {
  return (
    <span
      className={cn(
        'absolute rounded-full ring-2 ring-white dark:ring-neutral-900',
        online ? 'bg-green-500' : 'bg-neutral-400',
        size === 'sm' ? 'h-2.5 w-2.5 -bottom-0.5 -right-0.5' : 'h-3 w-3 bottom-0 right-0'
      )}
    />
  )
}

// ============================================================================
// CHAT SPACES SIDEBAR
// ============================================================================

function SpacesSidebar({
  selectedSpace,
  onSelectSpace,
}: {
  selectedSpace: string | null
  onSelectSpace: (id: string | null) => void
}) {
  return (
    <div className="w-64 border-r bg-muted/30 flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b flex items-center justify-between">
        <h2 className="font-semibold text-sm">Messages</h2>
        <div className="flex items-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <Search className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Search messages</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <Plus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>New message</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="p-2 space-y-0.5">
        <button
          onClick={() => onSelectSpace(null)}
          className={cn(
            'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors',
            selectedSpace === null
              ? 'bg-primary/10 text-primary'
              : 'hover:bg-muted text-muted-foreground hover:text-foreground'
          )}
        >
          <Mail className="h-4 w-4" />
          <span>All Messages</span>
          <Badge variant="secondary" className="ml-auto text-xs">8</Badge>
        </button>
        <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
          <Star className="h-4 w-4" />
          <span>Starred</span>
        </button>
        <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
          <Archive className="h-4 w-4" />
          <span>Archived</span>
        </button>
      </div>

      <Separator className="my-2" />

      {/* Direct Messages */}
      <div className="px-2 py-1">
        <div className="flex items-center justify-between px-2 mb-1">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Direct Messages</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </div>
        <div className="space-y-0.5">
          {mockSpaces.filter(s => s.type === 'dm').map(space => (
            <button
              key={space.id}
              onClick={() => onSelectSpace(space.id)}
              className={cn(
                'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors',
                selectedSpace === space.id
                  ? 'bg-primary/10 text-primary'
                  : 'hover:bg-muted'
              )}
            >
              <div className="relative flex-shrink-0">
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-[10px]">{space.avatar}</AvatarFallback>
                </Avatar>
                <PresenceIndicator online={space.online || false} />
              </div>
              <span className="truncate flex-1 text-left">{space.name}</span>
              {space.unread > 0 && (
                <Badge className="h-5 min-w-5 px-1.5 bg-blue-500 hover:bg-blue-500 text-white">
                  {space.unread}
                </Badge>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Group Chats */}
      <div className="px-2 py-1 mt-2">
        <div className="flex items-center justify-between px-2 mb-1">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Groups</span>
          <Button variant="ghost" size="icon" className="h-4 w-4 p-0">
            <Plus className="h-3 w-3 text-muted-foreground" />
          </Button>
        </div>
        <div className="space-y-0.5">
          {mockSpaces.filter(s => s.type === 'group').map(space => (
            <button
              key={space.id}
              onClick={() => onSelectSpace(space.id)}
              className={cn(
                'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors',
                selectedSpace === space.id
                  ? 'bg-primary/10 text-primary'
                  : 'hover:bg-muted'
              )}
            >
              <div className="h-6 w-6 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <span className="truncate flex-1 text-left">{space.name}</span>
              {space.unread > 0 && (
                <Badge className="h-5 min-w-5 px-1.5 bg-blue-500 hover:bg-blue-500 text-white">
                  {space.unread}
                </Badge>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Bottom - Online Team */}
      <div className="mt-auto border-t p-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          <span>3 team members online</span>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// THREAD LIST (CENTER COLUMN)
// ============================================================================

function ThreadList({
  selectedThread,
  onSelectThread,
}: {
  selectedThread: string | null
  onSelectThread: (id: string) => void
}) {
  const [filter, setFilter] = useState<'all' | 'email' | 'chat'>('all')

  const filteredThreads = mockThreads.filter(t => {
    if (filter === 'all') return true
    return t.source === filter
  })

  return (
    <div className="w-96 border-r flex flex-col h-full bg-background">
      {/* Header with Tabs */}
      <div className="p-3 border-b space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Inbox</h2>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Filter className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Source Filter Tabs */}
        <Tabs value={filter} onValueChange={(v) => setFilter(v as 'all' | 'email' | 'chat')}>
          <TabsList className="w-full grid grid-cols-3 h-8">
            <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
            <TabsTrigger value="email" className="text-xs">
              <Mail className="h-3 w-3 mr-1" />
              Email
            </TabsTrigger>
            <TabsTrigger value="chat" className="text-xs">
              <MessageSquare className="h-3 w-3 mr-1" />
              Chat
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      {/* Thread List */}
      <ScrollArea className="flex-1">
        <div className="divide-y">
          {filteredThreads.map(thread => (
            <button
              key={thread.id}
              onClick={() => onSelectThread(thread.id)}
              className={cn(
                'w-full p-3 text-left transition-colors',
                thread.unread ? 'bg-blue-50/50 dark:bg-blue-950/20' : 'hover:bg-muted/50',
                selectedThread === thread.id && 'bg-muted ring-1 ring-inset ring-border'
              )}
            >
              <div className="flex items-start gap-3">
                {/* Avatar with source indicator */}
                <div className="relative flex-shrink-0">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="text-sm">{thread.from.avatar}</AvatarFallback>
                  </Avatar>
                  {/* Source badge */}
                  <div className={cn(
                    'absolute -bottom-1 -right-1 h-5 w-5 rounded-full flex items-center justify-center ring-2 ring-white dark:ring-neutral-900',
                    thread.source === 'email' ? 'bg-orange-100 dark:bg-orange-900' : 'bg-blue-100 dark:bg-blue-900'
                  )}>
                    {thread.source === 'email' ? (
                      <Mail className="h-2.5 w-2.5 text-orange-600 dark:text-orange-400" />
                    ) : (
                      <MessageSquare className="h-2.5 w-2.5 text-blue-600 dark:text-blue-400" />
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={cn('text-sm truncate', thread.unread ? 'font-semibold' : 'font-medium')}>
                      {thread.from.name}
                    </span>
                    {thread.messageCount > 1 && (
                      <span className="flex-shrink-0 h-5 min-w-5 px-1.5 flex items-center justify-center rounded-full bg-neutral-200 dark:bg-neutral-700 text-xs text-neutral-600 dark:text-neutral-300">
                        {thread.messageCount}
                      </span>
                    )}
                    {thread.starred && (
                      <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500 flex-shrink-0" />
                    )}
                    <span className="text-xs text-muted-foreground ml-auto flex-shrink-0">{thread.time}</span>
                  </div>

                  {thread.subject && (
                    <div className={cn('text-sm truncate', thread.unread ? 'text-foreground' : 'text-muted-foreground')}>
                      {thread.subject}
                    </div>
                  )}

                  <div className="text-xs text-muted-foreground truncate mt-0.5">
                    {thread.isTyping ? (
                      <span className="text-blue-500 flex items-center gap-1">
                        <span className="flex gap-0.5">
                          <span className="w-1 h-1 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1 h-1 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-1 h-1 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                        </span>
                        typing...
                      </span>
                    ) : (
                      thread.preview
                    )}
                  </div>

                  {/* Tags */}
                  {(thread.client || thread.project) && (
                    <div className="flex items-center gap-1.5 mt-2">
                      {thread.client && (
                        <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                          <Building2 className="h-2.5 w-2.5 mr-1" />
                          {thread.client.name}
                        </Badge>
                      )}
                      {thread.project && (
                        <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300">
                          <FolderKanban className="h-2.5 w-2.5 mr-1" />
                          {thread.project.name}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}

// ============================================================================
// CONVERSATION VIEW (RIGHT PANEL)
// ============================================================================

function ConversationView({ threadId }: { threadId: string | null }) {
  const [showSuggestions, setShowSuggestions] = useState(true)
  const thread = mockThreads.find(t => t.id === threadId)

  if (!thread) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/20">
        <div className="text-center space-y-2">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto">
            <Mail className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground">Select a conversation to view</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-4 py-3 flex items-center justify-between bg-background">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative flex-shrink-0">
            <Avatar className="h-10 w-10">
              <AvatarFallback>{thread.from.avatar}</AvatarFallback>
            </Avatar>
            {thread.source === 'chat' && <PresenceIndicator online={true} size="md" />}
          </div>
          <div className="min-w-0">
            <div className="font-semibold truncate">{thread.from.name}</div>
            <div className="text-xs text-muted-foreground truncate">
              {thread.source === 'email' ? thread.from.email : 'Online'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {thread.source === 'chat' && (
            <>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Phone className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Voice call</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Video className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Video call</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </>
          )}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Pin className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Pin conversation</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <BellOff className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Mute notifications</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Star className="h-4 w-4 mr-2" />
                Star conversation
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Archive className="h-4 w-4 mr-2" />
                Archive
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Building2 className="h-4 w-4 mr-2" />
                Link to client
              </DropdownMenuItem>
              <DropdownMenuItem>
                <FolderKanban className="h-4 w-4 mr-2" />
                Link to project
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-red-600">
                <X className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Subject bar for emails */}
      {thread.source === 'email' && thread.subject && (
        <div className="border-b px-4 py-2 bg-muted/30">
          <div className="text-sm font-medium">{thread.subject}</div>
          <div className="flex items-center gap-2 mt-1">
            {thread.client && (
              <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                <Building2 className="h-2.5 w-2.5 mr-1" />
                {thread.client.name}
              </Badge>
            )}
            {thread.project && (
              <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300">
                <FolderKanban className="h-2.5 w-2.5 mr-1" />
                {thread.project.name}
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4 max-w-3xl mx-auto">
          {mockMessages.map((message, idx) => (
            <div
              key={message.id}
              className={cn(
                'flex gap-3',
                !message.isInbound && 'flex-row-reverse'
              )}
            >
              <Avatar className="h-8 w-8 flex-shrink-0">
                <AvatarFallback className="text-xs">{message.from.avatar}</AvatarFallback>
              </Avatar>

              <div className={cn('flex-1 max-w-[80%]', !message.isInbound && 'text-right')}>
                <div className={cn(
                  'inline-block text-left rounded-2xl px-4 py-2',
                  message.isInbound
                    ? 'bg-muted'
                    : 'bg-primary text-primary-foreground'
                )}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium">{message.from.name}</span>
                    <span className="text-xs opacity-70">{message.time}</span>
                  </div>
                  <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                </div>

                {/* Message actions on hover (simplified) */}
                <div className={cn(
                  'flex items-center gap-1 mt-1 opacity-0 hover:opacity-100 transition-opacity',
                  !message.isInbound && 'justify-end'
                )}>
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    <Reply className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    <Forward className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    <Smile className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {thread.isTyping && (
            <div className="flex gap-3">
              <Avatar className="h-8 w-8 flex-shrink-0">
                <AvatarFallback className="text-xs">{thread.from.avatar}</AvatarFallback>
              </Avatar>
              <div className="bg-muted rounded-2xl px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* AI Suggestions Panel */}
      {showSuggestions && thread.source === 'email' && (
        <div className="border-t border-b bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/30 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-sm font-medium text-violet-700 dark:text-violet-300">
              <Sparkles className="h-4 w-4" />
              AI Suggestions
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setShowSuggestions(false)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {mockSuggestions.map((suggestion, idx) => (
              <Button
                key={idx}
                variant="outline"
                size="sm"
                className="h-7 text-xs bg-white dark:bg-neutral-900 hover:bg-violet-100 dark:hover:bg-violet-900/30 border-violet-200 dark:border-violet-800"
              >
                <Check className="h-3 w-3 mr-1 text-violet-500" />
                {suggestion.title}
                <Badge variant="secondary" className="ml-2 h-4 px-1 text-[10px] bg-violet-100 text-violet-600 dark:bg-violet-900/50 dark:text-violet-300">
                  {suggestion.confidence}%
                </Badge>
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Compose Area */}
      <div className="border-t p-4 bg-background">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <Textarea
              placeholder={thread.source === 'email' ? 'Write your reply...' : 'Type a message...'}
              className="min-h-[80px] resize-none pr-24"
            />
            <div className="absolute bottom-2 right-2 flex items-center gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <Paperclip className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Attach file</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <Image className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Add image</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <Smile className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Add emoji</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            {thread.source === 'email' && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Clock className="h-4 w-4 mr-1" />
                    Schedule
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>Send later today</DropdownMenuItem>
                  <DropdownMenuItem>Send tomorrow morning</DropdownMenuItem>
                  <DropdownMenuItem>
                    <Calendar className="h-4 w-4 mr-2" />
                    Pick date & time
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Button className="gap-2">
              <Send className="h-4 w-4" />
              {thread.source === 'email' ? 'Send' : 'Send'}
            </Button>
          </div>
        </div>

        {/* Quick Templates for Email */}
        {thread.source === 'email' && (
          <div className="flex items-center gap-2 mt-3">
            <span className="text-xs text-muted-foreground">Templates:</span>
            <Button variant="ghost" size="sm" className="h-6 text-xs">
              Follow up
            </Button>
            <Button variant="ghost" size="sm" className="h-6 text-xs">
              Thank you
            </Button>
            <Button variant="ghost" size="sm" className="h-6 text-xs">
              Schedule meeting
            </Button>
            <Button variant="ghost" size="sm" className="h-6 text-xs">
              <Plus className="h-3 w-3 mr-1" />
              New template
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function CommunicationsWireframePage() {
  const [selectedSpace, setSelectedSpace] = useState<string | null>(null)
  const [selectedThread, setSelectedThread] = useState<string | null>('1')

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Left Sidebar - Chat Spaces */}
      <SpacesSidebar
        selectedSpace={selectedSpace}
        onSelectSpace={setSelectedSpace}
      />

      {/* Center - Thread List */}
      <ThreadList
        selectedThread={selectedThread}
        onSelectThread={setSelectedThread}
      />

      {/* Right - Conversation View */}
      <ConversationView threadId={selectedThread} />
    </div>
  )
}
