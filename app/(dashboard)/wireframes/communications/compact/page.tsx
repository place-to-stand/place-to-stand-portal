'use client'

import { useState } from 'react'
import {
  Mail,
  MessageSquare,
  Search,
  MoreHorizontal,
  Send,
  Paperclip,
  Building2,
  FolderKanban,
  Archive,
  Star,
  Trash2,
  CheckSquare,
  ChevronDown,
  Reply,
  Forward,
  Clock,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

// Mock data - same structure, more items for density demo
const mockThreads = [
  { id: '1', subject: 'Q1 Planning Meeting Follow-up', source: 'email', from: { name: 'Jennifer Adams', avatar: 'JA' }, time: '10:42 AM', unread: true, starred: true, client: 'Acme Corp', project: 'Q1 Roadmap' },
  { id: '2', subject: '', source: 'chat', from: { name: 'Sarah Chen', avatar: 'SC' }, time: '10:15 AM', unread: true, starred: false, client: null, project: null, typing: true },
  { id: '3', subject: 'Invoice #2847 - December Services', source: 'email', from: { name: 'Robert Kim', avatar: 'RK' }, time: '9:30 AM', unread: false, starred: false, client: 'TechStart', project: 'Portal MVP' },
  { id: '4', subject: 'RE: Website Redesign Proposal', source: 'email', from: { name: 'Lisa Park', avatar: 'LP' }, time: 'Yesterday', unread: false, starred: true, client: 'Innovate Co', project: null },
  { id: '5', subject: 'Standup reminder', source: 'chat', from: { name: 'Product Team', avatar: 'PT' }, time: 'Yesterday', unread: false, starred: false, client: null, project: null },
  { id: '6', subject: 'Contract Review - Annual Retainer', source: 'email', from: { name: 'David Chen', avatar: 'DC' }, time: 'Mon', unread: false, starred: false, client: 'Acme Corp', project: 'Legal' },
  { id: '7', subject: 'Design Review Notes', source: 'email', from: { name: 'Emily Watson', avatar: 'EW' }, time: 'Mon', unread: false, starred: false, client: 'TechStart', project: 'Portal MVP' },
  { id: '8', subject: 'Quick question about timeline', source: 'chat', from: { name: 'Mike Rodriguez', avatar: 'MR' }, time: 'Sun', unread: false, starred: false, client: null, project: null },
]

const mockMessages = [
  { id: '1', from: 'Jennifer Adams', time: '10:42 AM', content: 'Thanks for the great discussion yesterday. Action items attached.', inbound: true },
  { id: '2', from: 'You', time: '11:15 AM', content: 'This looks accurate. I\'ll have an update by EOD tomorrow.', inbound: false },
  { id: '3', from: 'Sarah Chen', time: '11:30 AM', content: 'Perfect! I\'ve started on the mockups already.', inbound: true },
]

export default function CommunicationsCompactPage() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [selectedThread, setSelectedThread] = useState<string | null>('1')
  const [showPreview, setShowPreview] = useState(true)

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  const selectAll = () => {
    if (selectedIds.size === mockThreads.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(mockThreads.map(t => t.id)))
    }
  }

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Compact List */}
      <div className={cn('flex flex-col border-r', showPreview ? 'w-[480px]' : 'flex-1')}>
        {/* Toolbar */}
        <div className="border-b px-2 py-1.5 flex items-center gap-1 bg-muted/30">
          <Checkbox
            checked={selectedIds.size === mockThreads.length}
            onCheckedChange={selectAll}
            className="mr-1"
          />

          {selectedIds.size > 0 ? (
            <>
              <span className="text-xs text-muted-foreground mr-2">{selectedIds.size} selected</span>
              <Button variant="ghost" size="sm" className="h-7 px-2">
                <Archive className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 px-2">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 px-2">
                <Star className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 px-2">
                <CheckSquare className="h-3.5 w-3.5" />
              </Button>
            </>
          ) : (
            <>
              <div className="relative flex-1 max-w-[200px]">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="Search..." className="h-7 pl-7 text-xs" />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                    All <ChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem>All messages</DropdownMenuItem>
                  <DropdownMenuItem>Unread only</DropdownMenuItem>
                  <DropdownMenuItem>Starred</DropdownMenuItem>
                  <DropdownMenuItem>Email only</DropdownMenuItem>
                  <DropdownMenuItem>Chat only</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}

          <div className="ml-auto flex items-center gap-1">
            <Button
              variant={showPreview ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setShowPreview(!showPreview)}
            >
              Preview
            </Button>
          </div>
        </div>

        {/* Compact Thread List */}
        <ScrollArea className="flex-1">
          <div className="divide-y">
            {mockThreads.map(thread => (
              <div
                key={thread.id}
                className={cn(
                  'flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-muted/50 group',
                  selectedThread === thread.id && 'bg-muted',
                  thread.unread && 'bg-blue-50/50 dark:bg-blue-950/20'
                )}
                onClick={() => setSelectedThread(thread.id)}
              >
                <Checkbox
                  checked={selectedIds.has(thread.id)}
                  onCheckedChange={() => toggleSelect(thread.id)}
                  onClick={(e) => e.stopPropagation()}
                />

                <button
                  className="opacity-50 hover:opacity-100"
                  onClick={(e) => { e.stopPropagation() }}
                >
                  <Star className={cn('h-3.5 w-3.5', thread.starred && 'text-yellow-500 fill-yellow-500')} />
                </button>

                <Avatar className="h-6 w-6 flex-shrink-0">
                  <AvatarFallback className="text-[10px]">{thread.from.avatar}</AvatarFallback>
                </Avatar>

                <div className="w-24 flex-shrink-0 truncate">
                  <span className={cn('text-xs', thread.unread && 'font-semibold')}>{thread.from.name}</span>
                </div>

                <div className="flex-1 min-w-0 flex items-center gap-2">
                  {thread.source === 'email' ? (
                    <Mail className="h-3 w-3 text-orange-500 flex-shrink-0" />
                  ) : (
                    <MessageSquare className="h-3 w-3 text-blue-500 flex-shrink-0" />
                  )}
                  <span className={cn('text-xs truncate', thread.unread ? 'text-foreground' : 'text-muted-foreground')}>
                    {thread.subject || 'Direct message'}
                  </span>
                </div>

                {thread.client && (
                  <Badge variant="outline" className="h-4 px-1 text-[9px] flex-shrink-0">
                    {thread.client}
                  </Badge>
                )}

                <span className="text-[10px] text-muted-foreground w-16 text-right flex-shrink-0">
                  {thread.time}
                </span>
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Stats Bar */}
        <div className="border-t px-3 py-1.5 flex items-center gap-4 text-[10px] text-muted-foreground bg-muted/30">
          <span>8 conversations</span>
          <span>2 unread</span>
          <span className="ml-auto">Updated 2m ago</span>
        </div>
      </div>

      {/* Preview/Detail Panel */}
      {showPreview && selectedThread && (
        <div className="flex-1 flex flex-col">
          {/* Thread Header - Compact */}
          <div className="border-b px-4 py-2 flex items-center gap-3 bg-background">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs">
                {mockThreads.find(t => t.id === selectedThread)?.from.avatar}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">
                {mockThreads.find(t => t.id === selectedThread)?.from.name}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {mockThreads.find(t => t.id === selectedThread)?.subject || 'Direct message'}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <Reply className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <Forward className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <Archive className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Tags */}
          <div className="px-4 py-2 border-b flex items-center gap-2 bg-muted/20">
            {mockThreads.find(t => t.id === selectedThread)?.client && (
              <Badge variant="secondary" className="text-xs">
                <Building2 className="h-3 w-3 mr-1" />
                {mockThreads.find(t => t.id === selectedThread)?.client}
              </Badge>
            )}
            {mockThreads.find(t => t.id === selectedThread)?.project && (
              <Badge variant="secondary" className="text-xs">
                <FolderKanban className="h-3 w-3 mr-1" />
                {mockThreads.find(t => t.id === selectedThread)?.project}
              </Badge>
            )}
          </div>

          {/* Messages - Compact */}
          <ScrollArea className="flex-1 px-4 py-3">
            <div className="space-y-3">
              {mockMessages.map(msg => (
                <div key={msg.id} className={cn('flex gap-2', !msg.inbound && 'flex-row-reverse')}>
                  <div className={cn(
                    'max-w-[80%] rounded-lg px-3 py-2 text-sm',
                    msg.inbound ? 'bg-muted' : 'bg-primary text-primary-foreground'
                  )}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium">{msg.from}</span>
                      <span className="text-[10px] opacity-70">{msg.time}</span>
                    </div>
                    <p className="text-xs">{msg.content}</p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Quick Reply - Compact */}
          <div className="border-t p-2 flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Paperclip className="h-4 w-4" />
            </Button>
            <Input placeholder="Quick reply..." className="h-8 text-sm" />
            <Button size="sm" className="h-8">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
