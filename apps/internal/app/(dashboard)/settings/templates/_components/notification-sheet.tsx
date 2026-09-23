'use client'

import { useState } from 'react'

import { Badge } from '@pts/ui/badge'
import type { NotificationTemplateEntry } from '@/lib/notifications/catalog'

import { ChatCardPreview } from './chat-card-preview'
import {
  Field,
  SheetSwitch,
  TemplateSheet,
  TemplateSheetControls,
  TemplateSheetDetails,
  TemplateSheetFooter,
  TemplateSheetHeader,
} from './template-sheet'

type PreviewMode = 'card' | 'json'

export function NotificationSheet({
  entry,
  open,
  onOpenChange,
}: {
  entry: NotificationTemplateEntry | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <TemplateSheet open={open} onOpenChange={onOpenChange}>
      {/* Keyed so the format switch resets per notification. */}
      {entry ? <NotificationSheetBody key={entry.id} entry={entry} /> : null}
    </TemplateSheet>
  )
}

function NotificationSheetBody({
  entry,
}: {
  entry: NotificationTemplateEntry
}) {
  const [mode, setMode] = useState<PreviewMode>('card')

  return (
    <>
      <TemplateSheetHeader title={entry.name} />

      <TemplateSheetControls>
        <SheetSwitch
          label='Format'
          options={[
            { value: 'card', label: 'Card' },
            { value: 'json', label: 'JSON' },
          ]}
          value={mode}
          onChange={value => setMode(value as PreviewMode)}
        />
      </TemplateSheetControls>

      <TemplateSheetDetails
        rows={[
          { label: 'Channel', value: entry.channel },
          {
            label: 'Status',
            value: entry.configured ? (
              'Active in this environment'
            ) : (
              <Badge variant='destructive'>
                Webhook not set in this environment
              </Badge>
            ),
          },
        ]}
      />

      <div className='min-h-0 flex-1 overflow-auto bg-[#f1f3f4]'>
        {mode === 'card' ? (
          <div className='mx-auto max-w-[440px] px-6 py-8'>
            <ChatCardPreview payload={entry.sample} />
          </div>
        ) : (
          <pre className='mx-auto my-8 w-fit max-w-[560px] email-paper bg-background text-foreground border px-6 py-5 font-mono text-xs leading-relaxed whitespace-pre-wrap'>
            {JSON.stringify(entry.sample, null, 2)}
          </pre>
        )}
      </div>

      <TemplateSheetFooter title='Sending' summary={entry.overview}>
        <p className='text-sm'>{entry.description}</p>
        <dl className='grid gap-x-6 gap-y-3.5 text-sm sm:grid-cols-2'>
          <Field label='Triggered by'>
            <ul className='flex flex-col gap-1'>
              {entry.triggers.map(trigger => (
                <li key={trigger}>{trigger}</li>
              ))}
            </ul>
          </Field>
          <Field label='Delivery'>{entry.delivery}</Field>
          <Field label='Source'>
            <code className='text-xs'>{entry.source}</code>
          </Field>
        </dl>
        <p className='text-muted-foreground text-xs'>
          Sample data only, built by the same code that posts the real message.
          Links are placeholders.
        </p>
      </TemplateSheetFooter>
    </>
  )
}
