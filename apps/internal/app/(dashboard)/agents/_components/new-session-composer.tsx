'use client'

import { useCallback, useState, useTransition } from 'react'
import { Loader2, Send } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'

import { createSession } from '../actions/create-session'

type NewSessionComposerProps = {
  onSessionCreated: (sessionId: string) => void
}

const PRESET_ACTIONS = [
  {
    label: 'Create a task',
    prompt: 'I want to create a new task — ask me what it is and which project it belongs to.',
  },
  {
    label: 'Check on active tasks',
    prompt: 'What tasks are currently blocked or in progress across the whole business right now?',
  },
  {
    label: 'Billing health check',
    prompt: 'Give me a billing health summary — which clients are low on prepaid hours or have unpaid invoices?',
  },
  {
    label: 'Check in on a client',
    prompt: 'Which client needs the most attention right now, and why?',
  },
] as const

/**
 * The default right-pane view — a blank, unscoped session with access to
 * the whole business (any client, project, task, or billing question).
 * Nothing is created until the human actually sends something, so idle
 * page visits don't litter the sessions list with empty "Untitled session"
 * rows the way auto-creating on mount would.
 */
export function NewSessionComposer({ onSessionCreated }: NewSessionComposerProps) {
  const { toast } = useToast()
  const [input, setInput] = useState('')
  const [pendingLabel, setPendingLabel] = useState<string | null>(null)
  const [isSubmitting, startTransition] = useTransition()

  const submit = useCallback(
    (message: string, label?: string) => {
      const trimmed = message.trim()
      if (!trimmed || isSubmitting) return

      setPendingLabel(label ?? '')
      startTransition(async () => {
        const sessionResult = await createSession()
        if ('error' in sessionResult) {
          toast({ variant: 'destructive', title: 'Error', description: sessionResult.error })
          setPendingLabel(null)
          return
        }

        const response = await fetch('/api/agents/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: sessionResult.sessionId, message: trimmed }),
        })
        if (!response.ok) {
          const body: { error?: string } | null = await response.json().catch(() => null)
          toast({ variant: 'destructive', title: 'Error', description: body?.error ?? 'Failed to send message.' })
          setPendingLabel(null)
          return
        }

        onSessionCreated(sessionResult.sessionId)
      })
    },
    [isSubmitting, toast, onSessionCreated]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        submit(input)
      }
    },
    [input, submit]
  )

  return (
    <div className='flex h-full min-h-0 flex-col items-center justify-center gap-6 bg-background p-8'>
      <div className='flex max-w-lg flex-col items-center gap-2 text-center'>
        <h2 className='text-lg font-semibold'>What do you need?</h2>
        <p className='text-sm text-muted-foreground'>
          Ask about any client, project, task, or billing question — or describe work that needs doing.
        </p>
      </div>

      <div className='flex w-full max-w-lg flex-wrap justify-center gap-2'>
        {PRESET_ACTIONS.map(action => (
          <Button
            key={action.label}
            type='button'
            variant='outline'
            size='sm'
            className='text-xs'
            disabled={isSubmitting}
            onClick={() => submit(action.prompt, action.label)}
          >
            {isSubmitting && pendingLabel === action.label && <Loader2 className='mr-1.5 h-3 w-3 animate-spin' />}
            {action.label}
          </Button>
        ))}
      </div>

      <div className='flex w-full max-w-lg flex-col gap-2'>
        <Textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder='Type a message...'
          className='min-h-[36px] max-h-[140px] resize-none text-sm'
          rows={2}
          disabled={isSubmitting}
        />
        <Button size='sm' className='self-end' disabled={isSubmitting || !input.trim()} onClick={() => submit(input)}>
          {isSubmitting && pendingLabel === '' ? (
            <Loader2 className='mr-1.5 h-3.5 w-3.5 animate-spin' />
          ) : (
            <Send className='mr-1.5 h-3.5 w-3.5' />
          )}
          Send
        </Button>
      </div>
    </div>
  )
}
