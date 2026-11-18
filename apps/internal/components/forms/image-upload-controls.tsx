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

/** Every tile is 64px tall, so a photo, an icon and a logo read as one family. */
const SHAPE_CLASSES: Record<ImageUploadShape, string> = {
  square: 'size-16 rounded-lg',
  circle: 'size-16 rounded-full',
  wide: 'h-16 w-48 rounded-lg',
}

/**
 * The one frame for a logo or icon, empty or filled: a muted box with an 8px
 * inset, the image contained in it. A photo is a plain circle it fills.
 */
const FRAME_CLASSES: Record<ImageUploadShape, string> = {
  square: 'bg-muted/40 p-2',
  wide: 'bg-muted/40 p-2',
  circle: '',
}

/**
 * Where the remove badge sits: inside the frame's top-right corner, 4px in,
 * and inside a photo's 64px box on the circle's edge, so it never pokes out
 * of the field (or into the label above it).
 */
const REMOVE_POSITION: Record<ImageUploadShape, string> = {
  square: 'top-1 right-1',
  wide: 'top-1 right-1',
  circle: 'top-0 right-0',
}

/** True while the drag carries files (not text or a link). */
function draggingFiles(event: DragEvent) {
  return Array.from(event.dataTransfer.types).includes('Files')
}

/**
 * The one shape for every image field (a person's photo, the business logo
 * and icon): the preview tile is the control. Click it (or Enter/Space) to
 * pick a file, or drop one on it; with an image, hovering or focusing it
 * lays a dark layer with the image icon over it (its name says "Replace"),
 * and a round × on its corner removes it. Where the file
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
      {/* Room above a rectangle for the half of the badge over its corner,
          so it never rides into the field's label. */}
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
              FRAME_CLASSES[shape],
              hasImage
                ? null
                : 'border-muted-foreground/40 text-muted-foreground hover:border-primary hover:text-foreground border-dashed',
              isDragOver
                ? 'border-primary text-foreground ring-primary/30 border-solid ring-[3px]'
                : null
            )}
          >
            {hasImage ? image : <ImagePlus className='size-5' aria-hidden />}
            {hasImage && !isUploading ? (
              <span
                aria-hidden
                className={cn(
                  // Strong enough to read over any image: a dark scrim and the
                  // icon in a solid white disc.
                  'absolute inset-0 flex items-center justify-center bg-black/65 opacity-0 transition-opacity',
                  'group-hover:opacity-100 group-focus-visible:opacity-100',
                  isDragOver ? 'opacity-100' : null
                )}
              >
                <span className='flex size-7 items-center justify-center rounded-full bg-white text-black shadow-sm'>
                  <ImagePlus className='size-4' />
                </span>
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
            size='icon-xs'
            onClick={onRemove}
            className={cn(
              // A solid badge in both themes (the outline variant is
              // see-through in dark), red on hover or keyboard focus.
              'text-foreground bg-background dark:bg-background border-border dark:border-border absolute z-10 rounded-full shadow-sm',
              'hover:bg-destructive hover:border-destructive dark:hover:bg-destructive focus-visible:bg-destructive focus-visible:border-destructive hover:text-white focus-visible:text-white',
              REMOVE_POSITION[shape]
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
