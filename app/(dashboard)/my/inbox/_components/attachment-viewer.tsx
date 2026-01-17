'use client'

import { useState } from 'react'
import {
  FileText,
  Image as ImageIcon,
  File,
  Download,
  Loader2,
  FileSpreadsheet,
  FileCode,
  Film,
  Music,
  Archive,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

export type AttachmentMetadata = {
  attachmentId: string
  filename: string
  mimeType: string
  size: number
  contentId?: string
  isInline: boolean
}

type AttachmentViewerProps = {
  attachment: AttachmentMetadata | null
  externalMessageId: string | null
  onClose: () => void
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return ImageIcon
  if (mimeType.startsWith('video/')) return Film
  if (mimeType.startsWith('audio/')) return Music
  if (mimeType === 'application/pdf') return FileText
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType === 'text/csv')
    return FileSpreadsheet
  if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('compressed'))
    return Archive
  if (mimeType.includes('json') || mimeType.includes('javascript') || mimeType.includes('xml'))
    return FileCode
  return File
}

function isPreviewable(mimeType: string): boolean {
  return (
    mimeType.startsWith('image/') ||
    mimeType === 'application/pdf' ||
    mimeType.startsWith('text/')
  )
}

export function AttachmentViewer({
  attachment,
  externalMessageId,
  onClose,
}: AttachmentViewerProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const isOpen = !!attachment

  const handleLoadPreview = async () => {
    if (!attachment || !externalMessageId) return

    setIsLoading(true)
    setPreviewError(null)

    try {
      const response = await fetch(
        `/api/integrations/gmail/messages/${externalMessageId}/attachments/${attachment.attachmentId}`
      )

      if (!response.ok) {
        throw new Error('Failed to load attachment')
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      setPreviewUrl(url)
    } catch (err) {
      console.error('Failed to load attachment preview:', err)
      setPreviewError('Failed to load preview')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDownload = async () => {
    if (!attachment || !externalMessageId) return

    setIsLoading(true)

    try {
      const response = await fetch(
        `/api/integrations/gmail/messages/${externalMessageId}/attachments/${attachment.attachmentId}`
      )

      if (!response.ok) {
        throw new Error('Failed to download attachment')
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)

      // Create a temporary link and click it to download
      const a = document.createElement('a')
      a.href = url
      a.download = attachment.filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)

      // Clean up the URL
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Failed to download attachment:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    // Clean up preview URL if exists
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }
    setPreviewError(null)
    onClose()
  }

  const FileIcon = attachment ? getFileIcon(attachment.mimeType) : File
  const canPreview = attachment ? isPreviewable(attachment.mimeType) : false

  return (
    <Sheet open={isOpen} onOpenChange={open => !open && handleClose()}>
      <SheetContent className='flex h-full w-full flex-col sm:max-w-lg'>
        <SheetHeader>
          <SheetTitle className='flex items-center gap-2 truncate pr-8'>
            <FileIcon className='h-5 w-5 flex-shrink-0' />
            <span className='truncate'>{attachment?.filename}</span>
          </SheetTitle>
          <SheetDescription>
            {attachment && (
              <>
                {formatFileSize(attachment.size)} · {attachment.mimeType}
              </>
            )}
          </SheetDescription>
        </SheetHeader>

        <div className='flex-1 overflow-auto'>
          {/* Preview Area */}
          <div className='flex min-h-[300px] flex-col items-center justify-center rounded-lg border border-dashed p-6'>
            {isLoading ? (
              <div className='flex flex-col items-center gap-2'>
                <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
                <p className='text-sm text-muted-foreground'>Loading...</p>
              </div>
            ) : previewError ? (
              <div className='flex flex-col items-center gap-2 text-center'>
                <FileIcon className='h-12 w-12 text-muted-foreground' />
                <p className='text-sm text-destructive'>{previewError}</p>
                <Button variant='outline' size='sm' onClick={handleLoadPreview}>
                  Retry
                </Button>
              </div>
            ) : previewUrl && attachment ? (
              // Show preview based on type
              attachment.mimeType.startsWith('image/') ? (
                // eslint-disable-next-line @next/next/no-img-element -- blob URLs require native img element
                <img
                  src={previewUrl}
                  alt={attachment.filename}
                  className='max-h-full max-w-full object-contain'
                />
              ) : attachment.mimeType === 'application/pdf' ? (
                <iframe
                  src={previewUrl}
                  title={attachment.filename}
                  className='h-full w-full min-h-[400px]'
                />
              ) : attachment.mimeType.startsWith('text/') ? (
                <iframe
                  src={previewUrl}
                  title={attachment.filename}
                  className='h-full w-full min-h-[400px] bg-white'
                />
              ) : (
                <div className='flex flex-col items-center gap-2'>
                  <FileIcon className='h-12 w-12 text-muted-foreground' />
                  <p className='text-sm text-muted-foreground'>Preview not available</p>
                </div>
              )
            ) : (
              // Initial state - show icon and load button
              <div className='flex flex-col items-center gap-4'>
                <FileIcon className='h-16 w-16 text-muted-foreground' />
                {canPreview ? (
                  <Button variant='outline' onClick={handleLoadPreview}>
                    Load Preview
                  </Button>
                ) : (
                  <p className='text-sm text-muted-foreground'>
                    Preview not available for this file type
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className='flex gap-2 border-t pt-4'>
          <Button
            className='flex-1'
            onClick={handleDownload}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className='h-4 w-4 animate-spin' />
            ) : (
              <Download className='h-4 w-4' />
            )}
            Download
          </Button>
          <Button variant='outline' onClick={handleClose}>
            Close
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// Compact attachment list for message cards
type AttachmentListProps = {
  attachments: AttachmentMetadata[]
  onViewAttachment: (attachment: AttachmentMetadata) => void
}

export function AttachmentList({
  attachments,
  onViewAttachment,
}: AttachmentListProps) {
  // Filter out inline attachments (they're shown in the email body)
  const regularAttachments = attachments.filter(a => !a.isInline)

  if (regularAttachments.length === 0) return null

  return (
    <div className='mt-3 flex flex-wrap gap-2'>
      {regularAttachments.map(attachment => {
        const FileIcon = getFileIcon(attachment.mimeType)
        return (
          <button
            key={attachment.attachmentId}
            type='button'
            onClick={() => onViewAttachment(attachment)}
            className={cn(
              'flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm',
              'bg-muted/50 hover:bg-muted transition-colors',
              'max-w-[200px]'
            )}
          >
            <FileIcon className='h-4 w-4 flex-shrink-0 text-muted-foreground' />
            <span className='truncate'>{attachment.filename}</span>
            <span className='text-xs text-muted-foreground flex-shrink-0'>
              {formatFileSize(attachment.size)}
            </span>
          </button>
        )
      })}
    </div>
  )
}
