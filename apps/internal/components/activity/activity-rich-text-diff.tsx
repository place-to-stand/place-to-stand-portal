'use client'

import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@pts/ui/collapsible'

import {
  diffWords,
  htmlToPlainText,
  type DiffSegment,
} from '@/lib/activity/text-diff'
import { cn } from '@/lib/utils'

type ActivityRichTextDiffProps = {
  before: string | null
  after: string | null
  isHtml: boolean
}

/**
 * Collapsed by default: the header states what happened ("Rewrote · +12 −4
 * words"), and expanding reveals a word-level diff. Very large edits fall
 * back to side-by-side before/after blocks.
 */
export function ActivityRichTextDiff({
  before,
  after,
  isHtml,
}: ActivityRichTextDiffProps) {
  const [open, setOpen] = useState(false)

  const model = useMemo(() => {
    const beforeText = normalise(before, isHtml)
    const afterText = normalise(after, isHtml)

    if (!beforeText && !afterText) return null
    if (!beforeText)
      return {
        mode: 'added' as const,
        beforeText,
        afterText,
        segments: null,
        counts: null,
      }
    if (!afterText)
      return {
        mode: 'cleared' as const,
        beforeText,
        afterText,
        segments: null,
        counts: null,
      }
    // Same words, different markup (a list became a paragraph, a stray space
    // went away): there is nothing to diff, so say so instead of "Edited".
    if (beforeText === afterText) {
      return {
        mode: 'formatting' as const,
        beforeText,
        afterText,
        segments: null,
        counts: null,
      }
    }

    const segments = diffWords(beforeText, afterText)
    return {
      mode: 'changed' as const,
      beforeText,
      afterText,
      segments,
      counts: segments ? countWords(segments) : null,
    }
  }, [before, after, isHtml])

  if (!model) {
    return <span className='text-muted-foreground italic'>Empty</span>
  }

  const headline =
    model.mode === 'added'
      ? 'Added'
      : model.mode === 'cleared'
        ? 'Cleared'
        : model.mode === 'formatting'
          ? 'Formatting only'
          : 'Edited'

  return (
    <Collapsible open={open} onOpenChange={setOpen} className='min-w-0'>
      <CollapsibleTrigger className='text-foreground hover:text-primary focus-visible:ring-ring/50 inline-flex h-5 cursor-pointer items-center gap-1 rounded-sm leading-5 font-medium outline-none focus-visible:ring-[3px]'>
        <ChevronDown
          className={cn(
            'text-muted-foreground size-3 transition-transform motion-reduce:transition-none',
            open && 'rotate-180'
          )}
          aria-hidden='true'
        />
        {headline}
        {model.counts ? (
          <span className='text-muted-foreground ml-1 font-normal'>
            {model.counts.added > 0 ? (
              <span className='text-success'>+{model.counts.added}</span>
            ) : null}
            {model.counts.added > 0 && model.counts.removed > 0 ? ' ' : null}
            {model.counts.removed > 0 ? (
              <span className='text-destructive'>−{model.counts.removed}</span>
            ) : null}
            {model.counts.added > 0 || model.counts.removed > 0
              ? ' words'
              : null}
          </span>
        ) : null}
        <span className='sr-only'>{open ? 'Hide' : 'Show'} change</span>
      </CollapsibleTrigger>

      {/* Base UI measures the panel into --collapsible-panel-height and marks
          the open/close frames, so height can transition from and to zero. */}
      <CollapsibleContent className='h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0 motion-reduce:transition-none'>
        <div className='bg-muted/30 mt-1.5 max-h-72 overflow-y-auto rounded-md border p-2.5 text-xs leading-relaxed whitespace-pre-wrap'>
          {model.mode === 'added' ? (
            <p className='bg-success/10 rounded-sm px-1'>{model.afterText}</p>
          ) : model.mode === 'formatting' ? (
            <p className='text-muted-foreground'>{model.afterText}</p>
          ) : model.mode === 'cleared' ? (
            <p className='bg-destructive/10 rounded-sm px-1 line-through'>
              {model.beforeText}
            </p>
          ) : model.segments ? (
            <DiffText segments={model.segments} />
          ) : (
            <SideBySide before={model.beforeText} after={model.afterText} />
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

function DiffText({ segments }: { segments: DiffSegment[] }) {
  return (
    <p>
      {segments.map((segment, index) => {
        if (segment.type === 'same') {
          return <span key={index}>{segment.text}</span>
        }

        return (
          <mark
            key={index}
            className={cn(
              'rounded-sm px-0.5',
              segment.type === 'added'
                ? 'bg-success/15 text-foreground'
                : 'bg-destructive/15 text-foreground line-through'
            )}
          >
            {segment.text}
          </mark>
        )
      })}
    </p>
  )
}

function SideBySide({ before, after }: { before: string; after: string }) {
  return (
    <div className='grid gap-2 sm:grid-cols-2'>
      <div>
        <p className='text-muted-foreground mb-1 text-[11px] font-semibold tracking-wide uppercase'>
          Before
        </p>
        <p className='text-muted-foreground'>{before}</p>
      </div>
      <div>
        <p className='text-muted-foreground mb-1 text-[11px] font-semibold tracking-wide uppercase'>
          After
        </p>
        <p>{after}</p>
      </div>
    </div>
  )
}

function normalise(value: string | null, isHtml: boolean): string {
  if (!value) return ''
  return (isHtml ? htmlToPlainText(value) : value).trim()
}

function countWords(segments: DiffSegment[]): {
  added: number
  removed: number
} {
  let added = 0
  let removed = 0

  for (const segment of segments) {
    const words = segment.text.trim().split(/\s+/).filter(Boolean).length
    if (segment.type === 'added') added += words
    if (segment.type === 'removed') removed += words
  }

  return { added, removed }
}
