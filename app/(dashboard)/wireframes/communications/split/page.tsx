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
  Star,
  Reply,
  Forward,
  Sparkles,
  X,
  Check,
  GripVertical,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

// Mock data
const mockThreads = [
  { id: '1', subject: 'Q1 Planning Meeting Follow-up', source: 'email', from: { name: 'Jennifer Adams', avatar: 'JA' }, preview: 'Thanks for the great discussion...', time: '10:42 AM', unread: true, starred: true, client: 'Acme Corp', project: 'Q1 Roadmap', messageCount: 4 },
  { id: '2', subject: '', source: 'chat', from: { name: 'Sarah Chen', avatar: 'SC' }, preview: 'Hey, did you see the latest designs?', time: '10:15 AM', unread: true, starred: false, client: null, project: null, messageCount: 12, online: true },
  { id: '3', subject: 'Invoice #2847', source: 'email', from: { name: 'Robert Kim', avatar: 'RK' }, preview: 'Please find attached the invoice...', time: '9:30 AM', unread: false, starred: false, client: 'TechStart', project: 'Portal MVP', messageCount: 2 },
  { id: '4', subject: 'RE: Website Redesign', source: 'email', from: { name: 'Lisa Park', avatar: 'LP' }, preview: 'The proposal looks great!', time: 'Yesterday', unread: false, starred: true, client: 'Innovate Co', project: null, messageCount: 7 },
]

const mockMessages = [
  { id: '1', from: { name: 'Jennifer Adams', avatar: 'JA' }, time: '10:42 AM', content: 'Thanks for the great discussion yesterday. I wanted to follow up on the action items we discussed.', inbound: true },
  { id: '2', from: { name: 'You', avatar: 'DB' }, time: '11:15 AM', content: 'This looks accurate. I\'ll have an update on the dashboard progress by end of day tomorrow.', inbound: false },
  { id: '3', from: { name: 'Sarah Chen', avatar: 'SC' }, time: '11:30 AM', content: 'Perfect! I\'ve already started on the mockups. Here\'s a quick preview of the direction I\'m thinking.', inbound: true },
  { id: '4', from: { name: 'Jennifer Adams', avatar: 'JA' }, time: '11:45 AM', content: 'Love it! Looking forward to seeing the full designs. Can we also include a mobile view?', inbound: true },
]

const mockSuggestions = [
  { type: 'task', title: 'Create dashboard mockups', confidence: 92 },
  { type: 'task', title: 'Schedule user testing', confidence: 87 },
]

