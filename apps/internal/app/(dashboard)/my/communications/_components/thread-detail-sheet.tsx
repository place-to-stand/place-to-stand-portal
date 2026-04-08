'use client'

import { Dispatch, SetStateAction, useCallback, useState } from 'react'
import { format } from 'date-fns'
import { RefreshCw } from 'lucide-react'

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import type { ThreadSummary, Message } from '@/lib/types/messages'
import type { CidMapping } from '@/lib/email/sanitize'

import { AttachmentMetadata } from './attachment-viewer'
import { EmailToolbar } from './email-toolbar'
import { MessageCard } from './message-card'
import { ThreadContactPanel } from './thread-contact-panel'
import { ThreadClassificationPanel } from './thread-classification-panel'
import { ThreadSuggestionsPanel } from './thread-suggestions-panel'
import { ComposePanel, type ComposeContext } from './compose-panel'

type Client = {
  id: string
  name: string
  slug: string | null
}

type Project = {
  id: string
  name: string
  slug: string | null
  clientSlug: string | null
  type: 'CLIENT' | 'PERSONAL' | 'INTERNAL'
  ownerId: string | null
  createdBy: string | null
}

type Lead = {
  id: string
  contactName: string
}

interface ThreadDetailSheetProps {
  selectedThread: ThreadSummary | null
  threadMessages: Message[]
  cidMappings: Record<string, CidMapping[]>
  attachmentsMap: Record<string, AttachmentMetadata[]>
  isLoadingMessages: boolean
  isAdmin: boolean
  currentUserId: string
  clients: Client[]
  projects: Project[]
  leads: Lead[]
  // Navigation
  canGoPrev: boolean
  canGoNext: boolean
  onPrev: () => void
  onNext: () => void
  // Compose
  composeContext: ComposeContext | null
  setComposeContext: Dispatch<SetStateAction<ComposeContext | null>>
  onRefreshMessages: (threadId: string) => void
  // State setters
  setThreadMessages: Dispatch<SetStateAction<Message[]>>
  setThreads: Dispatch<SetStateAction<ThreadSummary[]>>
  setSelectedThread: Dispatch<SetStateAction<ThreadSummary | null>>
  setViewingAttachment: Dispatch<SetStateAction<{
    attachment: AttachmentMetadata
    externalMessageId: string
  } | null>>
  // Close
  onClose: () => void
}

