'use client'

import { Dispatch, SetStateAction } from 'react'
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
import { ThreadLinkingPanel } from './thread-linking-panel'
import { ThreadProjectLinkingPanel } from './thread-project-linking-panel'
import { ThreadSuggestionsPanel } from './thread-suggestions-panel'
import { ComposePanel, type ComposeContext } from './compose-panel'
import type { Suggestion, ProjectSuggestion } from './hooks/use-thread-suggestions'

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
}

interface ThreadDetailSheetProps {
  selectedThread: ThreadSummary | null
  threadMessages: Message[]
  cidMappings: Record<string, CidMapping[]>
  attachmentsMap: Record<string, AttachmentMetadata[]>
  isLoadingMessages: boolean
  isAdmin: boolean
  clients: Client[]
  projects: Project[]
  // Suggestions
  suggestions: Suggestion[]
  projectSuggestions: ProjectSuggestion[]
  suggestionsLoading: boolean
  projectSuggestionsLoading: boolean
  isAnalyzingThread: boolean
  suggestionRefreshKey: number
  // Linking
  isLinking: boolean
  isLinkingProject: boolean
  onLinkClient: (clientId: string) => void
  onUnlinkClient: () => void
  onLinkProject: (projectId: string) => void
  onUnlinkProject: () => void
  onRefreshSuggestions: () => void
  // Navigation
  canGoPrev: boolean
  canGoNext: boolean
  onPrev: () => void
  onNext: () => void
  // Compose
  composeContext: ComposeContext | null
  setComposeContext: Dispatch<SetStateAction<ComposeContext | null>>
  onReply: (message: Message, mode: 'reply' | 'reply_all' | 'forward') => void
  onRefreshMessages: (threadId: string) => void
  // State setters for toolbar
  setThreadMessages: Dispatch<SetStateAction<Message[]>>
  setThreads: Dispatch<SetStateAction<ThreadSummary[]>>
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
  clients,
  projects,
  suggestions,
  projectSuggestions,
  suggestionsLoading,
  projectSuggestionsLoading,
  isAnalyzingThread,
  suggestionRefreshKey,
  isLinking,
  isLinkingProject,
  onLinkClient,
  onUnlinkClient,
  onLinkProject,
  onUnlinkProject,
  onRefreshSuggestions,
  canGoPrev,
  canGoNext,
  onPrev,
  onNext,
  composeContext,
  setComposeContext,
  onReply,
  onRefreshMessages,
  setThreadMessages,
  setThreads,
  setViewingAttachment,
  onClose,
}: ThreadDetailSheetProps) {
  return (
    <Sheet
      open={!!selectedThread}
      onOpenChange={open => !open && onClose()}
    >
      <SheetContent className='flex h-full w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl lg:max-w-6xl'>
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
                      onReply={mode => onReply(message, mode)}
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
              {/* Email Toolbar - Reply actions, Read/Unread toggle, Navigation */}
              {selectedThread && (
                <EmailToolbar
                  threadId={selectedThread.id}
                  isRead={
                    threadMessages.length > 0 &&
                    threadMessages.every(m => m.isRead)
                  }
                  canGoPrev={canGoPrev}
                  canGoNext={canGoNext}
                  showReplyAll={
                    threadMessages.length > 0 &&
                    (((threadMessages[threadMessages.length - 1]?.toEmails?.length ?? 0) > 1) ||
                      ((threadMessages[threadMessages.length - 1]?.ccEmails?.length ?? 0) > 0))
                  }
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
                  onReply={mode => {
                    // Reply to the latest message in the thread
                    const latestMessage = threadMessages[threadMessages.length - 1]
                    if (latestMessage) {
                      onReply(latestMessage, mode)
                    }
                  }}
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

              {/* Client Linking Section */}
              {isAdmin && selectedThread && (
                <>
                  <Separator />
                  <ThreadLinkingPanel
                    thread={selectedThread}
                    clients={clients}
                    suggestions={suggestions}
                    suggestionsLoading={suggestionsLoading}
                    isLinking={isLinking}
                    onLinkClient={onLinkClient}
                    onUnlinkClient={onUnlinkClient}
                  />
                </>
              )}

              {/* Project Linking Section */}
              {isAdmin && selectedThread && (
                <>
                  <Separator />
                  <ThreadProjectLinkingPanel
                    thread={selectedThread}
                    projects={projects}
                    suggestions={projectSuggestions}
                    suggestionsLoading={projectSuggestionsLoading}
                    isLinking={isLinkingProject}
                    onLinkProject={onLinkProject}
                    onUnlinkProject={onUnlinkProject}
                  />
                </>
              )}

              {isAdmin && selectedThread && (
                <>
                  <Separator />
                  {/* AI Task/PR Suggestions */}
                  <ThreadSuggestionsPanel
                    threadId={selectedThread.id}
                    isAdmin={isAdmin}
                    refreshTrigger={suggestionRefreshKey}
                    isAnalyzing={isAnalyzingThread}
                    hasClient={!!selectedThread.client}
                    hasProject={!!selectedThread.project}
                    onRefresh={onRefreshSuggestions}
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
