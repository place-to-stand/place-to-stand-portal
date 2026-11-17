'use client'

import { useId, useRef, useState } from 'react'

import { Button } from '@pts/ui/button'
import { Label } from '@pts/ui/label'

import { OptionalMarker } from '@/components/ui/form'
import {
  BUSINESS_IMAGE_MAX_BYTES,
  BUSINESS_IMAGE_TYPES,
  isBusinessImageType,
} from '@/lib/business/images'
import type { BusinessImageChange } from '@/lib/business/settings-form'

type BusinessImageFieldProps = {
  label: string
  /** The stored image, or null when none is uploaded. */
  currentSrc: string | null
  change: BusinessImageChange
  onChange: (change: BusinessImageChange) => void
  error?: string
  disabled?: boolean
  /** The icon previews square; the logo keeps its shape. */
  shape: 'square' | 'wide'
}

/** Upload, replace or remove the logo or icon. Nothing saves until Save. */
export function BusinessImageField({
  label,
  currentSrc,
  change,
  onChange,
  error,
  disabled,
  shape,
}: BusinessImageFieldProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [localError, setLocalError] = useState<string | null>(null)

  const previewSrc =
    change.kind === 'replace'
      ? change.dataUrl
      : change.kind === 'remove'
        ? null
        : currentSrc

  const handleFile = (file: File | undefined) => {
    if (!file) return
    if (!isBusinessImageType(file.type)) {
      setLocalError('Use a PNG, JPEG, WebP or SVG image.')
      return
    }
    if (file.size > BUSINESS_IMAGE_MAX_BYTES) {
      setLocalError('Images must be 256 KB or smaller.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setLocalError(null)
      onChange({ kind: 'replace', dataUrl: String(reader.result) })
    }
    reader.onerror = () => setLocalError('That file could not be read.')
    reader.readAsDataURL(file)
  }

  const shown = localError ?? error

  return (
    <div className='grid gap-2'>
      <Label htmlFor={inputId}>
        {label}
        <OptionalMarker />
      </Label>
      <div className='flex flex-wrap items-center gap-3'>
        <div
          className={
            shape === 'square'
              ? 'bg-muted/40 flex size-12 items-center justify-center overflow-hidden rounded-md border'
              : 'bg-muted/40 flex h-12 w-40 items-center justify-center overflow-hidden rounded-md border px-2'
          }
        >
          {previewSrc ? (
            // oxlint-disable-next-line next-js/no-img-element -- a data URL or our own route; next/image adds nothing
            <img
              src={previewSrc}
              alt={`${label} preview`}
              className='max-h-full max-w-full object-contain'
            />
          ) : (
            <span className='text-muted-foreground text-xs'>None</span>
          )}
        </div>
        <input
          ref={inputRef}
          id={inputId}
          type='file'
          accept={BUSINESS_IMAGE_TYPES.join(',')}
          className='sr-only'
          disabled={disabled}
          onChange={event => {
            handleFile(event.target.files?.[0])
            event.target.value = ''
          }}
        />
        <Button
          type='button'
          variant='outline'
          size='sm'
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          {previewSrc ? 'Replace' : 'Upload'}
        </Button>
        {previewSrc ? (
          <Button
            type='button'
            variant='ghost'
            size='sm'
            disabled={disabled}
            onClick={() => {
              setLocalError(null)
              onChange(currentSrc ? { kind: 'remove' } : { kind: 'keep' })
            }}
          >
            Remove
          </Button>
        ) : null}
      </div>
      {shown ? <p className='text-destructive text-sm'>{shown}</p> : null}
    </div>
  )
}
