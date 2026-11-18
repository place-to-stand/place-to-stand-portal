'use client'

import { useRef, type ReactNode } from 'react'
import { ImagePlus, Loader2, Trash2 } from 'lucide-react'

import { Button } from '@pts/ui/button'

import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'

type ImageUploadControlsProps = {
  /** The current image (or its placeholder), left of the buttons. */
  preview: ReactNode
  hasImage: boolean
  /** What the image is, for the buttons: "photo" → "Upload photo". */
  noun: string
  /** One line under the buttons: size and types allowed. */
  hint: string
  /** The `accept` list for the file input. */
  accept: string
  onFile: (file: File) => void
  onRemove: () => void
  disabled?: boolean
  isUploading?: boolean
  /** Id for the hidden file input, so a label can point at it. */
  inputId?: string
}

/**
 * Preview, Upload/Replace and Remove buttons and the size hint: the one shape
 * for every image field (a person's photo, the business logo and icon).
 * Where the file goes is the caller's job.
 */
export function ImageUploadControls({
  preview,
  hasImage,
  noun,
  hint,
  accept,
  onFile,
  onRemove,
  disabled = false,
  isUploading = false,
  inputId,
}: ImageUploadControlsProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const locked = disabled || isUploading
  const reason = locked
    ? 'Please wait for the current request to finish.'
    : null

  return (
    <div className='flex items-start gap-4'>
      {preview}
      <div className='flex flex-col gap-2'>
        <div className='flex flex-wrap gap-2'>
          <DisabledFieldTooltip disabled={locked} reason={reason}>
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() => inputRef.current?.click()}
              disabled={locked}
            >
              {isUploading ? (
                <Loader2 className='animate-spin' />
              ) : (
                <ImagePlus />
              )}
              {hasImage ? `Replace ${noun}` : `Upload ${noun}`}
            </Button>
          </DisabledFieldTooltip>
          {hasImage ? (
            <DisabledFieldTooltip disabled={locked} reason={reason}>
              <Button
                type='button'
                variant='secondary'
                size='sm'
                onClick={onRemove}
                disabled={locked}
              >
                <Trash2 /> Remove
              </Button>
            </DisabledFieldTooltip>
          ) : null}
        </div>
        <p className='text-muted-foreground text-xs'>{hint}</p>
      </div>
      <input
        ref={inputRef}
        id={inputId}
        type='file'
        accept={accept}
        // Not `hidden`: a label pointing at it must reach a real control.
        className='sr-only'
        tabIndex={-1}
        disabled={locked}
        onChange={event => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) onFile(file)
        }}
      />
    </div>
  )
}
