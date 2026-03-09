'use client'

import { useMemo } from 'react'

import { cn } from '@/lib/utils'

// Speaker colors — cycle through for visual distinction
const SPEAKER_COLORS = [
  'text-blue-600 dark:text-blue-400',
  'text-emerald-600 dark:text-emerald-400',
  'text-violet-600 dark:text-violet-400',
  'text-amber-600 dark:text-amber-400',
  'text-rose-600 dark:text-rose-400',
  'text-cyan-600 dark:text-cyan-400',
  'text-fuchsia-600 dark:text-fuchsia-400',
  'text-lime-600 dark:text-lime-400',
] as const

// Gemini Notes commonly emit these section headings
const SECTION_HEADING_PATTERN = /^(Action Items|Key Points|Summary|Decisions|Follow[- ]?ups?|Next Steps|Agenda|Notes|Attendees|Participants)\s*$/i

type ParsedBlock =
  | { type: 'speaker-turn'; speaker: string; timestamp?: string; text: string }
  | { type: 'section-heading'; text: string }
  | { type: 'paragraph'; text: string }

/**
 * Parse raw transcript text into structured blocks for rendering.
 * Detects speaker turns (timestamped and plain), section headings, and regular paragraphs.
 */
function parseTranscriptContent(content: string): ParsedBlock[] {
  const lines = content.split('\n')
  const blocks: ParsedBlock[] = []

  // Pattern: [HH:MM] Speaker Name: or [HH:MM AM/PM] Speaker Name:
  const timestampedSpeaker = /^\[(\d{1,2}:\d{2}(?:\s*(?:AM|PM))?)\]\s*([^:]+):\s*(.*)/i
  // Pattern: Speaker Name: (at line start, capitalized, 1-3 words)
  const plainSpeaker = /^([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,2})\s*:\s*(.*)/

  let currentBlock: ParsedBlock | null = null

  const flushBlock = () => {
    if (currentBlock) {
      if (currentBlock.type === 'speaker-turn') {
        currentBlock.text = currentBlock.text.trim()
      }
      if (currentBlock.type !== 'paragraph' || currentBlock.text.trim()) {
        blocks.push(currentBlock)
      }
      currentBlock = null
    }
  }

  for (const line of lines) {
    const trimmed = line.trim()

    // Empty line — flush current block
    if (!trimmed) {
      flushBlock()
      continue
    }

    // Check for section headings
    if (SECTION_HEADING_PATTERN.test(trimmed)) {
      flushBlock()
      blocks.push({ type: 'section-heading', text: trimmed })
      continue
    }

    // Check for timestamped speaker turn
    const tsMatch = trimmed.match(timestampedSpeaker)
    if (tsMatch) {
      flushBlock()
      currentBlock = {
        type: 'speaker-turn',
        timestamp: tsMatch[1],
        speaker: tsMatch[2].trim(),
        text: tsMatch[3] ?? '',
      }
      continue
    }

    // Check for plain speaker turn
    const plainMatch = trimmed.match(plainSpeaker)
    if (plainMatch) {
      flushBlock()
      currentBlock = {
        type: 'speaker-turn',
        speaker: plainMatch[1].trim(),
        text: plainMatch[2] ?? '',
      }
      continue
    }

    // Continuation line — append to current block
    if (currentBlock?.type === 'speaker-turn') {
      currentBlock.text += ' ' + trimmed
    } else if (currentBlock?.type === 'paragraph') {
      currentBlock.text += ' ' + trimmed
    } else {
      // Start a new paragraph
      currentBlock = { type: 'paragraph', text: trimmed }
    }
  }

  flushBlock()
  return blocks
}

interface TranscriptContentRendererProps {
  content: string
  className?: string
}

export function TranscriptContentRenderer({ content, className }: TranscriptContentRendererProps) {
  const { blocks, speakerColorMap } = useMemo(() => {
    const parsed = parseTranscriptContent(content)

    // Assign consistent colors to speakers
    const colorMap = new Map<string, string>()
    let colorIdx = 0
    for (const block of parsed) {
      if (block.type === 'speaker-turn' && !colorMap.has(block.speaker)) {
        colorMap.set(block.speaker, SPEAKER_COLORS[colorIdx % SPEAKER_COLORS.length])
        colorIdx++
      }
    }

    return { blocks: parsed, speakerColorMap: colorMap }
  }, [content])

  // If no speaker turns detected, fall back to simple pre-wrapped text
  const hasSpeakerTurns = blocks.some(b => b.type === 'speaker-turn')
  if (!hasSpeakerTurns) {
    return (
      <div className={cn('whitespace-pre-wrap text-sm leading-relaxed', className)}>
        {content}
      </div>
    )
  }

  return (
    <div className={cn('space-y-0.5', className)}>
      {blocks.map((block, i) => {
        if (block.type === 'section-heading') {
          return (
            <div key={i} className='pt-5 pb-2 first:pt-0'>
              <h3 className='text-sm font-semibold tracking-wide uppercase'>
                {block.text}
              </h3>
              <div className='bg-border mt-1 h-px' />
            </div>
          )
        }

        if (block.type === 'speaker-turn') {
          const colorClass = speakerColorMap.get(block.speaker) ?? SPEAKER_COLORS[0]
          return (
            <div key={i} className='group flex gap-3 rounded-md px-2 py-1.5 hover:bg-muted/40'>
              <div className='w-32 flex-shrink-0 pt-0.5 text-right'>
                {block.timestamp && (
                  <span className='text-muted-foreground mr-2 font-mono text-[11px]'>
                    {block.timestamp}
                  </span>
                )}
              </div>
              <div className='min-w-0 flex-1'>
                <span className={cn('text-sm font-semibold', colorClass)}>
                  {block.speaker}
                </span>
                <p className='text-muted-foreground text-sm leading-relaxed'>
                  {block.text}
                </p>
              </div>
            </div>
          )
        }

        // paragraph
        return (
          <div key={i} className='px-2 py-1.5 pl-[calc(8.5rem+0.75rem)]'>
            <p className='text-muted-foreground text-sm leading-relaxed'>
              {block.text}
            </p>
          </div>
        )
      })}
    </div>
  )
}
