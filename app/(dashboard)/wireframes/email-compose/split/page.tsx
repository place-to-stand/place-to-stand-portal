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
  FileText,
  ChevronRight,
  Search,
  Building2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

const mockContacts = [
  { id: '1', name: 'Jennifer Adams', email: 'jadams@acmecorp.com', company: 'Acme Corp', recent: true },
  { id: '2', name: 'Robert Kim', email: 'rkim@techstart.io', company: 'TechStart', recent: true },
  { id: '3', name: 'Lisa Park', email: 'lpark@innovate.co', company: 'Innovate Co', recent: true },
  { id: '4', name: 'David Chen', email: 'dchen@cloudnine.com', company: 'CloudNine', recent: false },
  { id: '5', name: 'Sarah Lee', email: 'slee@dataflow.io', company: 'DataFlow', recent: false },
]

const mockTemplates = [
  { id: '1', name: 'Follow Up', preview: 'Thank you for taking the time to meet...' },
  { id: '2', name: 'Proposal', preview: 'Please find attached our proposal for...' },
  { id: '3', name: 'Invoice', preview: 'Attached is the invoice for services...' },
]

export default function EmailComposeSplitPage() {
  const [selectedRecipients, setSelectedRecipients] = useState<typeof mockContacts>([])
  const [activePanel, setActivePanel] = useState<'contacts' | 'templates'>('contacts')

  const addRecipient = (contact: typeof mockContacts[0]) => {
    if (!selectedRecipients.find(r => r.id === contact.id)) {
      setSelectedRecipients([...selectedRecipients, contact])
    }
  }

  const removeRecipient = (id: string) => {
    setSelectedRecipients(selectedRecipients.filter(r => r.id !== id))
  }

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Left Panel - Contacts/Templates */}
      <div className="w-80 border-r flex flex-col bg-muted/20">
        {/* Panel Tabs */}
        <div className="p-2 border-b flex gap-1">
          <button
            className={cn(
              'flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              activePanel === 'contacts' ? 'bg-background shadow-sm' : 'hover:bg-muted/50'
            )}
            onClick={() => setActivePanel('contacts')}
          >
            Contacts
          </button>
          <button
            className={cn(
              'flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              activePanel === 'templates' ? 'bg-background shadow-sm' : 'hover:bg-muted/50'
            )}
            onClick={() => setActivePanel('templates')}
          >
            Templates
          </button>
        </div>

        {activePanel === 'contacts' ? (
          <>
            {/* Search */}
            <div className="p-3 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search contacts..." className="pl-9 h-9" />
              </div>
            </div>

            {/* Contacts List */}
            <ScrollArea className="flex-1">
              <div className="p-2">
                <div className="text-xs font-medium text-muted-foreground px-2 py-1">Recent</div>
                {mockContacts.filter(c => c.recent).map(c => (
                  <button
                    key={c.id}
                    className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                    onClick={() => addRecipient(c)}
                  >
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="text-xs">{c.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 text-left min-w-0">
                      <div className="text-sm font-medium truncate">{c.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{c.company}</div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}

                <Separator className="my-2" />

                <div className="text-xs font-medium text-muted-foreground px-2 py-1">All Contacts</div>
                {mockContacts.filter(c => !c.recent).map(c => (
                  <button
                    key={c.id}
                    className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                    onClick={() => addRecipient(c)}
                  >
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="text-xs">{c.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 text-left min-w-0">
                      <div className="text-sm font-medium truncate">{c.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{c.company}</div>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </>
        ) : (
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-2">
              {mockTemplates.map(t => (
                <button
                  key={t.id}
                  className="w-full p-3 rounded-lg border bg-background hover:shadow-md transition-all text-left"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm">{t.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{t.preview}</p>
                </button>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Right Panel - Compose */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between bg-background">
          <h1 className="font-semibold">Compose Email</h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Clock className="h-4 w-4 mr-2" />
              Schedule
            </Button>
            <Button variant="outline" size="sm">Save Draft</Button>
          </div>
        </div>

        {/* Form */}
        <div className="flex-1 flex flex-col p-6 overflow-auto">
          {/* To */}
          <div className="mb-4">
            <label className="text-sm font-medium mb-2 block">To</label>
            <div className="flex flex-wrap items-center gap-2 p-3 border rounded-lg min-h-[48px]">
              {selectedRecipients.map(r => (
                <Badge key={r.id} variant="secondary" className="h-7 gap-2 pl-1">
                  <Avatar className="h-5 w-5">
                    <AvatarFallback className="text-[10px]">{r.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                  </Avatar>
                  {r.name}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => removeRecipient(r.id)} />
                </Badge>
              ))}
              {selectedRecipients.length === 0 && (
                <span className="text-sm text-muted-foreground">Select contacts from the left panel</span>
              )}
            </div>
          </div>

          {/* Subject */}
          <div className="mb-4">
            <label className="text-sm font-medium mb-2 block">Subject</label>
            <Input placeholder="Enter subject..." className="h-11" />
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-1 mb-3 p-2 bg-muted/50 rounded-lg">
            <Button variant="ghost" size="icon" className="h-8 w-8"><Bold className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8"><Italic className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8"><List className="h-4 w-4" /></Button>
            <Separator orientation="vertical" className="h-6 mx-1" />
            <Button variant="ghost" size="icon" className="h-8 w-8"><Link className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8"><Image className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8"><Paperclip className="h-4 w-4" /></Button>
            <div className="ml-auto">
              <Button variant="outline" size="sm">
                <Sparkles className="h-4 w-4 mr-2 text-violet-500" />
                AI Draft
              </Button>
            </div>
          </div>

          {/* Body */}
          <Textarea
            placeholder="Write your email..."
            className="flex-1 min-h-[300px] resize-none"
          />
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex items-center justify-end gap-3 bg-background">
          <Button variant="outline">Cancel</Button>
          <Button disabled={selectedRecipients.length === 0}>
            <Send className="h-4 w-4 mr-2" />
            Send Email
          </Button>
        </div>
      </div>
    </div>
  )
}
