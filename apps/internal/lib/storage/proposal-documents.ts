import 'server-only'

import { getSupabaseServiceClient } from '@/lib/supabase/service'

const BUCKET = 'proposal-documents'

/**
 * Upload an executed proposal PDF to Supabase Storage.
 * Returns the storage path on success.
 */
export async function uploadExecutedPdf(
  proposalId: string,
  pdfBuffer: Buffer
): Promise<string> {
  const client = getSupabaseServiceClient()
  const path = `executed/${proposalId}.pdf`

  // Ensure bucket exists (idempotent)
  const { error: bucketErr } = await client.storage.createBucket(BUCKET, {
    public: false,
  })
  if (bucketErr && !bucketErr.message?.toLowerCase().includes('already exists')) {
    throw bucketErr
  }

  const { error } = await client.storage
    .from(BUCKET)
    .upload(path, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    })

  if (error) throw error
  return path
}

/**
 * Download an executed proposal PDF from Supabase Storage.
 * Returns a Buffer or null if not found.
 */
export async function downloadExecutedPdf(
  storagePath: string
): Promise<Buffer | null> {
  const client = getSupabaseServiceClient()

  const { data, error } = await client.storage
    .from(BUCKET)
    .download(storagePath)

  if (error) {
    if (error.message?.toLowerCase().includes('not found')) return null
    throw error
  }

  const arrayBuffer = await data.arrayBuffer()
  return Buffer.from(arrayBuffer)
}
