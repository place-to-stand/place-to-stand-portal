'use client'

import { useId, useRef, useState, type DragEvent, type ReactNode } from 'react'
import { ImagePlus, Loader2, Pencil, Trash2 } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@placetostand/ui/dropdown-menu'
import { RowActionButton } from '@placetostand/ui/row-action-button'

import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { cn } from '@/lib/utils'

type ImageUploadShape = 'square' | 'wide' | 'circle'

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

/** True while the drag carries files (not text or a link). */
function draggingFiles(event: DragEvent) {
  return Array.from(event.dataTransfer.types).includes('Files')
}

/**
 * The one shape for every image field (a person's photo, the business logo
 * and icon): the preview tile is the control. Click it (or Enter/Space) to
 * pick a file, or drop one on it. Nothing is drawn over the image: hover
 * darkens the border, focus shows the ring. With an image, a pencil beside
 * the tile opens Replace… and Remove. Where the file goes is the caller's
 * job.
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
      {/* The tile, then (with an image) its edit menu beside it: nothing
          ever sits on the frame or the photo. */}
      <div className='flex items-center gap-2'>
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
              'relative flex shrink-0 cursor-pointer items-center justify-center overflow-hidden border transition-[color,border-color,box-shadow] outline-none',
              'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
              'disabled:cursor-not-allowed',
              disabled && !isUploading ? 'disabled:opacity-50' : null,
              SHAPE_CLASSES[shape],
              FRAME_CLASSES[shape],
              hasImage
                ? 'hover:border-foreground/30'
                : 'border-muted-foreground/40 text-muted-foreground hover:border-foreground/30 hover:text-foreground border-dashed',
              isDragOver ? 'border-primary bg-primary/5 border-dashed' : null
            )}
          >
            {hasImage ? image : <ImagePlus className='size-5' aria-hidden />}
            {isUploading ? (
              // The one thing ever drawn over the image: a small spinner.
              <span className='absolute inset-0 flex items-center justify-center'>
                <span className='bg-background flex size-7 items-center justify-center rounded-full border shadow-sm'>
                  <Loader2
                    className='text-foreground size-4 animate-spin'
                    aria-hidden
                  />
                </span>
                <span className='sr-only'>Uploading {noun}</span>
              </span>
            ) : null}
          </button>
        </DisabledFieldTooltip>
        {hasImage && !locked ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              {/* A menu trigger: the menu is labelled, so no tooltip
                  (house rule 11); the label still names it. */}
              <RowActionButton
                type='button'
                label={`Edit ${noun}`}
                icon={<Pencil />}
                variant='outline'
                tooltip={false}
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => inputRef.current?.click()}>
                <ImagePlus />
                Replace…
              </DropdownMenuItem>
              <DropdownMenuItem variant='destructive' onClick={onRemove}>
                <Trash2 />
                Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
