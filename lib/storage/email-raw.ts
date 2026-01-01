import 'server-only'

import { createHash } from 'node:crypto'

import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/supabase/types'

type EmailRawBucketClient = SupabaseClient<Database>

export const EMAIL_RAW_BUCKET = 'email-raw'
export const MAX_RAW_EMAIL_SIZE = 25 * 1024 * 1024 // 25MB (Gmail max attachment size)

type UploadOptions = {
  client: EmailRawBucketClient
  userId: string
  messageId: string
  rawMime: Buffer | Uint8Array
}

type RetrieveOptions = {
  client: EmailRawBucketClient
  storagePath: string
}

type DeleteOptions = {
  client: EmailRawBucketClient
  storagePath: string
}

/**
 * Ensure the email-raw bucket exists, creating it if necessary.
 */
export async function ensureEmailRawBucket(client: EmailRawBucketClient) {
  const { data, error } = await client.storage.getBucket(EMAIL_RAW_BUCKET)

  if (data && !error) {
    return
  }

  if (error && !error.message?.toLowerCase().includes('not found')) {
    throw error
  }

  const { error: createError } = await client.storage.createBucket(EMAIL_RAW_BUCKET, {
    public: false,
    fileSizeLimit: MAX_RAW_EMAIL_SIZE,
  })

  if (createError && !createError.message?.toLowerCase().includes('already exists')) {
    throw createError
  }
}

/**
 * Generate storage path for raw email content.
 * Format: {userId}/{year}/{month}/{messageId}.eml
 */
export function generateEmailRawPath(userId: string, messageId: string): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${userId}/${year}/${month}/${messageId}.eml`
}

/**
 * Calculate SHA-256 checksum of content.
 */
export function calculateChecksum(content: Buffer | Uint8Array): string {
  return createHash('sha256').update(content).digest('hex')
}

/**
 * Upload raw MIME content to storage.
 * Returns the storage path and checksum.
 */
export async function uploadEmailRaw({
  client,
  userId,
  messageId,
  rawMime,
}: UploadOptions): Promise<{ storagePath: string; checksum: string; sizeBytes: number }> {
  await ensureEmailRawBucket(client)

  const storagePath = generateEmailRawPath(userId, messageId)
  const checksum = calculateChecksum(rawMime)
  const sizeBytes = rawMime.length

  const { error } = await client.storage
    .from(EMAIL_RAW_BUCKET)
    .upload(storagePath, rawMime, {
      contentType: 'message/rfc822',
      upsert: true,
    })

  if (error) {
    throw error
  }

  return { storagePath, checksum, sizeBytes }
}

/**
 * Retrieve raw MIME content from storage.
 */
export async function retrieveEmailRaw({
  client,
  storagePath,
}: RetrieveOptions): Promise<Blob> {
  const { data, error } = await client.storage
    .from(EMAIL_RAW_BUCKET)
    .download(storagePath)

  if (error) {
    throw error
  }

  return data
}

/**
 * Delete raw MIME content from storage.
 */
export async function deleteEmailRaw({ client, storagePath }: DeleteOptions): Promise<void> {
  const { error } = await client.storage.from(EMAIL_RAW_BUCKET).remove([storagePath])

  if (error) {
    throw error
  }
}

/**
 * Generate a signed URL for downloading raw email content.
 */
export async function getEmailRawSignedUrl(
  client: EmailRawBucketClient,
  storagePath: string,
  expiresIn = 3600
): Promise<string> {
  const { data, error } = await client.storage
    .from(EMAIL_RAW_BUCKET)
    .createSignedUrl(storagePath, expiresIn)

  if (error) {
    throw error
  }

  return data.signedUrl
}
