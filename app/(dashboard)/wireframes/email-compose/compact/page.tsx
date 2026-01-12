'use client'

import { useState } from 'react'
import {
  Send,
  Paperclip,
  X,
  Sparkles,
  Clock,
  Bold,
  Italic,
  List,
  Link,
  Image,
  ChevronDown,
  MoreHorizontal,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

const mockRecipients = [
  { id: '1', name: 'Jennifer Adams', email: 'jadams@acmecorp.com' },
]

export default function EmailComposeCompactPage() {
  const [recipients, setRecipients] = useState(mockRecipients)
  const [showCc, setShowCc] = useState(false)
  const [showBcc, setShowBcc] = useState(false)

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Compact Header */}
      <div className="border-b px-4 py-2 flex items-center justify-between bg-background">
        <div className="flex items-center gap-2">
          <h1 className="font-semibold">New Email</h1>
          <Badge variant="secondary" className="text-xs">Draft</Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-8">
            <Clock className="h-4 w-4 mr-1" />
            Schedule
          </Button>
          <Button variant="ghost" size="sm" className="h-8">Save</Button>
          <Button variant="ghost" size="sm" className="h-8 text-red-600">Discard</Button>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 flex flex-col p-4 max-w-4xl mx-auto w-full">
        {/* Recipients */}
        <div className="space-y-2 mb-4">
          {/* To */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground w-12">To:</span>
            <div className="flex-1 flex flex-wrap items-center gap-1 min-h-[32px]">
              {recipients.map(r => (
                <Badge key={r.id} variant="secondary" className="h-6 text-xs gap-1">
                  {r.email}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setRecipients(recipients.filter(x => x.id !== r.id))} />
                </Badge>
              ))}
              <Input placeholder="Add..." className="flex-1 h-6 border-0 min-w-[100px] focus-visible:ring-0 text-sm" />
            </div>
            <div className="flex items-center gap-1 text-xs">
              {!showCc && <button className="text-muted-foreground hover:text-foreground" onClick={() => setShowCc(true)}>Cc</button>}
              {!showBcc && <button className="text-muted-foreground hover:text-foreground" onClick={() => setShowBcc(true)}>Bcc</button>}
            </div>
          </div>

          {/* Cc */}
          {showCc && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground w-12">Cc:</span>
              <Input placeholder="Add Cc recipients..." className="flex-1 h-8 text-sm" />
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowCc(false)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}

          {/* Bcc */}
          {showBcc && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground w-12">Bcc:</span>
              <Input placeholder="Add Bcc recipients..." className="flex-1 h-8 text-sm" />
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowBcc(false)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}

          {/* Subject */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground w-12">Subj:</span>
            <Input placeholder="Subject..." className="flex-1 h-8 text-sm" />
          </div>
        </div>

        {/* Toolbar - Compact */}
        <div className="flex items-center gap-0.5 mb-2 py-1 border-y">
          <Button variant="ghost" size="icon" className="h-7 w-7"><Bold className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7"><Italic className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7"><List className="h-3.5 w-3.5" /></Button>
          <div className="w-px h-5 bg-border mx-1" />
          <Button variant="ghost" size="icon" className="h-7 w-7"><Link className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7"><Image className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7"><Paperclip className="h-3.5 w-3.5" /></Button>

          <div className="ml-auto flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                  <Sparkles className="h-3 w-3 text-violet-500" />
                  AI
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>Generate draft</DropdownMenuItem>
                <DropdownMenuItem>Improve writing</DropdownMenuItem>
                <DropdownMenuItem>Make shorter</DropdownMenuItem>
                <DropdownMenuItem>Make longer</DropdownMenuItem>
                <DropdownMenuItem>Fix grammar</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                  Templates
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>Follow Up</DropdownMenuItem>
                <DropdownMenuItem>Proposal</DropdownMenuItem>
                <DropdownMenuItem>Thank You</DropdownMenuItem>
                <DropdownMenuItem>Invoice</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Body */}
        <Textarea
          placeholder="Write your message..."
          className="flex-1 resize-none text-sm"
        />

        {/* Footer */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Auto-saved 1m ago</span>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>Send later</DropdownMenuItem>
                <DropdownMenuItem>Save as template</DropdownMenuItem>
                <DropdownMenuItem>Print</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button className="h-8">
              <Send className="h-4 w-4 mr-2" />
              Send
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
