import 'server-only'

import { randomUUID } from 'node:crypto'

import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/supabase/types'

type AttachmentBucketClient = SupabaseClient<Database>

export const EMAIL_ATTACHMENTS_BUCKET = 'email-attachments'
export const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024 // 25MB per attachment

type UploadOptions = {
  client: AttachmentBucketClient
  userId: string
  messageId: string
  attachmentId: string
  content: Buffer | Uint8Array
  mimeType: string
  originalName: string
}

type RetrieveOptions = {
  client: AttachmentBucketClient
  storagePath: string
}

type DeleteOptions = {
  client: AttachmentBucketClient
  storagePaths: string[]
}

/**
 * Ensure the email-attachments bucket exists, creating it if necessary.
 */
export async function ensureEmailAttachmentsBucket(client: AttachmentBucketClient) {
  const { data, error } = await client.storage.getBucket(EMAIL_ATTACHMENTS_BUCKET)

  if (data && !error) {
    return
  }

  if (error && !error.message?.toLowerCase().includes('not found')) {
    throw error
  }

  const { error: createError } = await client.storage.createBucket(EMAIL_ATTACHMENTS_BUCKET, {
    public: false,
    fileSizeLimit: MAX_ATTACHMENT_SIZE,
  })

  if (createError && !createError.message?.toLowerCase().includes('already exists')) {
    throw createError
  }
}

/**
 * Get file extension from original filename or mime type.
 */
function getExtension(originalName: string, mimeType: string): string {
  // Try to get from original name first
  const nameParts = originalName.split('.')
  if (nameParts.length > 1) {
    const ext = nameParts.pop()
    if (ext && ext.length <= 10) {
      return ext.toLowerCase()
    }
  }

  // Fallback to common mime type mappings
  const mimeToExt: Record<string, string> = {
    'application/pdf': 'pdf',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'text/plain': 'txt',
    'text/html': 'html',
    'text/csv': 'csv',
    'application/zip': 'zip',
  }

  return mimeToExt[mimeType] || 'bin'
}

/**
 * Generate storage path for email attachment.
 * Format: {userId}/{messageId}/{uuid}.{ext}
 */
export function generateAttachmentPath(
  userId: string,
  messageId: string,
  originalName: string,
  mimeType: string
): string {
  const ext = getExtension(originalName, mimeType)
  return `${userId}/${messageId}/${randomUUID()}.${ext}`
}

/**
 * Upload attachment content to storage.
 * Returns the storage path.
 */
export async function uploadEmailAttachment({
  client,
  userId,
  messageId,
  content,
  mimeType,
  originalName,
}: UploadOptions): Promise<{ storagePath: string; fileSize: number }> {
  await ensureEmailAttachmentsBucket(client)

  const storagePath = generateAttachmentPath(userId, messageId, originalName, mimeType)
  const fileSize = content.length

  const { error } = await client.storage
    .from(EMAIL_ATTACHMENTS_BUCKET)
    .upload(storagePath, content, {
      contentType: mimeType,
      upsert: true,
    })

  if (error) {
    throw error
  }

  return { storagePath, fileSize }
}

/**
 * Retrieve attachment content from storage.
 */
export async function retrieveEmailAttachment({
  client,
  storagePath,
}: RetrieveOptions): Promise<Blob> {
  const { data, error } = await client.storage
    .from(EMAIL_ATTACHMENTS_BUCKET)
    .download(storagePath)

  if (error) {
    throw error
  }

  return data
}

/**
 * Delete attachments from storage.
 */
export async function deleteEmailAttachments({ client, storagePaths }: DeleteOptions): Promise<void> {
  if (storagePaths.length === 0) return

  const { error } = await client.storage.from(EMAIL_ATTACHMENTS_BUCKET).remove(storagePaths)

  if (error) {
    throw error
  }
}

/**
 * Generate a signed URL for downloading an attachment.
 */
export async function getAttachmentSignedUrl(
  client: AttachmentBucketClient,
  storagePath: string,
  expiresIn = 3600
): Promise<string> {
  const { data, error } = await client.storage
    .from(EMAIL_ATTACHMENTS_BUCKET)
    .createSignedUrl(storagePath, expiresIn)

  if (error) {
    throw error
  }

  return data.signedUrl
}

/**
 * Get signed URLs for multiple attachments.
 */
export async function getAttachmentSignedUrls(
  client: AttachmentBucketClient,
  storagePaths: string[],
  expiresIn = 3600
): Promise<Record<string, string>> {
  if (storagePaths.length === 0) return {}

  const { data, error } = await client.storage
    .from(EMAIL_ATTACHMENTS_BUCKET)
    .createSignedUrls(storagePaths, expiresIn)

  if (error) {
    throw error
  }

  const result: Record<string, string> = {}
  data.forEach(({ path, signedUrl }) => {
    if (path) result[path] = signedUrl
  })

  return result
}
