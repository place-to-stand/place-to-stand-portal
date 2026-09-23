'use client'

import { useEffect, useRef } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { FileCode, Loader2 } from 'lucide-react'

import { EmptyState } from '@pts/ui/empty-state'

type PlanDocumentViewerProps = {
  content: string
  isStreaming: boolean
  toolCalls: string[]
  error: string | null
}

export function PlanDocumentViewer({
  content,
  isStreaming,
  toolCalls,
  error,
}: PlanDocumentViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom during streaming
  useEffect(() => {
    if (isStreaming && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [content, isStreaming])

  if (error) {
    return (
      <div className='border-destructive/50 bg-destructive/10 text-destructive flex items-center gap-2 rounded-md border px-3 py-2 text-xs'>
        {error}
      </div>
    )
  }

  if (!content && !isStreaming) {
    return <EmptyState message='No plan generated yet.' />
  }

  return (
    <div ref={scrollRef} className='flex-1 overflow-y-auto'>
      {/* Tool call indicators */}
      {isStreaming && toolCalls.length > 0 && (
        <div className='mb-3 flex flex-col gap-1'>
          {toolCalls.slice(-3).map((tc, i) => (
            <div
              key={i}
              className='bg-muted/60 text-muted-foreground flex items-center gap-1.5 rounded px-2 py-1 text-xs'
            >
              <FileCode className='h-3 w-3' />
              {tc}
            </div>
          ))}
        </div>
      )}

      {/* Plan content */}
      <div className='prose prose-sm dark:prose-invert max-w-none'>
        <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
      </div>

      {/* Streaming indicator */}
      {isStreaming && (
        <div className='text-muted-foreground mt-2 flex items-center gap-1.5 py-2 text-xs'>
          <Loader2 className='h-3 w-3 animate-spin' />
          Generating...
        </div>
      )}
    </div>
  )
}
