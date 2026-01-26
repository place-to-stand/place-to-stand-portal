'use client'

import { FileText, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

type ContextNotesProps = {
  notesHtml: string
  onInsert?: (text: string, source: string) => void
}

/**
 * Convert HTML to plain text for insertion.
 */
function htmlToPlainText(html: string): string {
  const div = document.createElement('div')
  div.innerHTML = html
  return div.textContent || div.innerText || ''
}

/**
 * Display lead notes in the context panel.
 * The notesHtml content is from TipTap editor stored in the database,
 * which is trusted user-generated content.
 */
export function ContextNotes({ notesHtml, onInsert }: ContextNotesProps) {
  if (!notesHtml || notesHtml === '<p></p>') {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
        <FileText className="mb-2 h-8 w-8 opacity-50" />
        <p className="text-sm">No notes yet</p>
        <p className="text-xs">Add notes to the lead to see them here</p>
      </div>
    )
  }

  const handleInsert = () => {
    const plainText = htmlToPlainText(notesHtml)
    if (plainText.trim() && onInsert) {
      onInsert(plainText, 'Lead Notes')
    }
  }

  // Content is from TipTap editor - trusted source
  return (
    <div className="space-y-3">
      {onInsert && (
        <div className="flex justify-end">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={handleInsert}
              >
                <Plus className="mr-1 h-3 w-3" />
                Insert All
              </Button>
            </TooltipTrigger>
            <TooltipContent>Insert notes into Project Overview</TooltipContent>
          </Tooltip>
        </div>
      )}
      <div
        className="prose prose-sm dark:prose-invert max-w-none text-sm"
        dangerouslySetInnerHTML={{ __html: notesHtml }}
      />
    </div>
  )
}