export default function CommunicationsSplitPage() {
  const [selectedThread, setSelectedThread] = useState<string>('1')
  const [splitRatio, setSplitRatio] = useState(40) // percentage for left panel

  const thread = mockThreads.find(t => t.id === selectedThread)

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Left Panel - Thread List */}
      <div
        className="flex flex-col border-r bg-background"
        style={{ width: `${splitRatio}%`, minWidth: 280, maxWidth: '60%' }}
      >
        {/* Header */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Inbox</h2>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              New
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search conversations..." className="pl-9" />
          </div>
        </div>

        {/* Thread List */}
        <ScrollArea className="flex-1">
          {mockThreads.map(t => (
            <button
              key={t.id}
              className={cn(
                'w-full text-left p-4 border-b hover:bg-muted/50 transition-colors',
                selectedThread === t.id && 'bg-muted border-l-2 border-l-primary',
                t.unread && 'bg-blue-50/50 dark:bg-blue-950/20'
              )}
              onClick={() => setSelectedThread(t.id)}
            >
              <div className="flex items-start gap-3">
                <div className="relative flex-shrink-0">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>{t.from.avatar}</AvatarFallback>
                  </Avatar>
                  {t.online && (
                    <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 ring-2 ring-white dark:ring-neutral-900" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className={cn('text-sm', t.unread && 'font-semibold')}>{t.from.name}</span>
                    <span className="text-xs text-muted-foreground">{t.time}</span>
                  </div>
                  <div className="flex items-center gap-2 mb-1">
                    {t.source === 'email' ? (
                      <Mail className="h-3 w-3 text-orange-500" />
                    ) : (
                      <MessageSquare className="h-3 w-3 text-blue-500" />
                    )}
                    <span className={cn('text-sm truncate', t.unread ? 'text-foreground' : 'text-muted-foreground')}>
                      {t.subject || 'Direct message'}
                    </span>
                    {t.starred && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{t.preview}</p>
                  {(t.client || t.project) && (
                    <div className="flex gap-1 mt-2">
                      {t.client && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1">{t.client}</Badge>
                      )}
                      {t.project && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1">{t.project}</Badge>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </ScrollArea>
      </div>

      {/* Resize Handle */}
      <div className="w-1 bg-border hover:bg-primary/50 cursor-col-resize flex items-center justify-center group">
        <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
      </div>

      {/* Right Panel - Conversation */}
      <div className="flex-1 flex flex-col min-w-0">
        {thread ? (
          <>
            {/* Conversation Header */}
            <div className="p-4 border-b flex items-center gap-4 bg-background">
              <div className="relative flex-shrink-0">
                <Avatar className="h-12 w-12">
                  <AvatarFallback>{thread.from.avatar}</AvatarFallback>
                </Avatar>
                {thread.online && (
                  <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full bg-green-500 ring-2 ring-white dark:ring-neutral-900" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold">{thread.from.name}</div>
                <div className="text-sm text-muted-foreground">
                  {thread.subject || 'Direct message'} • {thread.messageCount} messages
                </div>
                {(thread.client || thread.project) && (
                  <div className="flex gap-2 mt-1">
                    {thread.client && (
                      <Badge variant="secondary" className="text-xs">
                        <Building2 className="h-3 w-3 mr-1" />
                        {thread.client}
                      </Badge>
                    )}
                    {thread.project && (
                      <Badge variant="secondary" className="text-xs">
                        <FolderKanban className="h-3 w-3 mr-1" />
                        {thread.project}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon"><Star className={cn('h-4 w-4', thread.starred && 'text-yellow-500 fill-yellow-500')} /></Button>
                <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-6">
              <div className="max-w-3xl mx-auto space-y-6">
                {mockMessages.map((msg, idx) => (
                  <div key={msg.id}>
                    {idx > 0 && mockMessages[idx - 1].inbound !== msg.inbound && (
                      <Separator className="my-6" />
                    )}
                    <div className={cn('flex gap-4', !msg.inbound && 'flex-row-reverse')}>
                      <Avatar className="h-9 w-9 flex-shrink-0">
                        <AvatarFallback className="text-xs">{msg.from.avatar}</AvatarFallback>
                      </Avatar>
                      <div className={cn('flex-1', !msg.inbound && 'text-right')}>
                        <div className="flex items-center gap-2 mb-1" style={{ justifyContent: msg.inbound ? 'flex-start' : 'flex-end' }}>
                          <span className="text-sm font-medium">{msg.from.name}</span>
                          <span className="text-xs text-muted-foreground">{msg.time}</span>
                        </div>
                        <div className={cn(
                          'inline-block text-left rounded-2xl px-4 py-3 max-w-[85%]',
                          msg.inbound ? 'bg-muted' : 'bg-primary text-primary-foreground'
                        )}>
                          <p className="text-sm leading-relaxed">{msg.content}</p>
                        </div>
                        <div className={cn('flex items-center gap-1 mt-1 opacity-0 hover:opacity-100', !msg.inbound && 'justify-end')}>
                          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                            <Reply className="h-3 w-3 mr-1" />
                            Reply
                          </Button>
                          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                            <Forward className="h-3 w-3 mr-1" />
                            Forward
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* AI Suggestions */}
            {thread.source === 'email' && (
              <div className="border-t bg-gradient-to-r from-violet-50/50 to-blue-50/50 dark:from-violet-950/20 dark:to-blue-950/20 px-6 py-3">
                <div className="max-w-3xl mx-auto">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-4 w-4 text-violet-500" />
                    <span className="text-sm font-medium text-violet-700 dark:text-violet-300">Suggested Tasks</span>
                    <Button variant="ghost" size="icon" className="h-5 w-5 ml-auto">
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {mockSuggestions.map((s, idx) => (
                      <Button key={idx} variant="outline" size="sm" className="h-7 text-xs bg-white dark:bg-neutral-900">
                        <Check className="h-3 w-3 mr-1 text-green-500" />
                        {s.title}
                        <Badge variant="secondary" className="ml-2 h-4 px-1 text-[10px]">{s.confidence}%</Badge>
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Compose */}
            <div className="border-t p-4 bg-background">
              <div className="max-w-3xl mx-auto">
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <Textarea
                      placeholder="Write your reply..."
                      className="min-h-[80px] resize-none"
                    />
                    <div className="flex items-center gap-2 mt-2">
                      <Button variant="ghost" size="sm" className="h-7">
                        <Paperclip className="h-4 w-4 mr-1" />
                        Attach
                      </Button>
                      <span className="text-xs text-muted-foreground">Press ⌘ + Enter to send</span>
                    </div>
                  </div>
                  <Button className="h-10">
                    <Send className="h-4 w-4 mr-2" />
                    Send
                  </Button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <Mail className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Select a conversation</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
