'use client'

import { useCallback, useMemo, useRef, type ChangeEvent } from 'react'
import { FileText, X } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { EntityList } from '@/components/sheets/entity-list'
import { SheetRecordRow } from '@/components/sheets/sheet-record-row'
import { CONCEPT_ICONS } from '@/lib/concept-icons'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'

import type { AttachmentItem } from '@/lib/projects/task-sheet/use-task-sheet-state'

type TaskAttachmentsFieldProps = {
  attachments: AttachmentItem[]
  onSelectFiles: (files: FileList | null) => void
  onRemove: (key: string) => void
  disabled: boolean
  disabledReason: string | null
  isUploading: boolean
  isDragActive: boolean
  /** Puts back a saved file removed in this sheet. */
  onUndoRemove: (key: string) => void
  acceptedMimeTypes: readonly string[]
  maxFileSize: number
}

const MAX_NAME_LENGTH = 64

const formatBytes = (bytes: number) => {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  )
  const value = bytes / Math.pow(1024, exponent)
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`
}

const truncateName = (name: string) => {
  if (name.length <= MAX_NAME_LENGTH) {
    return name
  }
  const extensionIndex = name.lastIndexOf('.')
  if (extensionIndex === -1) {
    return `${name.slice(0, MAX_NAME_LENGTH - 3)}...`
  }
  const base = name.slice(0, extensionIndex)
  const extension = name.slice(extensionIndex)
  const available = MAX_NAME_LENGTH - extension.length - 3
  if (available <= 0) {
    return `${name.slice(0, MAX_NAME_LENGTH - 3)}...`
  }
  return `${base.slice(0, available)}...${extension}`
}

export function TaskAttachmentsField({
  attachments,
  onSelectFiles,
  onRemove,
  disabled,
  disabledReason,
  isUploading,
  isDragActive,
  onUndoRemove,
  acceptedMimeTypes,
  maxFileSize,
}: TaskAttachmentsFieldProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const acceptValue = useMemo(
    () => acceptedMimeTypes.join(','),
    [acceptedMimeTypes]
  )

  const maxSizeLabel = useMemo(() => formatBytes(maxFileSize), [maxFileSize])

  const openFilePicker = useCallback(() => {
    if (disabled || isUploading) {
      return
    }
    fileInputRef.current?.click()
  }, [disabled, isUploading])

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      onSelectFiles(event.target.files)
      event.target.value = ''
    },
    [onSelectFiles]
  )

  const renderAttachmentRow = useCallback(
    (attachment: AttachmentItem) => {
      if (attachment.isRemoved) {
        return (
          <li key={attachment.key}>
            <SheetRecordRow
              leading={<FileText className='text-muted-foreground h-4 w-4' />}
              title={truncateName(attachment.name)}
              pendingRemoval={{
                disabled,
                onUndo: () => onUndoRemove(attachment.key),
              }}
            />
          </li>
        )
      }
      const removalDisabled = disabled || isUploading
      const content = attachment.url ? (
        <a
          href={attachment.url}
          target='_blank'
          rel='noreferrer'
          className='text-primary truncate-link inline-flex items-center gap-2 font-medium hover:underline'
        >
          <CONCEPT_ICONS.attachment className='h-4 w-4 shrink-0' />
          <span className='truncate'>{truncateName(attachment.name)}</span>
        </a>
      ) : (
        <span className='text-muted-foreground inline-flex items-center gap-2 truncate font-medium'>
          <FileText className='h-4 w-4 shrink-0' />
          <span className='truncate'>{truncateName(attachment.name)}</span>
        </span>
      )

      return (
        <li
          key={attachment.key}
          className='border-border bg-card flex items-center justify-between gap-4 rounded-md border px-3 py-2 text-sm'
        >
          <div className='flex min-w-0 flex-col gap-1'>
            {content}
            <div className='text-muted-foreground flex flex-wrap items-center gap-2 text-xs'>
              <span>{attachment.mimeType}</span>
              <span>•</span>
              <span>{formatBytes(attachment.size)}</span>
              {attachment.isPending ? (
                <span className='text-warning'>Pending save</span>
              ) : null}
            </div>
          </div>
          <DisabledFieldTooltip
            disabled={removalDisabled}
            reason={
              disabled
                ? disabledReason
                : isUploading
                  ? 'Please wait for uploads to finish.'
                  : null
            }
          >
            <Button
              type='button'
              size='icon'
              variant='ghost'
              className='text-muted-foreground hover:text-destructive'
              onClick={() => onRemove(attachment.key)}
              aria-label={`Remove ${attachment.name}`}
              disabled={removalDisabled}
            >
              <X className='h-4 w-4' />
            </Button>
          </DisabledFieldTooltip>
        </li>
      )
    },
    [disabled, disabledReason, isUploading, onRemove, onUndoRemove]
  )

  const addReason = disabled
    ? disabledReason
    : isUploading
      ? 'Please wait for uploads to finish.'
      : null

  return (
    <div>
      <EntityList
        title='Attachments'
        icon={CONCEPT_ICONS.attachment}
        add={{
          label: 'Add attachment',
          onAdd: openFilePicker,
          disabled: disabled || isUploading,
          disabledReason: addReason,
        }}
        isEmpty={attachments.length === 0}
        emptyMessage='Drop files here or click to upload'
        emptyActive={isDragActive}
        emptyContent={
          // The drop zone keeps its own content in the shared empty box.
          <div className='flex items-center gap-2'>
            <CONCEPT_ICONS.attachment className='text-muted-foreground/70 h-6 w-6' />
            <div className='text-left'>
              <p className='font-medium'>Drop files here or click to upload</p>
              <p className='text-muted-foreground text-xs'>
                Images, videos, PDFs, or ZIPs up to {maxSizeLabel}
              </p>
            </div>
          </div>
        }
      >
        <div className='relative'>
          <ul className='space-y-2'>{attachments.map(renderAttachmentRow)}</ul>
          {isDragActive ? (
            <div className='bg-background/95 text-muted-foreground border-primary absolute inset-0 flex items-center justify-center gap-3 rounded-lg border border-dashed text-sm'>
              <CONCEPT_ICONS.attachment className='text-muted-foreground/70 h-6 w-6' />
              <p className='font-medium'>Release to add files</p>
            </div>
          ) : null}
        </div>
      </EntityList>
      <input
        ref={fileInputRef}
        type='file'
        multiple
        accept={acceptValue}
        hidden
        onChange={handleFileChange}
        disabled={disabled}
      />
    </div>
  )
}
