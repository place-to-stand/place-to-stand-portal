'use client'

import { useState } from 'react'

import { Badge } from '@pts/ui/badge'
import type { EmailTemplateEntry } from '@/lib/email/catalog'

import { AUDIENCE_STYLES } from './template-labels'
import {
  Field,
  SheetSwitch,
  TemplateSheet,
  TemplateSheetControls,
  TemplateSheetDetails,
  TemplateSheetFooter,
  TemplateSheetHeader,
} from './template-sheet'

type PreviewMode = 'html' | 'text'

export function EmailSheet({
  entry,
  open,
  onOpenChange,
}: {
  entry: EmailTemplateEntry | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <TemplateSheet open={open} onOpenChange={onOpenChange}>
      {/* Keyed so the recipient and format switches reset per email. */}
      {entry ? <EmailSheetBody key={entry.id} entry={entry} /> : null}
    </TemplateSheet>
  )
}

function EmailSheetBody({ entry }: { entry: EmailTemplateEntry }) {
  const [variantIndex, setVariantIndex] = useState(0)
  const [mode, setMode] = useState<PreviewMode>('html')

  const variant = entry.variants[variantIndex] ?? entry.variants[0]
  if (!variant) return null

  return (
    <>
      <TemplateSheetHeader title={entry.name} />

      <TemplateSheetControls>
        {entry.variants.length > 1 ? (
          <SheetSwitch
            label='Recipient'
            options={entry.variants.map((item, index) => ({
              value: String(index),
              label: AUDIENCE_STYLES[item.audience].label,
            }))}
            value={String(entry.variants.indexOf(variant))}
            onChange={value => setVariantIndex(Number(value))}
          />
        ) : null}
        <SheetSwitch
          label='Format'
          options={[
            { value: 'html', label: 'HTML' },
            { value: 'text', label: 'Plain text' },
          ]}
          value={mode}
          onChange={value => setMode(value as PreviewMode)}
        />
        {entry.status === 'disabled' ? (
          <Badge variant='destructive' className='ml-auto'>
            Not sent
          </Badge>
        ) : null}
      </TemplateSheetControls>

      <TemplateSheetDetails
        rows={[
          {
            label: 'Subject',
            value: (
              <span className='font-medium'>{variant.sample.subject}</span>
            ),
          },
          {
            label: 'From',
            value: (
              <>
                Place To Stand{' '}
                <code className='text-muted-foreground text-xs'>
                  &lt;{stripDisplayName(entry.from)}&gt;
                </code>
              </>
            ),
          },
          { label: 'To', value: entry.recipient },
          {
            label: 'Reply-to',
            value: <code className='text-xs'>{entry.replyTo}</code>,
          },
        ]}
      />

      <div className='min-h-0 flex-1 overflow-auto bg-[#f4f4f2]'>
        {mode === 'html' ? (
          <iframe
            key={variant.audience}
            title={`${entry.name}, ${AUDIENCE_STYLES[variant.audience].label} copy, HTML preview`}
            sandbox=''
            srcDoc={variant.sample.html}
            className='block h-full w-full border-0'
          />
        ) : (
          <pre className='mx-auto my-8 w-fit max-w-[520px] border border-slate-200 bg-white px-8 py-7 font-mono text-xs leading-relaxed whitespace-pre-wrap text-slate-900'>
            {variant.sample.text}
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
          <Field label='Attachments'>{entry.attachments ?? 'None'}</Field>
        </dl>
        <p className='text-muted-foreground text-xs'>
          Sample data only. Links, names, and credentials shown are placeholders
          and do not work.
        </p>
      </TemplateSheetFooter>
    </>
  )
}

/** `Place To Stand <addr>` → `addr`; a bare address passes through. */
function stripDisplayName(from: string): string {
  const match = from.match(/<([^>]+)>/)
  return match ? match[1] : from
}
