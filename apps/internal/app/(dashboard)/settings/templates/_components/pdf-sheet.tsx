'use client'

import { useState } from 'react'

import type { PdfTemplateEntry } from '@/lib/pdf/catalog'

import {
  Field,
  SheetSwitch,
  TemplateSheet,
  TemplateSheetControls,
  TemplateSheetDetails,
  TemplateSheetFooter,
  TemplateSheetHeader,
} from './template-sheet'

export function pdfPreviewUrl(id: string, variantKey: string) {
  return `/api/templates/pdf/${id}?variant=${variantKey}`
}

export function PdfSheet({
  entry,
  open,
  onOpenChange,
}: {
  entry: PdfTemplateEntry | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <TemplateSheet open={open} onOpenChange={onOpenChange}>
      {/* Keyed so the status switch resets per document. */}
      {entry ? <PdfSheetBody key={entry.id} entry={entry} /> : null}
    </TemplateSheet>
  )
}

function PdfSheetBody({ entry }: { entry: PdfTemplateEntry }) {
  const [variantKey, setVariantKey] = useState(entry.variants[0]?.key ?? '')

  const variant =
    entry.variants.find(item => item.key === variantKey) ?? entry.variants[0]
  if (!variant) return null

  const previewUrl = pdfPreviewUrl(entry.id, variant.key)

  return (
    <>
      <TemplateSheetHeader title={entry.name} />

      {entry.variants.length > 1 ? (
        <TemplateSheetControls>
          <SheetSwitch
            label='Status'
            options={entry.variants.map(item => ({
              value: item.key,
              label: item.label,
            }))}
            value={variant.key}
            onChange={setVariantKey}
          />
        </TemplateSheetControls>
      ) : null}

      <TemplateSheetDetails
        rows={[
          {
            label: 'Used by',
            value: (
              <ul className='flex flex-col'>
                {entry.usedBy.map(item => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ),
          },
          {
            label: 'Source',
            value: <code className='text-xs'>{entry.source}</code>,
          },
        ]}
      />

      {/*
        Chrome's viewer honours these open parameters: hide the thumbnail
        pane (every template here is a single page; the toolbar can reopen
        it) and fit the page to the pane's width.
      */}
      <iframe
        key={previewUrl}
        title={`${entry.name}, ${variant.label}, preview`}
        src={`${previewUrl}#navpanes=0&view=FitH`}
        className='block min-h-0 w-full flex-1 border-0 bg-slate-50'
      />

      <TemplateSheetFooter title='Inputs' summary={entry.overview}>
        <p className='text-sm'>{entry.description}</p>
        <dl className='grid gap-x-6 gap-y-3.5 text-sm sm:grid-cols-2'>
          {entry.inputs.map(input => (
            <Field key={input.label} label={input.label}>
              {input.detail}
            </Field>
          ))}
        </dl>
        <p className='text-muted-foreground text-xs'>
          {variant.description} Sample data only, rendered live through the real
          generator.
        </p>
      </TemplateSheetFooter>
    </>
  )
}
