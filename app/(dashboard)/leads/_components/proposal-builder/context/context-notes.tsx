'use client'

import { FileText } from 'lucide-react'

type ContextNotesProps = {
  notesHtml: string
}

/**
 * Display lead notes in the context panel.
 * The notesHtml content is from TipTap editor stored in the database,
 * which is trusted user-generated content.
 */
export function ContextNotes({ notesHtml }: ContextNotesProps) {
  if (!notesHtml || notesHtml === '<p></p>') {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
        <FileText className="mb-2 h-8 w-8 opacity-50" />
        <p className="text-sm">No notes yet</p>
        <p className="text-xs">Add notes to the lead to see them here</p>
      </div>
    )
  }

  // Content is from TipTap editor - trusted source
  return (
    <div
      className="prose prose-sm dark:prose-invert max-w-none text-sm"
      dangerouslySetInnerHTML={{ __html: notesHtml }}
    />
  )
}
