'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Bot, ChevronDown, Loader2, Send, Check } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@pts/ui/avatar'
import { Button } from '@pts/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@pts/ui/popover'
import { Textarea } from '@/components/ui/textarea'
import { getActorInitials } from '@/lib/activity/feed-highlights'

import { useAgentSessionState } from '../_hooks/use-agent-session-state'
import type { AgentMessageAuthor, AgentMessageRow, AgentMessageStatus } from '@/lib/agents/types'
import {
  AGENT_MODEL_TIERS,
  DEFAULT_AGENT_TIER,
  getModelLabel,
  type AgentModelTier,
} from '@/lib/agents/models'

export type { AgentMessageRow }

type AgentChatPaneProps = {
  sessionId: string
  messages: AgentMessageRow[]
  /** For the optimistic pending-send bubble, before the server confirms the author. */
  currentUser: AgentMessageAuthor
}

export function AgentChatPane({ sessionId, messages, currentUser }: AgentChatPaneProps) {
  const router = useRouter()
  const [input, setInput] = useState('')
  const [model, setModel] = useState<AgentModelTier>(DEFAULT_AGENT_TIER)
  const [pendingUserText, setPendingUserText] = useState<string | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)
  const [isSending, startSendTransition] = useTransition()

  const { data, isGenerating, refetch } = useAgentSessionState(sessionId)
  const latestMessage = data && !('error' in data) ? data.latestMessage : null

  // Covers the gap between clicking Send and the next poll actually
  // observing turnStatus: 'streaming' — the poll is interval-gated and
  // stops entirely once idle (see useAgentSessionState), so without this
  // there'd be a beat with zero visible feedback after every send.
  const [isThinking, setIsThinking] = useState(false)
  const isActive = isThinking || isGenerating

  // Generation runs server-side independent of this pane (see
  // app/api/agents/chat/route.ts) — a turn can complete while the user is on
  // a different session entirely. React to the poll observing a turn start
  // or land, whether or not this pane's own send() triggered it.
  const previousTurnStatusRef = useRef(data && !('error' in data) ? data.turnStatus : null)
  useEffect(() => {
    if (!data || 'error' in data) return
    if (previousTurnStatusRef.current !== data.turnStatus && data.turnStatus !== 'idle') {
      // Poll confirmed the turn is underway (or errored) — the local
      // "just clicked send" placeholder has done its job.
      setIsThinking(false)
    }
    if (previousTurnStatusRef.current === 'streaming' && data.turnStatus !== 'streaming') {
      setPendingUserText(null)
      router.refresh()
    }
    previousTurnStatusRef.current = data.turnStatus
  }, [data, router])

  const displayMessages = useMemo(() => {
    const alreadyPresent = latestMessage ? messages.some(message => message.id === latestMessage.id) : false
    const base = alreadyPresent
      ? messages.map(message =>
          message.id === latestMessage!.id
            ? { ...message, content: latestMessage!.content, status: latestMessage!.status }
            : message
        )
      : messages

    const list: AgentMessageRow[] = [...base]

    // The pending user bubble goes here — between the messages already
    // persisted and the (not-yet-persisted) assistant reply below — so a
    // send always reads top-to-bottom, even before the next poll confirms
    // the user message landed in `messages`.
    if (pendingUserText) {
      list.push({
        id: 'pending-user-message',
        role: 'user',
        content: pendingUserText,
        status: 'complete',
        createdAt: new Date().toISOString(),
        author: currentUser,
      })
    }

    if (latestMessage && !alreadyPresent && latestMessage.role === 'assistant') {
      list.push({
        id: latestMessage.id,
        role: latestMessage.role,
        content: latestMessage.content,
        status: latestMessage.status,
        createdAt: latestMessage.createdAt,
        author: null,
      })
    }

    return list
  }, [messages, latestMessage, pendingUserText, currentUser])

  const handleSend = useCallback(() => {
    const trimmed = input.trim()
    if (!trimmed || isActive || isSending) return

    setInput('')
    setPendingUserText(trimmed)
    setSendError(null)
    setIsThinking(true)

    startSendTransition(async () => {
      const response = await fetch('/api/agents/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message: trimmed, model }),
      })
      if (!response.ok) {
        const body: { error?: string } | null = await response.json().catch(() => null)
        setSendError(body?.error ?? 'Failed to send message.')
        setPendingUserText(null)
        setIsThinking(false)
        return
      }
      // The interval poll is gated off while idle, so kick it awake now
      // rather than waiting for a cadence that never resumed on its own.
      void refetch()
    })
  }, [input, isActive, isSending, sessionId, model, refetch])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  return (
    <div className='flex h-full min-h-0 flex-col bg-background'>
      <div className='flex-1 overflow-y-auto px-4 py-3'>
        {displayMessages.length === 0 && !pendingUserText ? (
          <div className='flex h-full flex-col items-center justify-center gap-1 text-center'>
            <p className='text-sm text-muted-foreground'>
              Ask about clients, projects, or tasks — or describe work that needs doing.
            </p>
          </div>
        ) : (
          <div className='flex flex-col gap-4'>
            {displayMessages.map((message, index) => {
              const isLast = index === displayMessages.length - 1
              const isStreamingThisMessage =
                isActive && message.role === 'assistant' && isLast && message.status !== 'error'
              return (
                <MessageBubble
                  key={message.id}
                  role={message.role}
                  content={message.content}
                  status={message.status}
                  author={message.author}
                  isStreaming={isStreamingThisMessage}
                />
              )
            })}
            {isActive && !displayMessages.some(m => m.role === 'assistant') && (
              <div className='flex items-end justify-end gap-2'>
                <ThinkingBubble />
                <AssistantAvatar />
              </div>
            )}
            {sendError && <p className='text-xs text-destructive'>{sendError}</p>}
          </div>
        )}
      </div>
      <div className='border-t px-4 py-3'>
        <Textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder='Type a message...'
          className='min-h-[36px] max-h-[140px] resize-none text-sm'
          rows={1}
          disabled={isActive || isSending}
        />
        <div className='mt-2 flex items-center gap-2'>
          <Button
            size='sm'
            onClick={handleSend}
            disabled={isActive || isSending || !input.trim()}
            className='flex-1'
          >
            {isActive || isSending ? (
              <Loader2 className='mr-1.5 h-3.5 w-3.5 animate-spin' />
            ) : (
              <Send className='mr-1.5 h-3.5 w-3.5' />
            )}
            {isActive ? 'Generating…' : 'Send'}
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant='outline'
                size='sm'
                className='shrink-0 gap-1 text-xs'
                disabled={isActive || isSending}
              >
                {getModelLabel(model).split(' ')[0]}
                <ChevronDown className='h-3 w-3 opacity-50' />
              </Button>
            </PopoverTrigger>
            <PopoverContent className='w-36 p-1' align='end'>
              {AGENT_MODEL_TIERS.map(tier => (
                <button
                  key={tier}
                  className='flex w-full items-center rounded-sm px-2 py-1.5 text-left text-xs hover:bg-muted'
                  onClick={() => setModel(tier)}
                >
                  {getModelLabel(tier)}
                  {model === tier && <Check className='ml-auto h-3 w-3' />}
                </button>
              ))}
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  )
}

