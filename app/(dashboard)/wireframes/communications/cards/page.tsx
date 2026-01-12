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
  Building2,
  FolderKanban,
  Filter,
  Archive,
  Star,
  Reply,
  Sparkles,
  Clock,
  ArrowLeft,
  Phone,
  Video,
  ChevronRight,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

// Mock data
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
    client: { name: 'Acme Corp' },
    project: { name: 'Q1 Roadmap' },
    messageCount: 4,
  },
  {
    id: '2',
    subject: '',
    source: 'chat' as const,
    from: { name: 'Sarah Chen', avatar: 'SC' },
    preview: 'Hey, did you see the latest designs? I think we should discuss...',
    time: '10:15 AM',
    unread: true,
    starred: false,
    client: null,
    project: null,
    messageCount: 12,
    online: true,
  },
  {
    id: '3',
    subject: 'Invoice #2847 - December Services',
    source: 'email' as const,
    from: { name: 'Robert Kim', email: 'rkim@techstart.io', avatar: 'RK' },
    preview: 'Please find attached the invoice for December services.',
    time: '9:30 AM',
    unread: false,
    starred: false,
    client: { name: 'TechStart' },
    project: { name: 'Portal MVP' },
    messageCount: 2,
  },
  {
    id: '4',
    subject: 'RE: Website Redesign Proposal',
    source: 'email' as const,
    from: { name: 'Lisa Park', email: 'lpark@innovate.co', avatar: 'LP' },
    preview: 'The proposal looks great! I have a few minor suggestions...',
    time: 'Yesterday',
    unread: false,
    starred: true,
    client: { name: 'Innovate Co' },
    project: null,
    messageCount: 7,
  },
]

const mockMessages = [
  {
    id: '1',
    from: { name: 'Jennifer Adams', avatar: 'JA' },
    time: '10:42 AM',
    content: 'Thanks for the great discussion yesterday. I wanted to follow up on the action items we discussed.',
    isInbound: true,
  },
  {
    id: '2',
    from: { name: 'You', avatar: 'DB' },
    time: '11:15 AM',
    content: 'This looks accurate. I\'ll have an update on the dashboard progress by end of day tomorrow.',
    isInbound: false,
  },
]

// Card-based conversation card
function ConversationCard({
  thread,
  isSelected,
  onSelect
}: {
  thread: typeof mockThreads[0]
  isSelected: boolean
  onSelect: () => void
}) {
  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-md',
        isSelected && 'ring-2 ring-primary shadow-md',
        thread.unread && 'bg-blue-50/50 dark:bg-blue-950/20'
      )}
      onClick={onSelect}
    >
      <CardHeader className="p-4 pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative flex-shrink-0">
              <Avatar className="h-10 w-10">
                <AvatarFallback>{thread.from.avatar}</AvatarFallback>
              </Avatar>
              {thread.source === 'chat' && thread.online && (
                <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 ring-2 ring-white dark:ring-neutral-900" />
              )}
            </div>
            <div className="min-w-0">
              <div className={cn('font-medium truncate', thread.unread && 'font-semibold')}>
                {thread.from.name}
              </div>
              <div className="text-xs text-muted-foreground">{thread.time}</div>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {thread.starred && <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />}
            <Badge variant={thread.source === 'email' ? 'secondary' : 'outline'} className="text-xs">
              {thread.source === 'email' ? <Mail className="h-3 w-3" /> : <MessageSquare className="h-3 w-3" />}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {thread.subject && (
          <div className={cn('text-sm font-medium mb-1', !thread.unread && 'text-muted-foreground')}>
            {thread.subject}
          </div>
        )}
        <p className="text-sm text-muted-foreground line-clamp-2">{thread.preview}</p>

        {(thread.client || thread.project) && (
          <div className="flex items-center gap-2 mt-3">
            {thread.client && (
              <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                <Building2 className="h-3 w-3 mr-1" />
                {thread.client.name}
              </Badge>
            )}
            {thread.project && (
              <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300">
                <FolderKanban className="h-3 w-3 mr-1" />
                {thread.project.name}
              </Badge>
            )}
          </div>
        )}

        <div className="flex items-center justify-between mt-3 pt-3 border-t">
          <span className="text-xs text-muted-foreground">{thread.messageCount} messages</span>
          <Button variant="ghost" size="sm" className="h-7 text-xs">
            Open <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// Detail view when a conversation is selected
function ConversationDetail({
  thread,
  onBack
}: {
  thread: typeof mockThreads[0] | null
  onBack: () => void
}) {
  if (!thread) return null

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b p-4 flex items-center gap-4 bg-background">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Avatar className="h-10 w-10">
          <AvatarFallback>{thread.from.avatar}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="font-semibold">{thread.from.name}</div>
          <div className="text-sm text-muted-foreground truncate">
            {thread.subject || 'Direct Message'}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon"><Phone className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon"><Video className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4 max-w-2xl mx-auto">
          {mockMessages.map((message) => (
            <div
              key={message.id}
              className={cn('flex gap-3', !message.isInbound && 'flex-row-reverse')}
            >
              <Avatar className="h-8 w-8 flex-shrink-0">
                <AvatarFallback className="text-xs">{message.from.avatar}</AvatarFallback>
              </Avatar>
              <Card className={cn(
                'max-w-[75%]',
                !message.isInbound && 'bg-primary text-primary-foreground'
              )}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium">{message.from.name}</span>
                    <span className="text-xs opacity-70">{message.time}</span>
                  </div>
                  <p className="text-sm">{message.content}</p>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Compose */}
      <div className="border-t p-4">
        <div className="flex items-end gap-2">
          <Textarea placeholder="Type a message..." className="min-h-[60px] resize-none" />
          <div className="flex flex-col gap-1">
            <Button variant="outline" size="icon"><Paperclip className="h-4 w-4" /></Button>
            <Button size="icon"><Send className="h-4 w-4" /></Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CommunicationsCardsPage() {
  const [filter, setFilter] = useState<'all' | 'email' | 'chat'>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const filteredThreads = mockThreads.filter(t => filter === 'all' || t.source === filter)
  const selectedThread = mockThreads.find(t => t.id === selectedId) || null

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Card Grid View */}
      <div className={cn(
        'flex-1 flex flex-col transition-all',
        selectedId && 'hidden lg:flex lg:w-1/2 lg:border-r'
      )}>
        {/* Header */}
        <div className="border-b p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">Communications</h1>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </Button>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Compose
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="email">
                  <Mail className="h-4 w-4 mr-1" />
                  Email
                </TabsTrigger>
                <TabsTrigger value="chat">
                  <MessageSquare className="h-4 w-4 mr-1" />
                  Chat
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search conversations..." className="pl-9" />
            </div>
          </div>

          {/* Quick Stats */}
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              <span className="text-muted-foreground">3 unread</span>
            </div>
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-500" />
              <span className="text-muted-foreground">2 starred</span>
            </div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-500" />
              <span className="text-muted-foreground">5 AI suggestions</span>
            </div>
          </div>
        </div>

        {/* Cards Grid */}
        <ScrollArea className="flex-1 p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredThreads.map(thread => (
              <ConversationCard
                key={thread.id}
                thread={thread}
                isSelected={selectedId === thread.id}
                onSelect={() => setSelectedId(thread.id)}
              />
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Detail Panel */}
      {selectedId && (
        <div className="flex-1 lg:w-1/2">
          <ConversationDetail
            thread={selectedThread}
            onBack={() => setSelectedId(null)}
          />
        </div>
      )}
    </div>
  )
}
