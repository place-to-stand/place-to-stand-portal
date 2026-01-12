'use client'

import { useState } from 'react'
import {
  Mail,
  MessageSquare,
  Search,
  Plus,
  Send,
  Paperclip,
  Star,
  ArrowLeft,
  MoreHorizontal,
  Inbox,
  Archive,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

// Simplified mock data
const mockConversations = [
  { id: '1', name: 'Jennifer Adams', preview: 'Thanks for the great discussion...', time: '10:42 AM', unread: true, type: 'email' },
  { id: '2', name: 'Sarah Chen', preview: 'Hey, did you see the latest designs?', time: '10:15 AM', unread: true, type: 'chat', online: true },
  { id: '3', name: 'Robert Kim', preview: 'Please find attached the invoice...', time: '9:30 AM', unread: false, type: 'email' },
  { id: '4', name: 'Lisa Park', preview: 'The proposal looks great!', time: 'Yesterday', unread: false, type: 'email' },
  { id: '5', name: 'Product Team', preview: 'Standup in 5 minutes!', time: 'Yesterday', unread: false, type: 'chat' },
]

const mockMessages = [
  { id: '1', sender: 'Jennifer Adams', content: 'Thanks for the great discussion yesterday. I wanted to follow up on the action items we discussed.', time: '10:42 AM', isMe: false },
  { id: '2', sender: 'You', content: 'This looks accurate. I\'ll have an update on the dashboard progress by end of day tomorrow.', time: '11:15 AM', isMe: true },
  { id: '3', sender: 'Jennifer Adams', content: 'Perfect! Looking forward to it.', time: '11:20 AM', isMe: false },
]

// Simple navigation tabs
const navItems = [
  { id: 'inbox', label: 'Inbox', icon: Inbox, count: 3 },
  { id: 'starred', label: 'Starred', icon: Star, count: 2 },
  { id: 'archive', label: 'Archive', icon: Archive, count: null },
]

export default function CommunicationsMinimalPage() {
  const [view, setView] = useState<'list' | 'detail'>('list')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activeNav, setActiveNav] = useState('inbox')

  const selectedConvo = mockConversations.find(c => c.id === selectedId)

  const openConversation = (id: string) => {
    setSelectedId(id)
    setView('detail')
  }

  const goBack = () => {
    setView('list')
    setSelectedId(null)
  }

  return (
    <div className="h-[calc(100vh-4rem)] bg-background">
      {view === 'list' ? (
        /* List View */
        <div className="max-w-2xl mx-auto h-full flex flex-col">
          {/* Clean Header */}
          <div className="p-6 pb-4">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-semibold">Messages</h1>
              <Button size="icon" variant="outline" className="rounded-full">
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search messages..."
                className="pl-11 h-11 rounded-full bg-muted/50 border-0"
              />
            </div>
          </div>

          {/* Nav Pills */}
          <div className="px-6 pb-4">
            <div className="flex gap-2">
              {navItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => setActiveNav(item.id)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors',
                    activeNav === item.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/50 hover:bg-muted text-muted-foreground'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                  {item.count && (
                    <span className={cn(
                      'ml-1 text-xs',
                      activeNav === item.id ? 'text-primary-foreground/80' : 'text-muted-foreground'
                    )}>
                      {item.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Conversation List */}
          <ScrollArea className="flex-1 px-6">
            <div className="space-y-1 pb-6">
              {mockConversations.map(convo => (
                <button
                  key={convo.id}
                  onClick={() => openConversation(convo.id)}
                  className={cn(
                    'w-full flex items-center gap-4 p-4 rounded-2xl text-left transition-colors',
                    convo.unread ? 'bg-muted/50' : 'hover:bg-muted/30'
                  )}
                >
                  <div className="relative">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="text-sm">
                        {convo.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    {convo.online && (
                      <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full bg-green-500 ring-2 ring-background" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className={cn('font-medium', convo.unread && 'font-semibold')}>
                        {convo.name}
                      </span>
                      <span className="text-xs text-muted-foreground">{convo.time}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {convo.type === 'email' ? (
                        <Mail className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      ) : (
                        <MessageSquare className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      )}
                      <p className={cn(
                        'text-sm truncate',
                        convo.unread ? 'text-foreground' : 'text-muted-foreground'
                      )}>
                        {convo.preview}
                      </p>
                    </div>
                  </div>
                  {convo.unread && (
                    <span className="h-2.5 w-2.5 rounded-full bg-primary flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>
      ) : (
        /* Detail View */
        <div className="max-w-2xl mx-auto h-full flex flex-col">
          {/* Header */}
          <div className="p-4 flex items-center gap-3 border-b">
            <Button variant="ghost" size="icon" onClick={goBack} className="rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Avatar className="h-10 w-10">
              <AvatarFallback>
                {selectedConvo?.name.split(' ').map(n => n[0]).join('')}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="font-semibold">{selectedConvo?.name}</div>
              <div className="text-xs text-muted-foreground">
                {selectedConvo?.type === 'email' ? 'Email' : 'Chat'}
              </div>
            </div>
            <Button variant="ghost" size="icon" className="rounded-full">
              <MoreHorizontal className="h-5 w-5" />
            </Button>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-6">
            <div className="space-y-6">
              {mockMessages.map(msg => (
                <div
                  key={msg.id}
                  className={cn('flex', msg.isMe && 'justify-end')}
                >
                  <div className={cn(
                    'max-w-[80%] rounded-2xl px-4 py-3',
                    msg.isMe
                      ? 'bg-primary text-primary-foreground rounded-br-md'
                      : 'bg-muted rounded-bl-md'
                  )}>
                    <p className="text-sm leading-relaxed">{msg.content}</p>
                    <p className={cn(
                      'text-[10px] mt-1',
                      msg.isMe ? 'text-primary-foreground/70' : 'text-muted-foreground'
                    )}>
                      {msg.time}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Compose - Minimal */}
          <div className="p-4 border-t">
            <div className="flex items-end gap-3 bg-muted/50 rounded-2xl p-2">
              <Button variant="ghost" size="icon" className="rounded-full h-9 w-9">
                <Paperclip className="h-4 w-4" />
              </Button>
              <Textarea
                placeholder="Type a message..."
                className="flex-1 min-h-[40px] max-h-[120px] resize-none border-0 bg-transparent focus-visible:ring-0 p-2"
                rows={1}
              />
              <Button size="icon" className="rounded-full h-9 w-9">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
