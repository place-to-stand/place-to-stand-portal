'use client'

import { useId, useRef, useState, type DragEvent, type ReactNode } from 'react'
import { ImagePlus, Loader2, X } from 'lucide-react'

import { RowActionButton } from '@pts/ui/row-action-button'

import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { cn } from '@/lib/utils'

export type ImageUploadShape = 'square' | 'wide' | 'circle'

type ImageUploadControlsProps = {
  /** Square for an icon, wide for a logo, circle for a person's photo. */
  shape: ImageUploadShape
  /**
   * The current image, drawn to fill the tile, or null for the empty
   * "Upload" state.
   */
  image: ReactNode | null
  /** What the image is, for the labels: "photo" → "Upload photo". */
  noun: string
  /** One line under the tile: size and types allowed. */
  hint: string
  /** Shown under the hint in destructive text. */
  error?: string | null
  /** The `accept` list for the file input. */
  accept: string
  onFile: (file: File) => void
  onRemove: () => void
  disabled?: boolean
  isUploading?: boolean
  /** Id for the hidden file input, so a label can point at it. */
  inputId?: string
}

const SHAPE_CLASSES: Record<ImageUploadShape, string> = {
  square: 'size-16 rounded-md',
  circle: 'size-16 rounded-full',
  wide: 'h-16 w-40 rounded-md',
}

/** True while the drag carries files (not text or a link). */
function draggingFiles(event: DragEvent) {
  return Array.from(event.dataTransfer.types).includes('Files')
}

/**
 * The one shape for every image field (a person's photo, the business logo
 * and icon): the preview tile is the control. Click it (or Enter/Space) to
 * pick a file, or drop one on it; with an image, hovering or focusing it
 * shows "Replace", and a round × in its corner removes it. Where the file
 * goes is the caller's job.
 */
export function ImageUploadControls({
  shape,
  image,
  noun,
  hint,
  error,
  accept,
  onFile,
  onRemove,
  disabled = false,
  isUploading = false,
  inputId,
}: ImageUploadControlsProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const hintId = useId()
  const [isDragOver, setIsDragOver] = useState(false)
  const hasImage = image !== null
  const locked = disabled || isUploading
  const reason = locked
    ? 'Please wait for the current request to finish.'
    : null
  const action = hasImage ? `Replace ${noun}` : `Upload ${noun}`

  const handleDragOver = (event: DragEvent<HTMLButtonElement>) => {
    if (locked || !draggingFiles(event)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    setIsDragOver(true)
  }

  const handleDragLeave = (event: DragEvent<HTMLButtonElement>) => {
    // Moving onto the tile's own image or label is not leaving it.
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return
    }
    setIsDragOver(false)
  }

  const handleDrop = (event: DragEvent<HTMLButtonElement>) => {
    setIsDragOver(false)
    if (locked || !draggingFiles(event)) return
    event.preventDefault()
    const file = event.dataTransfer.files[0]
    if (file) onFile(file)
  }

  return (
    <div className='flex flex-col items-start gap-2'>
      <div className='relative'>
        <DisabledFieldTooltip disabled={locked} reason={reason}>
          <button
            type='button'
            aria-label={action}
            aria-describedby={hintId}
            aria-busy={isUploading || undefined}
            disabled={locked}
            onClick={() => inputRef.current?.click()}
            onDragEnter={handleDragOver}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              'group relative flex shrink-0 cursor-pointer items-center justify-center overflow-hidden border transition-[color,border-color,box-shadow] outline-none',
              'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
              'disabled:cursor-not-allowed',
              disabled && !isUploading ? 'disabled:opacity-50' : null,
              SHAPE_CLASSES[shape],
              hasImage
                ? 'bg-muted/40'
                : 'text-muted-foreground hover:border-primary hover:text-foreground border-dashed',
              hasImage && shape === 'wide' ? 'px-2' : null,
              isDragOver
                ? 'border-primary text-foreground ring-primary/30 border-solid ring-[3px]'
                : null
            )}
          >
            {hasImage ? (
              image
            ) : (
              <span
                className={cn(
                  'flex items-center gap-1 text-xs font-medium',
                  shape === 'wide' ? 'flex-row' : 'flex-col'
                )}
              >
                <ImagePlus className='size-4' aria-hidden />
                {shape === 'wide' ? `Upload ${noun}` : 'Upload'}
              </span>
            )}
            {hasImage && !isUploading ? (
              <span
                aria-hidden
                className={cn(
                  'absolute inset-0 flex flex-col items-center justify-center gap-0.5 bg-black/55 text-xs font-medium text-white opacity-0 transition-opacity',
                  'group-hover:opacity-100 group-focus-visible:opacity-100',
                  isDragOver ? 'opacity-100' : null
                )}
              >
                <ImagePlus className='size-4' />
                Replace
              </span>
            ) : null}
            {isUploading ? (
              <span className='bg-background/70 absolute inset-0 flex items-center justify-center'>
                <Loader2
                  className='text-foreground size-5 animate-spin'
                  aria-hidden
                />
                <span className='sr-only'>Uploading {noun}</span>
              </span>
            ) : null}
          </button>
        </DisabledFieldTooltip>
        {hasImage && !locked ? (
          <RowActionButton
            type='button'
            label={`Remove ${noun}`}
            icon={<X />}
            variant='outline'
            onClick={onRemove}
            className={cn(
              'bg-background absolute size-6 rounded-full shadow-sm [&_svg]:size-3',
              // On a circle the corner sits off the image; tuck it in.
              shape === 'circle' ? '-top-1 -right-1' : '-top-2 -right-2'
            )}
          />
        ) : null}
      </div>
      <p id={hintId} className='text-muted-foreground text-xs'>
        {hint}
      </p>
      {error ? <p className='text-destructive text-sm'>{error}</p> : null}
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
