'use client'

import { useState } from 'react'
import {
  Send,
  Paperclip,
  X,
  ChevronDown,
  Sparkles,
  Clock,
  FileText,
  Users,
  Link2,
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  Code,
  Image,
  Smile,
  MoreHorizontal,
  RefreshCw,
  Check,
  AlertCircle,
  Calendar,
  Building2,
  User,
  Mail,
  Star,
  Trash2,
  Copy,
  ExternalLink,
  Wand2,
  MessageSquare,
  Zap,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { AppShellHeader } from '@/components/layout/app-shell'

// Mock data
const mockTemplates = [
  { id: '1', name: 'Initial Outreach', category: 'Sales', preview: 'Hi {{name}}, I wanted to reach out about...' },
  { id: '2', name: 'Follow-up', category: 'Sales', preview: 'Following up on our conversation...' },
  { id: '3', name: 'Proposal Introduction', category: 'Sales', preview: 'Thank you for your interest. Attached is...' },
  { id: '4', name: 'Meeting Request', category: 'Scheduling', preview: 'Would you be available for a quick call...' },
  { id: '5', name: 'Project Update', category: 'Client', preview: 'Here\'s the latest update on your project...' },
  { id: '6', name: 'Invoice Reminder', category: 'Billing', preview: 'This is a friendly reminder that invoice...' },
]

const mockContacts = [
  { id: '1', name: 'Sarah Chen', email: 'sarah@techstart.io', company: 'TechStart Inc', type: 'lead' },
  { id: '2', name: 'Michael Park', email: 'michael@acmecorp.com', company: 'Acme Corp', type: 'client' },
  { id: '3', name: 'Emily Rodriguez', email: 'emily@innovate.co', company: 'Innovate Co', type: 'lead' },
  { id: '4', name: 'David Kim', email: 'david@enterprise.io', company: 'Enterprise Solutions', type: 'client' },
]

const mockSuggestedReplies = [
  { id: '1', label: 'Confirm meeting', preview: 'That time works perfectly for me. I\'ll send a calendar invite shortly.' },
  { id: '2', label: 'Request more info', preview: 'Thanks for reaching out. Could you provide more details about...' },
  { id: '3', label: 'Polite decline', preview: 'Thank you for thinking of us, but at this time we\'re not able to...' },
]

const mockAITones = [
  { id: 'professional', label: 'Professional', icon: '💼' },
  { id: 'friendly', label: 'Friendly', icon: '😊' },
  { id: 'concise', label: 'Concise', icon: '📝' },
  { id: 'detailed', label: 'Detailed', icon: '📋' },
]

// Recipient chip component
function RecipientChip({ contact, onRemove }: { contact: typeof mockContacts[0], onRemove: () => void }) {
  return (
    <div className="inline-flex items-center gap-1 bg-muted rounded-full pl-1 pr-2 py-0.5 text-sm">
      <Avatar className="h-5 w-5">
        <AvatarFallback className="text-[10px]">
          {contact.name.split(' ').map(n => n[0]).join('')}
        </AvatarFallback>
      </Avatar>
      <span>{contact.name}</span>
      <button onClick={onRemove} className="ml-1 hover:text-destructive">
        <X className="h-3 w-3" />
      </button>
    </div>
  )
}

// Template picker component
function TemplatePicker({ onSelect }: { onSelect: (template: typeof mockTemplates[0]) => void }) {
  const [search, setSearch] = useState('')
  const categories = [...new Set(mockTemplates.map(t => t.category))]

  const filtered = mockTemplates.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.category.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="w-80">
      <div className="p-3 border-b">
        <Input
          placeholder="Search templates..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8"
        />
      </div>
      <ScrollArea className="h-64">
        <div className="p-2">
          {categories.map(category => {
            const categoryTemplates = filtered.filter(t => t.category === category)
            if (categoryTemplates.length === 0) return null
            return (
              <div key={category} className="mb-3">
                <p className="text-xs font-medium text-muted-foreground px-2 mb-1">{category}</p>
                {categoryTemplates.map(template => (
                  <button
                    key={template.id}
                    onClick={() => onSelect(template)}
                    className="w-full text-left p-2 rounded-md hover:bg-muted transition-colors"
                  >
                    <p className="font-medium text-sm">{template.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{template.preview}</p>
                  </button>
                ))}
              </div>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}

// AI Assist panel
function AIAssistPanel({ onInsert }: { onInsert: (text: string) => void }) {
  const [generating, setGenerating] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [tone, setTone] = useState('professional')
  const [generatedDraft, setGeneratedDraft] = useState('')

  const handleGenerate = () => {
    setGenerating(true)
    // Simulate AI generation
    setTimeout(() => {
      setGeneratedDraft(`Dear Sarah,

Thank you for your interest in our services. Based on our conversation, I believe we can provide significant value to TechStart Inc.

I've attached a proposal outlining our approach and pricing. Key highlights include:

• Custom web application development
• 90-day delivery timeline
• Dedicated project manager
• Post-launch support package

I'd love to schedule a call to walk through the details. Would Thursday at 2pm work for you?

Best regards,
Damon`)
      setGenerating(false)
    }, 1500)
  }

  return (
    <div className="border rounded-lg bg-gradient-to-br from-violet-500/5 to-purple-500/5">
      <div className="p-3 border-b flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-violet-500" />
        <span className="font-medium text-sm">AI Assist</span>
      </div>

      <div className="p-3 space-y-3">
        {/* Quick suggestions */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Quick Replies</p>
          <div className="space-y-1">
            {mockSuggestedReplies.map(reply => (
              <button
                key={reply.id}
                onClick={() => onInsert(reply.preview)}
                className="w-full text-left p-2 rounded-md border bg-background hover:bg-muted transition-colors text-sm"
              >
                <p className="font-medium">{reply.label}</p>
                <p className="text-xs text-muted-foreground truncate">{reply.preview}</p>
              </button>
            ))}
          </div>
        </div>

        <Separator />

        {/* Custom generation */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Generate Custom</p>
          <Textarea
            placeholder="Describe what you want to write... e.g., 'Follow up on proposal, mention 10% discount'"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="h-20 text-sm"
          />

          <div className="flex items-center gap-2 mt-2">
            <Select value={tone} onValueChange={setTone}>
              <SelectTrigger className="w-32 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {mockAITones.map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    <span className="flex items-center gap-2">
                      <span>{t.icon}</span>
                      <span>{t.label}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              size="sm"
              onClick={handleGenerate}
              disabled={!prompt || generating}
              className="gap-1"
            >
              {generating ? (
                <>
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Wand2 className="h-3 w-3" />
                  Generate
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Generated draft */}
        {generatedDraft && (
          <div className="border rounded-md bg-background">
            <div className="p-2 border-b flex items-center justify-between">
              <span className="text-xs font-medium">Generated Draft</span>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => setGeneratedDraft('')}>
                  <RefreshCw className="h-3 w-3" />
                </Button>
                <Button size="sm" className="h-6 px-2" onClick={() => onInsert(generatedDraft)}>
                  <Check className="h-3 w-3 mr-1" />
                  Use
                </Button>
              </div>
            </div>
            <div className="p-2 text-sm whitespace-pre-wrap max-h-48 overflow-y-auto">
              {generatedDraft}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Link to entity popover
function LinkEntityPopover() {
  return (
    <PopoverContent className="w-64 p-0">
      <div className="p-2 border-b">
        <Input placeholder="Search leads, clients, projects..." className="h-8" />
      </div>
      <div className="p-2 space-y-1">
        <p className="text-xs font-medium text-muted-foreground px-2">Recent</p>
        <button className="w-full text-left p-2 rounded-md hover:bg-muted flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">TechStart Inc</p>
            <p className="text-xs text-muted-foreground">Client</p>
          </div>
        </button>
        <button className="w-full text-left p-2 rounded-md hover:bg-muted flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">Sarah Chen</p>
            <p className="text-xs text-muted-foreground">Lead · TechStart Inc</p>
          </div>
        </button>
      </div>
    </PopoverContent>
  )
}

// Main compose page
export default function EmailComposeWireframePage() {
  const [recipients, setRecipients] = useState<typeof mockContacts>([mockContacts[0]])
  const [cc, setCc] = useState<typeof mockContacts>([])
  const [bcc, setBcc] = useState<typeof mockContacts>([])
  const [showCc, setShowCc] = useState(false)
  const [showBcc, setShowBcc] = useState(false)
  const [subject, setSubject] = useState('Re: Project Proposal Discussion')
  const [body, setBody] = useState('')
  const [showAI, setShowAI] = useState(true)
  const [scheduling, setScheduling] = useState(false)
  const [scheduledTime, setScheduledTime] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  const handleSend = () => {
    setSending(true)
    setTimeout(() => {
      setSending(false)
      // Would redirect after send
    }, 1500)
  }

  return (
    <TooltipProvider>
      <>
        <AppShellHeader>
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">Compose</h1>
              {scheduledTime && (
                <Badge variant="secondary" className="gap-1">
                  <Clock className="h-3 w-3" />
                  Scheduled: {scheduledTime}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <Trash2 className="h-4 w-4 mr-2" />
                Discard
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Clock className="h-4 w-4 mr-2" />
                    Schedule
                    <ChevronDown className="h-4 w-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setScheduledTime('Tomorrow 9:00 AM')}>
                    Tomorrow morning (9:00 AM)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setScheduledTime('Tomorrow 1:00 PM')}>
                    Tomorrow afternoon (1:00 PM)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setScheduledTime('Monday 9:00 AM')}>
                    Monday morning (9:00 AM)
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <Calendar className="h-4 w-4 mr-2" />
                    Pick date & time...
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button onClick={handleSend} disabled={sending || recipients.length === 0}>
                {sending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send
                  </>
                )}
              </Button>
            </div>
          </div>
        </AppShellHeader>

        <div className="flex gap-6 p-6 h-[calc(100vh-8rem)]">
          {/* Main compose area */}
          <div className="flex-1 flex flex-col bg-background rounded-xl border shadow-sm overflow-hidden">
            {/* Email header fields */}
            <div className="p-4 border-b space-y-3">
              {/* To field */}
              <div className="flex items-start gap-3">
                <label className="text-sm text-muted-foreground w-12 pt-2">To</label>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-1 p-2 border rounded-md min-h-[40px] focus-within:ring-2 focus-within:ring-ring">
                    {recipients.map(r => (
                      <RecipientChip
                        key={r.id}
                        contact={r}
                        onRemove={() => setRecipients(recipients.filter(x => x.id !== r.id))}
                      />
                    ))}
                    <input
                      type="text"
                      placeholder={recipients.length === 0 ? "Add recipients..." : ""}
                      className="flex-1 min-w-[120px] bg-transparent outline-none text-sm"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-1 pt-2">
                  {!showCc && (
                    <Button variant="ghost" size="sm" onClick={() => setShowCc(true)}>Cc</Button>
                  )}
                  {!showBcc && (
                    <Button variant="ghost" size="sm" onClick={() => setShowBcc(true)}>Bcc</Button>
                  )}
                </div>
              </div>

              {/* Cc field */}
              {showCc && (
                <div className="flex items-start gap-3">
                  <label className="text-sm text-muted-foreground w-12 pt-2">Cc</label>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-1 p-2 border rounded-md min-h-[40px]">
                      {cc.map(r => (
                        <RecipientChip
                          key={r.id}
                          contact={r}
                          onRemove={() => setCc(cc.filter(x => x.id !== r.id))}
                        />
                      ))}
                      <input
                        type="text"
                        placeholder="Add Cc..."
                        className="flex-1 min-w-[120px] bg-transparent outline-none text-sm"
                      />
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="pt-2" onClick={() => setShowCc(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {/* Bcc field */}
              {showBcc && (
                <div className="flex items-start gap-3">
                  <label className="text-sm text-muted-foreground w-12 pt-2">Bcc</label>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-1 p-2 border rounded-md min-h-[40px]">
                      {bcc.map(r => (
                        <RecipientChip
                          key={r.id}
                          contact={r}
                          onRemove={() => setBcc(bcc.filter(x => x.id !== r.id))}
                        />
                      ))}
                      <input
                        type="text"
                        placeholder="Add Bcc..."
                        className="flex-1 min-w-[120px] bg-transparent outline-none text-sm"
                      />
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="pt-2" onClick={() => setShowBcc(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {/* Subject */}
              <div className="flex items-center gap-3">
                <label className="text-sm text-muted-foreground w-12">Subject</label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Email subject..."
                  className="flex-1"
                />
              </div>
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-1 p-2 border-b bg-muted/30">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-1">
                    <FileText className="h-4 w-4" />
                    Templates
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0" align="start">
                  <TemplatePicker onSelect={(t) => setBody(t.preview)} />
                </PopoverContent>
              </Popover>

              <Separator orientation="vertical" className="h-6 mx-1" />

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Bold className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Bold</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Italic className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Italic</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <List className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Bullet list</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <ListOrdered className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Numbered list</TooltipContent>
              </Tooltip>

              <Separator orientation="vertical" className="h-6 mx-1" />

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Link2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Insert link</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Image className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Insert image</TooltipContent>
              </Tooltip>

              <div className="flex-1" />

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-1">
                    <Building2 className="h-4 w-4" />
                    Link to...
                  </Button>
                </PopoverTrigger>
                <LinkEntityPopover />
              </Popover>

              <Button
                variant={showAI ? "secondary" : "ghost"}
                size="sm"
                className="gap-1"
                onClick={() => setShowAI(!showAI)}
              >
                <Sparkles className="h-4 w-4" />
                AI Assist
              </Button>
            </div>

            {/* Body */}
            <div className="flex-1 p-4 overflow-y-auto">
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write your email..."
                className="min-h-[300px] border-0 resize-none focus-visible:ring-0 text-base"
              />
            </div>

            {/* Attachments bar */}
            <div className="border-t p-3 flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-1">
                <Paperclip className="h-4 w-4" />
                Attach files
              </Button>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="gap-1">
                  <FileText className="h-3 w-3" />
                  proposal-v2.pdf
                  <button className="ml-1 hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              </div>
            </div>
          </div>

          {/* AI Assist sidebar */}
          {showAI && (
            <div className="w-80 shrink-0">
              <AIAssistPanel onInsert={(text) => setBody(body + '\n\n' + text)} />

              {/* Context info */}
              <div className="mt-4 border rounded-lg p-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">Context</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>Sarah Chen</span>
                    <Badge variant="outline" className="ml-auto">Lead</Badge>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span>TechStart Inc</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    <span>12 previous emails</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Zap className="h-4 w-4 text-amber-500" />
                    <span className="text-amber-600">Hot lead · 82 score</span>
                  </div>
                </div>
              </div>

              {/* Recent thread */}
              <Collapsible className="mt-4 border rounded-lg">
                <CollapsibleTrigger className="flex items-center justify-between w-full p-3 hover:bg-muted/50">
                  <span className="text-sm font-medium">Previous Thread</span>
                  <ChevronDown className="h-4 w-4" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-3 pb-3 space-y-2">
                    <div className="p-2 bg-muted/50 rounded text-sm">
                      <p className="font-medium text-xs text-muted-foreground">Sarah Chen · 2 hours ago</p>
                      <p className="mt-1">Thanks for sending the proposal! I have a few questions about the timeline...</p>
                    </div>
                    <div className="p-2 bg-primary/5 rounded text-sm border-l-2 border-primary">
                      <p className="font-medium text-xs text-muted-foreground">You · Yesterday</p>
                      <p className="mt-1">Hi Sarah, Attached is our proposal for the web application project...</p>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}
        </div>
      </>
    </TooltipProvider>
  )
}
