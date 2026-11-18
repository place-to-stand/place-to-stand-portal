'use client'

import { useState } from 'react'

import { ImageUploadControls } from '@/components/forms/image-upload-controls'

import { Example, Specimen } from './specimen'

// A plain square so the "with an image" state has something to show.
const SAMPLE_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' fill='%2394a3b8'/%3E%3Ccircle cx='32' cy='32' r='12' fill='%23f8fafc'/%3E%3C/svg%3E"

const ACCEPT = 'image/png,image/jpeg,image/webp,image/svg+xml'

function DemoField({
  shape,
  noun,
  hint,
  initial,
}: {
  shape: 'square' | 'wide' | 'circle'
  noun: string
  hint: string
  initial: string | null
}) {
  // Nothing uploads here: a picked or dropped file previews locally.
  const [src, setSrc] = useState<string | null>(initial)
  return (
    <ImageUploadControls
      shape={shape}
      image={
        src ? (
          // oxlint-disable-next-line next-js/no-img-element -- a local preview; next/image adds nothing
          <img
            src={src}
            alt={`${noun} preview`}
            className={
              shape === 'wide'
                ? 'max-h-full max-w-full object-contain'
                : 'size-full object-cover'
            }
          />
        ) : null
      }
      noun={noun}
      hint={hint}
      accept={ACCEPT}
      onFile={file => setSrc(URL.createObjectURL(file))}
      onRemove={() => setSrc(null)}
    />
  )
}

/** The image field: the preview tile is the upload, replace and drop target. */
export function ImageUploadSpecimen() {
  return (
    <Specimen
      label='Image fields'
      note='components/forms/image-upload-controls · click, Enter or drop a file on the tile'
      className='grid grid-cols-1 gap-6 md:grid-cols-3'
    >
      <Example caption='circle · empty (a person’s photo)'>
        <DemoField
          shape='circle'
          noun='photo'
          hint='Square image up to 2MB.'
          initial={null}
        />
      </Example>
      <Example caption='square · with an image: hover for Replace, × removes'>
        <DemoField
          shape='square'
          noun='icon'
          hint='Square image up to 256 KB.'
          initial={SAMPLE_IMAGE}
        />
      </Example>
      <Example caption='wide · empty (the business logo)'>
        <DemoField
          shape='wide'
          noun='logo'
          hint='Wide image up to 256 KB.'
          initial={null}
        />
      </Example>
    </Specimen>
  )
}
