'use client'

import { ChevronDown } from 'lucide-react'

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@pts/ui/collapsible'
import { Tabs, TabsList, TabsTrigger } from '@pts/ui/tabs'
import { SheetFormHeader } from '@/components/sheets/sheet-form-header'
import { Sheet, SheetContent } from '@/components/ui/sheet'

/**
 * Read-only sheet shared by the email and PDF tabs: the entity sheets' header,
 * the switches that change what you are looking at (above the document, never
 * inside it), its envelope or metadata, the rendered document, and a
 * folded-away footer.
 */
export function TemplateSheet({
  open,
  onOpenChange,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent size='2xl' className='gap-0 p-0' hideCloseButton>
        {children}
      </SheetContent>
    </Sheet>
  )
}

export function TemplateSheetHeader({ title }: { title: string }) {
  return <SheetFormHeader entity='template' title={title} />
}

/** The switch row under the header; children are `SheetSwitch`es. */
export function TemplateSheetControls({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className='flex flex-wrap items-center gap-x-5 gap-y-2 border-b px-4 py-2'>
      {children}
    </div>
  )
}

/** A labelled two-or-more-way switch built on the shared Tabs, compact. */
export function SheetSwitch({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className='flex items-center gap-2'>
      <span aria-hidden='true' className='text-muted-foreground text-xs'>
        {label}
      </span>
      <Tabs value={value} onValueChange={next => onChange(String(next))}>
        <TabsList aria-label={label} className='h-7 p-0.5'>
          {options.map(option => (
            <TabsTrigger
              key={option.value}
              value={option.value}
              className='px-2 text-xs'
            >
              {option.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  )
}

/** Label/value rows directly under the switches (envelope, used-by). */
export function TemplateSheetDetails({
  rows,
}: {
  rows: { label: string; value: React.ReactNode }[]
}) {
  return (
    <dl className='grid grid-cols-[72px_minmax(0,1fr)] gap-x-3 gap-y-1.5 border-b px-4 py-3 text-sm'>
      {rows.map(row => (
        <div key={row.label} className='contents'>
          <dt className='text-muted-foreground'>{row.label}</dt>
          <dd className='min-w-0 break-words'>{row.value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Collapsible footer: a one-line summary that expands into full detail. */
export function TemplateSheetFooter({
  title,
  summary,
  children,
}: {
  title: string
  summary: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Collapsible className='border-t'>
      <CollapsibleTrigger className='hover:bg-muted/50 flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors [&[data-panel-open]>svg]:rotate-180'>
        <span className='text-sm font-semibold'>{title}</span>
        <span className='text-muted-foreground min-w-0 flex-1 truncate text-xs'>
          {summary}
        </span>
        <ChevronDown
          className='text-muted-foreground size-4 shrink-0 transition-transform duration-200 motion-reduce:transition-none'
          aria-hidden='true'
        />
      </CollapsibleTrigger>
      {/* Base UI measures the panel into --collapsible-panel-height and marks
          the open/close frames, so height can transition from and to zero. */}
      <CollapsibleContent className='h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0 motion-reduce:transition-none'>
        <div className='flex flex-col gap-3 px-4 pb-4'>{children}</div>
      </CollapsibleContent>
    </Collapsible>
  )
}

export function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className='flex flex-col gap-0.5'>
      <dt className='text-muted-foreground text-xs font-medium tracking-wide uppercase'>
        {label}
      </dt>
      <dd className='min-w-0 break-words'>{children}</dd>
    </div>
  )
}
