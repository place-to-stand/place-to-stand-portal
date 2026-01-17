'use client'

import { RefObject } from 'react'
import { addHours, addDays, setHours, setMinutes, format, startOfTomorrow } from 'date-fns'
import { Send, Paperclip, Loader2, Check, Clock, ChevronDown, Calendar, Signature, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

interface SignatureData {
  email: string
  displayName: string
  signature: string
  isPrimary: boolean
  isDefault: boolean
}

interface ComposeFooterProps {
  inline?: boolean
  isSending: boolean
  // Attachments
  fileInputRef: RefObject<HTMLInputElement | null>
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  isUploadingAttachment: boolean
  // Signatures
  signatures: SignatureData[]
  selectedSignature: string | null
  isLoadingSignatures: boolean
  handleSignatureChange: (email: string) => void
  clearSignature: () => void
  // Schedule
  scheduledAt: Date | null
  setScheduledAt: (date: Date | null) => void
  setShowSchedulePicker: (show: boolean) => void
  // Send
  undoCountdown: number | null
  handleSend: () => void
  handleUndoSend: () => void
}

export function ComposeFooter({
  inline,
  isSending,
  fileInputRef,
  handleFileSelect,
  isUploadingAttachment,
  signatures,
  selectedSignature,
  isLoadingSignatures,
  handleSignatureChange,
  clearSignature,
  scheduledAt,
  setScheduledAt,
  setShowSchedulePicker,
  undoCountdown,
  handleSend,
  handleUndoSend,
}: ComposeFooterProps) {
  return (
    <div className={cn(
      'flex items-center justify-between border-t',
      inline ? 'px-4 py-2' : 'px-4 py-3'
    )}>
      <div className='flex items-center gap-2'>
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type='file'
          multiple
          className='hidden'
          onChange={handleFileSelect}
          accept='.jpg,.jpeg,.png,.webp,.gif,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.html,.zip,.mp4,.mov'
        />
        <Button
          variant='outline'
          size='sm'
          onClick={() => fileInputRef.current?.click()}
          disabled={isSending || isUploadingAttachment}
        >
          {isUploadingAttachment ? (
            <>
              <Loader2 className='h-4 w-4 animate-spin' />
              Uploading...
            </>
          ) : (
            <>
              <Paperclip className='h-4 w-4' />
              Attach
            </>
          )}
        </Button>

        {/* Signature selector */}
        {signatures.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant='outline'
                size='sm'
                disabled={isSending || isLoadingSignatures}
              >
                {isLoadingSignatures ? (
                  <Loader2 className='h-4 w-4 animate-spin' />
                ) : (
                  <Signature className='h-4 w-4' />
                )}
                Signature
                <ChevronDown className='h-3 w-3' />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='start'>
              {signatures.map(sig => (
                <DropdownMenuItem
                  key={sig.email}
                  onClick={() => handleSignatureChange(sig.email)}
                  className='flex items-center gap-2'
                >
                  {selectedSignature === sig.email && (
                    <Check className='h-4 w-4' />
                  )}
                  <span className={cn(selectedSignature !== sig.email && 'ml-6')}>
                    {sig.displayName || sig.email}
                    {sig.isPrimary && (
                      <span className='text-muted-foreground ml-1 text-xs'>(primary)</span>
                    )}
                  </span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={clearSignature}
                className='text-muted-foreground'
              >
                <span className='ml-6'>No signature</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className='flex items-center gap-2'>
        {/* Scheduled time indicator */}
        {scheduledAt && (
          <div className='flex items-center gap-1.5 text-sm'>
            <Clock className='text-muted-foreground h-4 w-4' />
            <span className='text-muted-foreground'>
              {format(scheduledAt, 'MMM d, h:mm a')}
            </span>
            <Button
              variant='ghost'
              size='icon-sm'
              onClick={() => setScheduledAt(null)}
              disabled={isSending}
            >
              <X className='h-4 w-4' />
            </Button>
          </div>
        )}

        {/* Send / Schedule buttons */}
        {undoCountdown !== null ? (
          // Show undo button during countdown
          <Button
            variant='secondary'
            onClick={handleUndoSend}
          >
            <span className='tabular-nums'>Sending in {undoCountdown}s</span>
            <span className='font-semibold'>Undo</span>
          </Button>
        ) : scheduledAt ? (
          // Schedule button (no dropdown when scheduled)
          <Button
            onClick={handleSend}
            disabled={isSending}
          >
            {isSending ? (
              <Loader2 className='h-4 w-4 animate-spin' />
            ) : (
              <Clock className='h-4 w-4' />
            )}
            {isSending ? 'Scheduling...' : 'Schedule'}
          </Button>
        ) : (
          // Send button with dropdown - unified button group
          <div className='inline-flex'>
            <Button
              onClick={handleSend}
              disabled={isSending}
              className='rounded-r-none'
            >
              {isSending ? (
                <Loader2 className='h-4 w-4 animate-spin' />
              ) : (
                <Send className='h-4 w-4' />
              )}
              {isSending ? 'Sending...' : 'Send'}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant='default'
                  size='icon'
                  disabled={isSending}
                  className='rounded-l-none border-l border-l-primary-foreground/20'
                >
                  <ChevronDown className='h-4 w-4' />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end'>
                <DropdownMenuItem
                  onClick={() => setScheduledAt(addHours(new Date(), 1))}
                >
                  <Clock className='mr-2 h-4 w-4' />
                  Send in 1 hour
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setScheduledAt(addHours(new Date(), 2))}
                >
                  <Clock className='mr-2 h-4 w-4' />
                  Send in 2 hours
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    setScheduledAt(setMinutes(setHours(startOfTomorrow(), 8), 0))
                  }
                >
                  <Clock className='mr-2 h-4 w-4' />
                  Tomorrow morning (8 AM)
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setScheduledAt(addDays(new Date(), 1))}
                >
                  <Clock className='mr-2 h-4 w-4' />
                  Tomorrow (same time)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() =>
                    setScheduledAt(setMinutes(setHours(addDays(new Date(), 0), 17), 0))
                  }
                >
                  <Clock className='mr-2 h-4 w-4' />
                  Today at 5 PM
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setShowSchedulePicker(true)}>
                  <Calendar className='mr-2 h-4 w-4' />
                  Pick date & time...
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    </div>
  )
}