export function ThreadDetailSheet({
  selectedThread,
  threadMessages,
  cidMappings,
  attachmentsMap,
  isLoadingMessages,
  isAdmin,
  currentUserId,
  clients,
  projects,
  leads,
  canGoPrev,
  canGoNext,
  onPrev,
  onNext,
  composeContext,
  setComposeContext,
  onRefreshMessages,
  setThreadMessages,
  setThreads,
  setSelectedThread,
  setViewingAttachment,
  onClose,
}: ThreadDetailSheetProps) {
  const [isAnalyzingThread, setIsAnalyzingThread] = useState(false)
  const [suggestionRefreshKey, setSuggestionRefreshKey] = useState(0)

  const triggerThreadAnalysis = useCallback(async (threadId: string) => {
    setIsAnalyzingThread(true)
    try {
      const res = await fetch(`/api/threads/${threadId}/analyze`, {
        method: 'POST',
      })
      if (res.ok) {
        setSuggestionRefreshKey(prev => prev + 1)
      }
    } catch (err) {
      console.error('Failed to analyze thread:', err)
    } finally {
      setIsAnalyzingThread(false)
    }
  }, [])

  // Build a Gmail web URL for the loaded thread. Gmail accepts a message ID in
  // the URL fragment and opens the conversation containing it. We use the
  // latest message's externalMessageId since it's already loaded into state.
  const gmailUrl =
    selectedThread?.source === 'EMAIL' && threadMessages.length > 0
      ? (() => {
          const latestExternalId =
            threadMessages[threadMessages.length - 1]?.externalMessageId
          return latestExternalId
            ? `https://mail.google.com/mail/u/0/#all/${latestExternalId}`
            : null
        })()
      : null

  return (
    <Sheet
      open={!!selectedThread}
      onOpenChange={open => !open && onClose()}
    >
      <SheetContent
        className='flex h-full w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl lg:max-w-6xl'
        onOpenAutoFocus={e => e.preventDefault()}
      >
        {/* Custom Header - Outside the scroll area */}
        <div className='bg-muted/50 flex-shrink-0 border-b-2 px-6 pt-4 pb-3'>
          <div className='flex items-start justify-between gap-4'>
            <div className='min-w-0 flex-1 pr-10'>
              <SheetTitle className='line-clamp-2 text-lg'>
                {selectedThread?.subject || '(no subject)'}
              </SheetTitle>
              <SheetDescription className='mt-1'>
                {selectedThread?.messageCount} message
                {selectedThread?.messageCount !== 1 && 's'}
                {selectedThread?.lastMessageAt && (
                  <>
                    {' '}
                    · {format(new Date(selectedThread.lastMessageAt), 'PPp')}
                  </>
                )}
              </SheetDescription>
            </div>
          </div>
        </div>

        {/* Two Column Content */}
        <div className='flex min-h-0 flex-1'>
          {/* Left Column - Email Messages */}
          <div className='flex-1 overflow-y-auto border-r'>
            <div className='p-6'>
              {isLoadingMessages ? (
                <div className='flex items-center justify-center py-12'>
                  <RefreshCw className='text-muted-foreground h-6 w-6 animate-spin' />
                </div>
              ) : threadMessages.length === 0 ? (
                <div className='text-muted-foreground flex items-center justify-center py-12'>
                  No messages found
                </div>
              ) : (
                <div className='divide-y overflow-hidden rounded-lg border'>
                  {threadMessages.map((message, index) => (
                    <MessageCard
                      key={message.id}
                      message={message}
                      cidMappings={cidMappings[message.id]}
                      attachments={attachmentsMap[message.id]}
                      defaultExpanded={index === threadMessages.length - 1}
                      onViewAttachment={attachment => {
                        if (message.externalMessageId) {
                          setViewingAttachment({
                            attachment,
                            externalMessageId: message.externalMessageId,
                          })
                        }
                      }}
                    />
                  ))}
                </div>
              )}

              {/* Inline Compose - Gmail style, appears at bottom of thread */}
              {composeContext && selectedThread && (
                <div className='mt-4' id='inline-compose'>
                  <ComposePanel
                    context={composeContext}
                    onClose={() => setComposeContext(null)}
                    onSent={() => {
                      setComposeContext(null)
                      // Refresh messages after sending
                      if (selectedThread) {
                        onRefreshMessages(selectedThread.id)
                      }
                    }}
                    inline
                  />
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Metadata & Actions */}
          <div className='bg-muted/20 w-80 flex-shrink-0 overflow-y-auto lg:w-96'>
            <div className='space-y-6 p-6'>
              {/* Email Toolbar - Navigation, Read/Unread toggle, Open in Gmail */}
              {selectedThread && (
                <EmailToolbar
                  threadId={selectedThread.id}
                  isRead={
                    threadMessages.length > 0 &&
                    threadMessages.every(m => m.isRead)
                  }
                  isLoadingMessages={isLoadingMessages}
                  canGoPrev={canGoPrev}
                  canGoNext={canGoNext}
                  gmailUrl={gmailUrl}
                  onToggleReadStatus={newIsRead => {
                    // Update local thread messages state
                    setThreadMessages(prev =>
                      prev.map(m => ({ ...m, isRead: newIsRead }))
                    )
                    // Update threads list state
                    setThreads(prev =>
                      prev.map(t =>
                        t.id === selectedThread.id && t.latestMessage
                          ? {
                              ...t,
                              latestMessage: {
                                ...t.latestMessage,
                                isRead: newIsRead,
                              },
                            }
                          : t
                      )
                    )
                  }}
                  onPrev={onPrev}
                  onNext={onNext}
                />
              )}

              {/* Contact Detection Section */}
              {isAdmin && selectedThread && (
                <>
                  <Separator />
                  <ThreadContactPanel
                    threadId={selectedThread.id}
                    participantEmails={selectedThread.participantEmails || []}
                  />
                </>
              )}

              {/* Classification Panel — unified client/lead/project linking */}
              {isAdmin && selectedThread && (
                <>
                  <Separator />
                  <ThreadClassificationPanel
                    thread={selectedThread}
                    threadMessages={threadMessages}
                    clients={clients}
                    projects={projects}
                    leads={leads}
                    currentUserId={currentUserId}
                    setThreads={setThreads}
                    setSelectedThread={setSelectedThread}
                  />
                </>
              )}

              {/* AI Task/PR Suggestions */}
              {isAdmin && selectedThread && (
                <>
                  <Separator />
                  <ThreadSuggestionsPanel
                    threadId={selectedThread.id}
                    isAdmin={isAdmin}
                    refreshTrigger={suggestionRefreshKey}
                    isAnalyzing={isAnalyzingThread}
                    hasClient={!!selectedThread.client}
                    hasProject={!!selectedThread.project}
                    onRefresh={() => triggerThreadAnalysis(selectedThread.id)}
                  />
                </>
              )}
            </div>
          </div>

        </div>
      </SheetContent>
    </Sheet>
  )
}
