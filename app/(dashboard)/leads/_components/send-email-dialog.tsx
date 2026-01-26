'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { format, addHours } from 'date-fns'
import { Mail, Clock, Loader2, Send, ChevronDown } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { useToast } from '@/components/ui/use-toast'
import {
  EMAIL_TEMPLATE_CATEGORIES,
  EMAIL_TEMPLATE_CATEGORY_LABELS,
  type EmailTemplateRecord,
} from '@/lib/email/templates'
import {
  interpolate,
  buildTemplateContext,
} from '@/lib/email/templates/interpolate'
import type { LeadRecord } from '@/lib/leads/types'
import { cn } from '@/lib/utils'

import { createLeadEmail } from '../_actions'

type SendEmailDialogProps = {
  lead: LeadRecord
  senderName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function SendEmailDialog({
  lead,
  senderName,
  open,
  onOpenChange,
  onSuccess,
}: SendEmailDialogProps) {
  const { toast } = useToast()
  const [isSending, startSendTransition] = useTransition()
  const [templates, setTemplates] = useState<EmailTemplateRecord[]>([])
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)

  // Email fields
  const [toEmail, setToEmail] = useState(lead.contactEmail ?? '')
  const [subject, setSubject] = useState('')
  const [bodyHtml, setBodyHtml] = useState('')

  // Scheduling
  const [scheduleMode, setScheduleMode] = useState<'now' | 'later'>('now')
  const [scheduledAt, setScheduledAt] = useState('')
  const [showScheduleOptions, setShowScheduleOptions] = useState(false)

  // Build template context from lead data
  const templateContext = buildTemplateContext(
    { contactName: lead.contactName, companyName: lead.companyName },
    { fullName: senderName }
  )

  // Load templates when dialog opens
  useEffect(() => {
    if (!open) return

    const loadTemplates = async () => {
      setIsLoadingTemplates(true)
      try {
        const response = await fetch('/api/email-templates')
        if (response.ok) {
          const data = await response.json()
          setTemplates(data.templates ?? [])
        }
      } catch (error) {
        console.error('Failed to load templates:', error)
      } finally {
        setIsLoadingTemplates(false)
      }
    }

    loadTemplates()
  }, [open])

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setToEmail(lead.contactEmail ?? '')
      setSubject('')
      setBodyHtml('')
      setSelectedTemplateId(null)
      setScheduleMode('now')
      setScheduledAt('')
      setShowScheduleOptions(false)
    }
  }, [open, lead.contactEmail])

  // Apply selected template
  const handleTemplateSelect = useCallback(
    (templateId: string) => {
      setSelectedTemplateId(templateId)

      const template = templates.find(t => t.id === templateId)
      if (!template) return

      // Interpolate template with lead data
      setSubject(interpolate(template.subject, templateContext))
      setBodyHtml(interpolate(template.bodyHtml, templateContext))
    },
    [templates, templateContext]
  )

  const handleSend = useCallback(() => {
    if (!toEmail) {
      toast({
        variant: 'destructive',
        title: 'Missing recipient',
        description: 'Please enter a recipient email address.',
      })
      return
    }

    startSendTransition(async () => {
      const result = await createLeadEmail({
        leadId: lead.id,
        toEmail,
        subject,
        bodyHtml,
        scheduledAt: scheduleMode === 'later' && scheduledAt ? scheduledAt : null,
      })

      if (!result.success) {
        toast({
          variant: 'destructive',
          title: 'Unable to send email',
          description: result.error ?? 'Please try again.',
        })
        return
      }

      toast({
        title: scheduleMode === 'later' ? 'Email scheduled' : 'Email queued',
        description:
          scheduleMode === 'later'
            ? `Email will be sent at ${format(new Date(scheduledAt), 'PPp')}`
            : 'Your email has been queued for delivery.',
      })

      onOpenChange(false)
      onSuccess?.()
    })
  }, [
    lead.id,
    toEmail,
    subject,
    bodyHtml,
    scheduleMode,
    scheduledAt,
    toast,
    onOpenChange,
    onSuccess,
  ])

  // Group templates by category
  const templatesByCategory = templates.reduce(
    (acc, template) => {
      if (!acc[template.category]) {
        acc[template.category] = []
      }
      acc[template.category].push(template)
      return acc
    },
    {} as Record<string, EmailTemplateRecord[]>
  )

  const canSend = toEmail && subject && bodyHtml && !isSending

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-xl">
        <SheetHeader className="bg-transparent p-0 px-6 pt-6">
          <SheetTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Send Email to {lead.contactName}
          </SheetTitle>
          <SheetDescription>
            Select a template or compose your message directly.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
          {/* Template Selection */}
          <div className="space-y-2">
            <Label>Template</Label>
            {isLoadingTemplates ? (
              <div className="text-sm text-muted-foreground">Loading templates...</div>
            ) : templates.length === 0 ? (
              <div className="rounded-md border border-dashed p-3 text-center text-sm text-muted-foreground">
                No templates available. Create one in Settings.
              </div>
            ) : (
              <Select value={selectedTemplateId ?? ''} onValueChange={handleTemplateSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a template (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {EMAIL_TEMPLATE_CATEGORIES.map(category => {
                    const categoryTemplates = templatesByCategory[category]
                    if (!categoryTemplates?.length) return null

                    return (
                      <div key={category}>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                          {EMAIL_TEMPLATE_CATEGORY_LABELS[category]}
                        </div>
                        {categoryTemplates.map(template => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.name}
                            {template.isDefault && (
                              <span className="ml-2 text-xs text-muted-foreground">
                                (Default)
                              </span>
                            )}
                          </SelectItem>
                        ))}
                      </div>
                    )
                  })}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* To Email */}
          <div className="space-y-2">
            <Label htmlFor="to-email">To</Label>
            <Input
              id="to-email"
              type="email"
              value={toEmail}
              onChange={e => setToEmail(e.target.value)}
              placeholder="recipient@example.com"
            />
          </div>

          {/* Subject */}
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Email subject line"
            />
          </div>

          {/* Body */}
          <div className="space-y-2">
            <Label>Message</Label>
            <RichTextEditor
              id="email-body"
              value={bodyHtml}
              onChange={setBodyHtml}
              contentMinHeightClassName="[&_.ProseMirror]:min-h-[200px]"
            />
          </div>

          {/* Schedule Options */}
          <Collapsible open={showScheduleOptions} onOpenChange={setShowScheduleOptions}>
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-2 text-muted-foreground"
              >
                <Clock className="h-4 w-4" />
                Schedule for later
                <ChevronDown
                  className={cn(
                    'h-4 w-4 transition-transform',
                    showScheduleOptions && 'rotate-180'
                  )}
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3 space-y-3">
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant={scheduleMode === 'now' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setScheduleMode('now')}
                >
                  Send now
                </Button>
                <Button
                  type="button"
                  variant={scheduleMode === 'later' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setScheduleMode('later')
                    // Default to 1 hour from now
                    if (!scheduledAt) {
                      const defaultTime = addHours(new Date(), 1)
                      setScheduledAt(defaultTime.toISOString().slice(0, 16))
                    }
                  }}
                >
                  Schedule
                </Button>
              </div>
              {scheduleMode === 'later' && (
                <div className="space-y-2">
                  <Label htmlFor="scheduled-at">Send at</Label>
                  <Input
                    id="scheduled-at"
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={e => setScheduledAt(e.target.value)}
                    min={new Date().toISOString().slice(0, 16)}
                  />
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        </div>

        <div className="flex items-center justify-end gap-2 border-t px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={!canSend}>
            {isSending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {scheduleMode === 'later' ? 'Scheduling...' : 'Sending...'}
              </>
            ) : scheduleMode === 'later' ? (
              <>
                <Clock className="mr-2 h-4 w-4" />
                Schedule
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send
              </>
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
