'use client'

import { useState } from 'react'
import {
  Send,
  Paperclip,
  X,
  Sparkles,
  Clock,
  FileText,
  Image,
  Link,
  Bold,
  Italic,
  List,
  ChevronDown,
  Plus,
  Search,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

const mockTemplates = [
  { id: '1', name: 'Follow Up', description: 'Standard follow-up after meeting', icon: '📧' },
  { id: '2', name: 'Proposal', description: 'Send project proposal', icon: '📄' },
  { id: '3', name: 'Invoice', description: 'Invoice delivery email', icon: '💰' },
  { id: '4', name: 'Thank You', description: 'Thank you for meeting', icon: '🙏' },
]

const mockContacts = [
  { id: '1', name: 'Jennifer Adams', email: 'jadams@acmecorp.com', company: 'Acme Corp' },
  { id: '2', name: 'Robert Kim', email: 'rkim@techstart.io', company: 'TechStart' },
  { id: '3', name: 'Lisa Park', email: 'lpark@innovate.co', company: 'Innovate Co' },
]

const mockAiSuggestions = [
  { id: '1', label: 'Add meeting link', type: 'enhancement' },
  { id: '2', label: 'Include project timeline', type: 'enhancement' },
  { id: '3', label: 'Mention next steps', type: 'structure' },
]

export default function EmailComposeCardsPage() {
  const [selectedRecipients, setSelectedRecipients] = useState<typeof mockContacts>([mockContacts[0]])
  const [showTemplates, setShowTemplates] = useState(true)

  return (
    <div className="h-[calc(100vh-4rem)] p-6">
      <div className="max-w-6xl mx-auto grid grid-cols-3 gap-6 h-full">
        {/* Left - Compose Form */}
        <div className="col-span-2 flex flex-col">
          <Card className="flex-1 flex flex-col">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle>New Email</CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm">
                    <Clock className="h-4 w-4 mr-2" />
                    Schedule
                  </Button>
                  <Button variant="outline" size="sm">Save Draft</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              {/* To Field */}
              <div className="mb-4">
                <label className="text-sm font-medium mb-2 block">To</label>
                <div className="flex flex-wrap items-center gap-2 p-2 border rounded-lg min-h-[44px]">
                  {selectedRecipients.map(r => (
                    <Badge key={r.id} variant="secondary" className="h-7 px-2 gap-1">
                      {r.name}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => setSelectedRecipients(selectedRecipients.filter(s => s.id !== r.id))} />
                    </Badge>
                  ))}
                  <Input placeholder="Add recipient..." className="flex-1 border-0 h-7 min-w-[150px] focus-visible:ring-0" />
                </div>
              </div>

              {/* Subject */}
              <div className="mb-4">
                <label className="text-sm font-medium mb-2 block">Subject</label>
                <Input placeholder="Email subject..." />
              </div>

              {/* Toolbar */}
              <div className="flex items-center gap-1 mb-2 p-2 bg-muted/50 rounded-lg">
                <Button variant="ghost" size="icon" className="h-8 w-8"><Bold className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8"><Italic className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8"><List className="h-4 w-4" /></Button>
                <div className="w-px h-6 bg-border mx-1" />
                <Button variant="ghost" size="icon" className="h-8 w-8"><Link className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8"><Image className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8"><Paperclip className="h-4 w-4" /></Button>
                <div className="ml-auto">
                  <Button variant="outline" size="sm" className="gap-2">
                    <Sparkles className="h-4 w-4 text-violet-500" />
                    AI Assist
                  </Button>
                </div>
              </div>

              {/* Body */}
              <Textarea
                placeholder="Write your message..."
                className="flex-1 min-h-[200px] resize-none"
              />

              {/* AI Suggestions */}
              <div className="mt-4 p-3 rounded-lg bg-violet-50 dark:bg-violet-950/30">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-violet-500" />
                  <span className="text-sm font-medium text-violet-700 dark:text-violet-300">AI Suggestions</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {mockAiSuggestions.map(s => (
                    <Button key={s.id} variant="outline" size="sm" className="h-7 text-xs bg-white dark:bg-neutral-900">
                      <Plus className="h-3 w-3 mr-1" />
                      {s.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Send Actions */}
              <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t">
                <Button variant="outline">Cancel</Button>
                <Button className="gap-2">
                  <Send className="h-4 w-4" />
                  Send Email
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right - Templates & Contacts */}
        <div className="flex flex-col gap-4">
          {/* Templates */}
          <Card className={cn('transition-all', showTemplates ? 'flex-1' : '')}>
            <CardHeader className="pb-2 cursor-pointer" onClick={() => setShowTemplates(!showTemplates)}>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Templates</CardTitle>
                <ChevronDown className={cn('h-4 w-4 transition-transform', !showTemplates && '-rotate-90')} />
              </div>
            </CardHeader>
            {showTemplates && (
              <CardContent>
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2">
                    {mockTemplates.map(t => (
                      <button key={t.id} className="w-full p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left">
                        <div className="flex items-center gap-2 mb-1">
                          <span>{t.icon}</span>
                          <span className="font-medium text-sm">{t.name}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{t.description}</p>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            )}
          </Card>

          {/* Recent Contacts */}
          <Card className="flex-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Recent Contacts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative mb-3">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search contacts..." className="h-8 pl-8 text-sm" />
              </div>
              <ScrollArea className="h-[200px]">
                <div className="space-y-2">
                  {mockContacts.map(c => (
                    <button
                      key={c.id}
                      className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                      onClick={() => {
                        if (!selectedRecipients.find(r => r.id === c.id)) {
                          setSelectedRecipients([...selectedRecipients, c])
                        }
                      }}
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">{c.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                      </Avatar>
                      <div className="text-left">
                        <div className="text-sm font-medium">{c.name}</div>
                        <div className="text-xs text-muted-foreground">{c.company}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
