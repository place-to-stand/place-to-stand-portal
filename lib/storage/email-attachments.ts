import 'server-only'

import { randomUUID } from 'node:crypto'

import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/supabase/types'
import {
  ACCEPTED_EMAIL_ATTACHMENT_MIME_TYPES,
  EMAIL_ATTACHMENT_BUCKET,
  MAX_EMAIL_ATTACHMENT_FILE_SIZE,
} from './email-attachment-constants'

export type EmailAttachmentBucketClient = SupabaseClient<Database>

const DRAFT_PREFIX = 'drafts'

/** Attachment metadata stored in email_drafts.attachments jsonb array */
export interface EmailAttachmentMetadata {
  storageKey: string
  filename: string
  mimeType: string
  size: number
}

const ACCEPTED_ATTACHMENT_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation':
    'pptx',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'text/html': 'html',
  'application/zip': 'zip',
  'application/x-zip-compressed': 'zip',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
}

export function resolveEmailAttachmentExtension(mimeType: string) {
  return ACCEPTED_ATTACHMENT_EXTENSIONS[
    mimeType as keyof typeof ACCEPTED_ATTACHMENT_EXTENSIONS
  ]
}

export function inferAttachmentExtensionFromPath(path: string) {
  const segments = path.split('.')
  return segments.length > 1 ? (segments.pop() ?? null) : null
}

export function isAcceptedEmailAttachmentType(mimeType: string): boolean {
  return (ACCEPTED_EMAIL_ATTACHMENT_MIME_TYPES as readonly string[]).includes(
    mimeType
  )
}

const parseFileSizeLimit = (value: string | number | null | undefined) => {
  if (typeof value === 'number') {
    return value
  }

  if (!value) {
    return null
  }

  const normalized = value.trim().toLowerCase()
  const unitMatch = normalized.match(/(kb|mb|gb)$/)
  const unit = unitMatch ? unitMatch[1] : null
  const numericPart = unit
    ? normalized.slice(0, -unit.length).trim()
    : normalized
  const numericValue = Number.parseFloat(numericPart)

  if (Number.isNaN(numericValue)) {
    return null
  }

  switch (unit) {
    case 'kb':
      return Math.round(numericValue * 1024)
    case 'mb':
      return Math.round(numericValue * 1024 * 1024)
    case 'gb':
      return Math.round(numericValue * 1024 * 1024 * 1024)
    default:
      return Math.round(numericValue)
  }
}

export async function ensureEmailAttachmentBucket(
  client: EmailAttachmentBucketClient
) {
  const desiredMimeTypes = [...ACCEPTED_EMAIL_ATTACHMENT_MIME_TYPES]
  const desiredFileSizeLimitLabel = `${Math.floor(MAX_EMAIL_ATTACHMENT_FILE_SIZE / (1024 * 1024))}MB`
  const desiredFileSizeLimitBytes = MAX_EMAIL_ATTACHMENT_FILE_SIZE

  const { data, error } = await client.storage.getBucket(EMAIL_ATTACHMENT_BUCKET)

  if (data && !error) {
    const currentMimeTypes = Array.isArray(data.allowed_mime_types)
      ? (data.allowed_mime_types as string[])
      : []
    const hasSameMimeTypes =
      currentMimeTypes.length === desiredMimeTypes.length &&
      desiredMimeTypes.every(type => currentMimeTypes.includes(type))
    const currentFileSizeBytes = parseFileSizeLimit(data.file_size_limit)
    const hasSameFileSize = currentFileSizeBytes === desiredFileSizeLimitBytes

    if (!hasSameMimeTypes || !hasSameFileSize) {
      const { error: updateError } = await client.storage.updateBucket(
        EMAIL_ATTACHMENT_BUCKET,
        {
          public: false,
          fileSizeLimit: desiredFileSizeLimitLabel,
          allowedMimeTypes: desiredMimeTypes,
        }
      )

      if (updateError) {
        throw updateError
      }
    }

    return
  }

  if (error && !error.message?.toLowerCase().includes('not found')) {
    throw error
  }

  const { error: createError } = await client.storage.createBucket(
    EMAIL_ATTACHMENT_BUCKET,
    {
      public: false,
      fileSizeLimit: desiredFileSizeLimitLabel,
      allowedMimeTypes: desiredMimeTypes,
    }
  )

  if (
    createError &&
    !createError.message?.toLowerCase().includes('already exists')
  ) {
    throw createError
  }
}

/**
 * Generate storage path for a draft attachment.
 * Format: drafts/{draftId}/{uuid}.{ext}
 */
