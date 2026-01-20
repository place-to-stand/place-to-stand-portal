import 'server-only'

import { getValidAccessToken, OAuthReconnectRequiredError } from '@/lib/gmail/client'

// Re-export for consumers
export { OAuthReconnectRequiredError }

// =============================================================================
// Types
// =============================================================================

export interface DriveFile {
  kind: string
  id: string
  name: string
  mimeType: string
  webViewLink?: string
  webContentLink?: string
  createdTime?: string
  modifiedTime?: string
}

export interface CopyDocumentParams {
  /** Source document ID to copy */
  sourceDocId: string
  /** Name for the new document */
  name: string
  /** Optional folder ID to place the copy in */
  folderId?: string
}

export interface ShareDocumentParams {
  /** Document ID to share */
  docId: string
  /** Email address to share with */
  email: string
  /** Permission role */
  role: 'reader' | 'writer' | 'commenter'
  /** Send notification email to the recipient */
  sendNotification?: boolean
  /** Optional message to include in notification */
  emailMessage?: string
}

export interface ReplaceTextParams {
  /** Document ID */
  docId: string
  /** Map of placeholder to replacement value */
  replacements: Record<string, string>
}

// =============================================================================
// Drive API Functions
// =============================================================================

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3'
const DOCS_API_BASE = 'https://docs.googleapis.com/v1'

/**
 * Copy a Google Doc, optionally into a specific folder.
 * Returns the new document's metadata.
 */
export async function copyDocument(
  userId: string,
  params: CopyDocumentParams,
  options?: { connectionId?: string }
): Promise<DriveFile> {
  const { accessToken } = await getValidAccessToken(userId, options?.connectionId)

  const url = new URL(`${DRIVE_API_BASE}/files/${encodeURIComponent(params.sourceDocId)}/copy`)

  const requestBody: Record<string, unknown> = {
    name: params.name,
  }

  if (params.folderId) {
    requestBody.parents = [params.folderId]
  }

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Failed to copy document: ${errorText}`)
  }

  return res.json()
}

/**
 * Get metadata for a Google Drive file/document.
 */
export async function getDocument(
  userId: string,
  docId: string,
  options?: { connectionId?: string }
): Promise<DriveFile> {
  const { accessToken } = await getValidAccessToken(userId, options?.connectionId)

  const url = new URL(`${DRIVE_API_BASE}/files/${encodeURIComponent(docId)}`)
  url.searchParams.set('fields', 'id,name,mimeType,webViewLink,webContentLink,createdTime,modifiedTime')

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Failed to get document: ${errorText}`)
  }

  return res.json()
}

/**
 * Share a document with a specific user.
 */
export async function shareDocument(
  userId: string,
  params: ShareDocumentParams,
  options?: { connectionId?: string }
): Promise<void> {
  const { accessToken } = await getValidAccessToken(userId, options?.connectionId)

  const url = new URL(`${DRIVE_API_BASE}/files/${encodeURIComponent(params.docId)}/permissions`)

  // Whether to send email notification
  url.searchParams.set('sendNotificationEmail', String(params.sendNotification ?? true))
  if (params.emailMessage) {
    url.searchParams.set('emailMessage', params.emailMessage)
  }

  const requestBody = {
    type: 'user',
    role: params.role,
    emailAddress: params.email,
  }

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Failed to share document: ${errorText}`)
  }
}

/**
 * Replace text placeholders in a Google Doc.
 * Placeholders should be in the format {{placeholder_name}}.
 */
export async function replaceTextInDocument(
  userId: string,
  params: ReplaceTextParams,
  options?: { connectionId?: string }
): Promise<void> {
  const { accessToken } = await getValidAccessToken(userId, options?.connectionId)

  const url = `${DOCS_API_BASE}/documents/${encodeURIComponent(params.docId)}:batchUpdate`

  // Build replace requests for each placeholder
  const requests = Object.entries(params.replacements).map(([placeholder, replacement]) => ({
    replaceAllText: {
      containsText: {
        text: placeholder,
        matchCase: true,
      },
      replaceText: replacement,
    },
  }))

  if (requests.length === 0) {
    return
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ requests }),
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Failed to replace text in document: ${errorText}`)
  }
}

/**
 * Build the web view URL for a Google Doc.
 */
export function getDocUrl(docId: string): string {
  return `https://docs.google.com/document/d/${docId}/edit`
}

/**
 * Extract document ID from a Google Docs URL.
 * Supports various URL formats:
 * - https://docs.google.com/document/d/{id}/edit
 * - https://docs.google.com/document/d/{id}
 * - Just the ID itself
 */
export function extractDocIdFromUrl(urlOrId: string): string | null {
  // If it's already just an ID (no slashes or typical URL characters)
  if (/^[a-zA-Z0-9_-]+$/.test(urlOrId) && !urlOrId.includes('/')) {
    return urlOrId
  }

  // Try to extract from URL
  const patterns = [
    /\/document\/d\/([a-zA-Z0-9_-]+)/,
    /\/documents\/([a-zA-Z0-9_-]+)/,
    /id=([a-zA-Z0-9_-]+)/,
  ]

  for (const pattern of patterns) {
    const match = urlOrId.match(pattern)
    if (match?.[1]) {
      return match[1]
    }
  }

  return null
}
