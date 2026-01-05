'use client'

import { useCallback, useState, useTransition } from 'react'
import { FileText, Check, Loader2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { updateClientNotes } from '../actions'

type ClientNotesSectionProps = {
  clientId: string
  initialNotes: string | null
}

export function ClientNotesSection({
  clientId,
  initialNotes,
}: ClientNotesSectionProps) {
  const [notes, setNotes] = useState(initialNotes ?? '')
  const [savedNotes, setSavedNotes] = useState(initialNotes ?? '')
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  const hasChanges = notes !== savedNotes

  const handleSave = useCallback(() => {
    if (!hasChanges) return

    setFeedback(null)
    startTransition(async () => {
      const result = await updateClientNotes({
        clientId,
        notes: notes.trim() || null,
      })

      if (result.success) {
        setSavedNotes(notes)
        setFeedback({ type: 'success', message: 'Saved' })
        // Clear success feedback after 3 seconds
        setTimeout(() => setFeedback(null), 3000)
      } else {
        setFeedback({
          type: 'error',
          message: result.error ?? 'Failed to save notes',
        })
      }
    })
  }, [clientId, notes, hasChanges])

  return (
    <section className='bg-card text-card-foreground overflow-hidden rounded-lg border'>
      <div className='flex items-center gap-3 border-b px-4 py-3'>
        <div className='bg-muted flex h-7 w-7 items-center justify-center rounded-md'>
          <FileText className='text-muted-foreground h-4 w-4' />
        </div>
        <h2 className='font-semibold'>Notes</h2>
        {hasChanges ? (
          <Badge variant='outline' className='ml-auto text-xs'>
            Unsaved
          </Badge>
        ) : (
          <div className='ml-auto' />
        )}
        {feedback ? (
          <span
            className={`text-xs ${feedback.type === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}
          >
            {feedback.type === 'success' ? (
              <span className='flex items-center gap-1'>
                <Check className='h-3 w-3' />
                {feedback.message}
              </span>
            ) : (
              feedback.message
            )}
          </span>
        ) : null}
        <Button
          onClick={handleSave}
          disabled={!hasChanges || isPending}
          size='sm'
          variant={hasChanges ? 'default' : 'ghost'}
          className='h-7'
        >
          {isPending ? (
            <>
              <Loader2 className='h-3.5 w-3.5 animate-spin' />
              Saving
            </>
          ) : (
            'Save'
          )}
        </Button>
      </div>
      <div className='p-3'>
        <RichTextEditor
          id='client-notes'
          value={notes}
          onChange={setNotes}
          placeholder='Add notes about this client...'
          disabled={isPending}
          contentMinHeightClassName='[&_.ProseMirror]:min-h-[120px]'
        />
      </div>
    </section>
  )
}