export function generateDraftAttachmentPath({
  draftId,
  extension,
}: {
  draftId: string
  extension: string
}) {
  return `${DRAFT_PREFIX}/${draftId}/${randomUUID()}.${extension}`
}

/**
 * Upload an attachment file to storage.
 * Returns the storage key and metadata.
 */
export async function uploadEmailAttachment({
  client,
  draftId,
  file,
  filename,
}: {
  client: EmailAttachmentBucketClient
  draftId: string
  file: Buffer | Uint8Array
  filename: string
}): Promise<EmailAttachmentMetadata> {
  const mimeType = inferMimeTypeFromFilename(filename)
  const extension = resolveEmailAttachmentExtension(mimeType) ?? 'dat'
  const storageKey = generateDraftAttachmentPath({ draftId, extension })

  await ensureEmailAttachmentBucket(client)

  const { error } = await client.storage
    .from(EMAIL_ATTACHMENT_BUCKET)
    .upload(storageKey, file, {
      contentType: mimeType,
      upsert: false,
    })

  if (error) {
    throw error
  }

  return {
    storageKey,
    filename,
    mimeType,
    size: file.length,
  }
}

/**
 * Download an attachment from storage.
 * Returns the file data as a Buffer.
 */
export async function downloadEmailAttachment({
  client,
  storageKey,
}: {
  client: EmailAttachmentBucketClient
  storageKey: string
}): Promise<Buffer> {
  const { data, error } = await client.storage
    .from(EMAIL_ATTACHMENT_BUCKET)
    .download(storageKey)

  if (error) {
    throw error
  }

  const arrayBuffer = await data.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

/** Attachment ready to be sent via email */
export interface EmailAttachmentForSend {
  filename: string
  mimeType: string
  content: Buffer
}

/**
 * Download multiple attachments in parallel for email sending.
 * Takes metadata array and returns attachments ready for MIME encoding.
 */
export async function downloadAttachmentsForSend({
  client,
  attachments,
}: {
  client: EmailAttachmentBucketClient
  attachments: EmailAttachmentMetadata[]
}): Promise<EmailAttachmentForSend[]> {
  if (!attachments || attachments.length === 0) {
    return []
  }

  return Promise.all(
    attachments.map(async attachment => {
      const content = await downloadEmailAttachment({
        client,
        storageKey: attachment.storageKey,
      })
      return {
        filename: attachment.filename,
        mimeType: attachment.mimeType,
        content,
      }
    })
  )
}

/**
 * Delete an attachment from storage.
 */
export async function deleteEmailAttachment({
  client,
  storageKey,
}: {
  client: EmailAttachmentBucketClient
  storageKey: string
}) {
  if (!storageKey) {
    return
  }

  const { error } = await client.storage
    .from(EMAIL_ATTACHMENT_BUCKET)
    .remove([storageKey])

  if (error) {
    throw error
  }
}

/**
 * Delete all attachments for a draft.
 */
export async function deleteAllDraftAttachments({
  client,
  draftId,
}: {
  client: EmailAttachmentBucketClient
  draftId: string
}) {
  const prefix = `${DRAFT_PREFIX}/${draftId}/`

  const { data: files, error: listError } = await client.storage
    .from(EMAIL_ATTACHMENT_BUCKET)
    .list(`${DRAFT_PREFIX}/${draftId}`)

  if (listError) {
    throw listError
  }

  if (!files || files.length === 0) {
    return
  }

  const paths = files.map(f => `${prefix}${f.name}`)

  const { error: removeError } = await client.storage
    .from(EMAIL_ATTACHMENT_BUCKET)
    .remove(paths)

  if (removeError) {
    throw removeError
  }
}

/**
 * Get a signed URL for downloading an attachment.
 * Valid for 1 hour by default.
 */
export async function getEmailAttachmentSignedUrl({
  client,
  storageKey,
  expiresIn = 3600,
}: {
  client: EmailAttachmentBucketClient
  storageKey: string
  expiresIn?: number
}): Promise<string> {
  const { data, error } = await client.storage
    .from(EMAIL_ATTACHMENT_BUCKET)
    .createSignedUrl(storageKey, expiresIn)

  if (error) {
    throw error
  }

  return data.signedUrl
}

/**
 * Infer MIME type from filename extension.
 */
function inferMimeTypeFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()

  const extensionToMime: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    txt: 'text/plain',
    csv: 'text/csv',
    html: 'text/html',
    zip: 'application/zip',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
  }

  return extensionToMime[ext ?? ''] ?? 'application/octet-stream'
}
