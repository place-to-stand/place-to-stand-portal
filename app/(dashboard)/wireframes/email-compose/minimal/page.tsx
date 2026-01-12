'use client'

import { useState } from 'react'
import {
  Send,
  Paperclip,
  X,
  Sparkles,
  ArrowLeft,
  MoreHorizontal,
  ChevronDown,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export default function EmailComposeMinimalPage() {
  const [recipients, setRecipients] = useState([
    { id: '1', name: 'Jennifer Adams', email: 'jadams@acmecorp.com' }
  ])
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')

  return (
    <div className="h-[calc(100vh-4rem)] bg-muted/30 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl bg-white dark:bg-neutral-900 rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b flex items-center gap-3">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-semibold flex-1">New Email</h1>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <MoreHorizontal className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Save as draft</DropdownMenuItem>
              <DropdownMenuItem>Schedule send</DropdownMenuItem>
              <DropdownMenuItem>Discard</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Form */}
        <div className="p-6 space-y-4">
          {/* To */}
          <div>
            <label className="text-sm text-muted-foreground mb-2 block">To</label>
            <div className="flex flex-wrap items-center gap-2 p-3 bg-muted/50 rounded-xl min-h-[48px]">
              {recipients.map(r => (
                <div key={r.id} className="flex items-center gap-2 bg-white dark:bg-neutral-800 rounded-full pl-1 pr-2 py-1 shadow-sm">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-[10px]">{r.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm">{r.name}</span>
                  <button onClick={() => setRecipients(recipients.filter(x => x.id !== r.id))}>
                    <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                  </button>
                </div>
              ))}
              <Input
                placeholder="Add recipient..."
                className="flex-1 min-w-[150px] border-0 bg-transparent focus-visible:ring-0 h-8"
              />
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="text-sm text-muted-foreground mb-2 block">Subject</label>
            <Input
              placeholder="What's this about?"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="h-12 rounded-xl bg-muted/50 border-0"
            />
          </div>

          {/* Body */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-muted-foreground">Message</label>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-violet-600">
                <Sparkles className="h-3 w-3" />
                AI Draft
              </Button>
            </div>
            <Textarea
              placeholder="Write your message..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="min-h-[200px] rounded-xl bg-muted/50 border-0 resize-none"
            />
          </div>

          {/* Attachments */}
          <Button variant="outline" className="w-full h-12 rounded-xl border-dashed">
            <Paperclip className="h-4 w-4 mr-2" />
            Add attachment
          </Button>
        </div>

        {/* Footer */}
        <div className="p-6 pt-0">
          <Button
            className="w-full h-12 rounded-full text-base"
            disabled={recipients.length === 0 || !subject}
          >
            <Send className="h-5 w-5 mr-2" />
            Send Email
          </Button>
          <p className="text-center text-xs text-muted-foreground mt-3">
            Press ⌘ + Enter to send
          </p>
        </div>
      </div>
    </div>
  )
}
