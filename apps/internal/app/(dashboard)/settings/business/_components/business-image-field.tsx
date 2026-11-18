'use client'

import { useId, useState } from 'react'

import { Label } from '@pts/ui/label'

import { ImageUploadControls } from '@/components/forms/image-upload-controls'
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
  /** Size and types allowed, under the buttons. */
  hint: string
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
  hint,
}: BusinessImageFieldProps) {
  const inputId = useId()
  const [localError, setLocalError] = useState<string | null>(null)

  const previewSrc =
    change.kind === 'replace'
      ? change.dataUrl
      : change.kind === 'remove'
        ? null
        : currentSrc

  const handleFile = (file: File) => {
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
      <ImageUploadControls
        inputId={inputId}
        preview={
          <div
            className={
              shape === 'square'
                ? 'bg-muted/40 flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md border'
                : 'bg-muted/40 flex h-12 w-40 shrink-0 items-center justify-center overflow-hidden rounded-md border px-2'
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
        }
        hasImage={Boolean(previewSrc)}
        noun={label.toLowerCase()}
        hint={hint}
        accept={BUSINESS_IMAGE_TYPES.join(',')}
        onFile={handleFile}
        onRemove={() => {
          setLocalError(null)
          onChange(currentSrc ? { kind: 'remove' } : { kind: 'keep' })
        }}
        disabled={disabled}
      />
      {shown ? <p className='text-destructive text-sm'>{shown}</p> : null}
    </div>
  )
}
