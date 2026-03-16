'use client'

import { Building2, Mail, Phone, Globe, FileText, MessageSquare, Video } from 'lucide-react'

import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { LeadRecord } from '@/lib/leads/types'

import { ContextNotes } from './context-notes'
import { ContextTranscripts } from './context-transcripts'
import { ContextEmails } from './context-emails'

type ContextPanelProps = {
  lead: LeadRecord
  onInsert?: (text: string, source: string) => void
}

export function ContextPanel({ lead, onInsert }: ContextPanelProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex w-[380px] flex-shrink-0 flex-col border-r bg-muted/30">
      {/* Lead Info Header */}
      <div className="flex-shrink-0 space-y-3 p-4">
        <div className="space-y-1">
          <h3 className="font-semibold text-sm">{lead.contactName}</h3>
          {lead.companyName && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Building2 className="h-3 w-3" />
              {lead.companyName}
            </div>
          )}
        </div>

        <div className="space-y-1.5 text-xs">
          {lead.contactEmail && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Mail className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{lead.contactEmail}</span>
            </div>
          )}
          {lead.contactPhone && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Phone className="h-3 w-3 flex-shrink-0" />
              <span>{lead.contactPhone}</span>
            </div>
          )}
          {lead.companyWebsite && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Globe className="h-3 w-3 flex-shrink-0" />
              <a
                href={lead.companyWebsite}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate hover:text-foreground hover:underline"
              >
                {lead.companyWebsite.replace(/^https?:\/\//, '')}
              </a>
            </div>
          )}
        </div>

        {lead.estimatedValue && (
          <div className="rounded-md bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            Est. ${lead.estimatedValue.toLocaleString()}
          </div>
        )}
      </div>

      <Separator />

      {/* Context Tabs */}
      <Tabs defaultValue="notes" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="mx-4 mt-3 grid w-auto grid-cols-3">
          <TabsTrigger value="notes" className="text-xs">
            <FileText className="mr-1 h-3 w-3" />
            Notes
          </TabsTrigger>
          <TabsTrigger value="transcripts" className="text-xs">
            <Video className="mr-1 h-3 w-3" />
            Calls
          </TabsTrigger>
          <TabsTrigger value="emails" className="text-xs">
            <MessageSquare className="mr-1 h-3 w-3" />
            Emails
          </TabsTrigger>
        </TabsList>

        <div className="min-h-0 flex-1">
          <TabsContent value="notes" className="m-0 h-full">
            <ScrollArea className="h-full">
              <div className="p-4">
                <ContextNotes notesHtml={lead.notesHtml} onInsert={onInsert} />
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="transcripts" className="m-0 h-full">
            <ScrollArea className="h-full">
              <div className="p-4">
                <ContextTranscripts leadId={lead.id} onInsert={onInsert} />
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="emails" className="m-0 h-full">
            <ScrollArea className="h-full">
              <div className="p-4">
                <ContextEmails leadId={lead.id} onInsert={onInsert} />
              </div>
            </ScrollArea>
          </TabsContent>
        </div>
      </Tabs>
      </div>
    </TooltipProvider>
  )
}