function MessageBubble({
  role,
  content,
  status,
  author,
  isStreaming = false,
}: {
  role: string
  content: string
  status: AgentMessageStatus
  author: AgentMessageAuthor | null
  isStreaming?: boolean
}) {
  const isUser = role === 'user'
  const isError = status === 'error'

  if (isStreaming && !content) {
    return (
      <div className='flex items-end justify-end gap-2'>
        <ThinkingBubble />
        <AssistantAvatar />
      </div>
    )
  }

  if (isUser) {
    return (
      <div className='flex items-end justify-start gap-2'>
        <UserAvatar author={author} />
        <div className='max-w-[85%] rounded-lg bg-secondary px-3 py-2 text-sm text-secondary-foreground whitespace-pre-wrap'>
          {content}
        </div>
      </div>
    )
  }

  return (
    <div className='flex items-end justify-end gap-2'>
      <div className='flex max-w-[85%] flex-col items-end gap-1'>
        <div
          className={
            isError
              ? 'rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive whitespace-pre-wrap'
              : 'rounded-lg bg-muted px-3 py-2 text-sm'
          }
        >
          {isError ? (
            content
          ) : (
            <div className='prose prose-sm dark:prose-invert max-w-none'>
              <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
            </div>
          )}
        </div>
        {isStreaming && (
          <span className='flex items-center gap-1 pr-1 text-[10px] text-muted-foreground'>
            <Loader2 className='h-2.5 w-2.5 animate-spin' />
            generating
          </span>
        )}
      </div>
      <AssistantAvatar />
    </div>
  )
}

function UserAvatar({ author }: { author: AgentMessageAuthor | null }) {
  const name = author?.name ?? 'Unknown'
  return (
    <Avatar className='h-6 w-6 shrink-0'>
      {author?.avatarUrl && <AvatarImage src={author.avatarUrl} alt={name} />}
      <AvatarFallback className='text-[10px]'>{getActorInitials(name)}</AvatarFallback>
    </Avatar>
  )
}

function AssistantAvatar() {
  return (
    <div className='flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground'>
      <Bot className='h-3.5 w-3.5' />
    </div>
  )
}

function ThinkingBubble() {
  return (
    <div className='flex items-center gap-1 rounded-lg bg-muted px-3 py-2.5'>
      <span className='h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]' />
      <span className='h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]' />
      <span className='h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground' />
    </div>
  )
}
