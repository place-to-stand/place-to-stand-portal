import 'server-only'

import { getValidAccessToken } from '@/lib/gmail/client'

// =============================================================================
// Search Query Constants
// =============================================================================

const TRANSCRIPT_SEARCH_QUERIES = [
  {
    name: 'Gemini Notes',
    query:
      "name contains 'Notes by Gemini' and mimeType='application/vnd.google-apps.document' and trashed=false",
  },
  {
    name: 'Transcript',
    query:
      "name contains 'Transcript' and mimeType='application/vnd.google-apps.document' and trashed=false",
  },
  {
    name: 'Meeting notes',
    query:
      "name contains 'Meeting notes' and mimeType='application/vnd.google-apps.document' and trashed=false",
  },
] as const

const DRIVE_PAGE_SIZE = 100

// =============================================================================
// Types
// =============================================================================

export type DiscoveredTranscript = {
  driveFileId: string
  driveFileUrl: string
  title: string
  source: 'DRIVE_SEARCH'
  meetingDate: string | null
  modifiedTime: string
}

type DriveFile = {
  id: string
  name: string
  webViewLink: string
  createdTime: string
  modifiedTime: string
}

// =============================================================================
// Discovery
// =============================================================================

/**
 * Search Google Drive for transcript/meeting notes documents.
 * Runs multiple search queries, deduplicates by file ID, and extracts content.
 */
export async function discoverTranscriptsFromDrive(
  userId: string,
  options?: { connectionId?: string; since?: string }
): Promise<DiscoveredTranscript[]> {
  const { accessToken } = await getValidAccessToken(userId, options?.connectionId)

  // Run all search queries and collect results
  const allFiles = new Map<string, DriveFile>()

  for (const searchQuery of TRANSCRIPT_SEARCH_QUERIES) {
    try {
      // For incremental sync, add modifiedTime filter to narrow results
      const query = options?.since
        ? `${searchQuery.query} and modifiedTime > '${options.since}'`
        : searchQuery.query
      const files = await searchDrive(accessToken, query)
      console.log(
        `[Transcript Discovery] ${searchQuery.name}: ${files.length} results`
      )
      for (const file of files) {
        if (!allFiles.has(file.id)) {
          allFiles.set(file.id, file)
        }
      }
    } catch (error) {
      console.error(
        `[Transcript Discovery] ${searchQuery.name} search failed:`,
        error
      )
    }
  }

  console.log(
    `[Transcript Discovery] Total unique files: ${allFiles.size}`
  )

  // Sort by most recent and map to metadata-only results
  // (content is lazy-loaded on demand from detail sheet and analyze endpoints)
  return Array.from(allFiles.values())
    .sort(
      (a, b) =>
        new Date(b.modifiedTime).getTime() -
        new Date(a.modifiedTime).getTime()
    )
    .map(file => ({
      driveFileId: file.id,
      driveFileUrl: file.webViewLink,
      title: file.name,
      source: 'DRIVE_SEARCH' as const,
      meetingDate: extractMeetingDate(file.name, file.createdTime),
      modifiedTime: file.modifiedTime,
    }))
}

// =============================================================================
// Drive API
// =============================================================================

async function searchDrive(
  accessToken: string,
  query: string
): Promise<DriveFile[]> {
  const allFiles: DriveFile[] = []
  let pageToken: string | undefined

  do {
    const url = new URL('https://www.googleapis.com/drive/v3/files')
    url.searchParams.set('q', query)
    url.searchParams.set('orderBy', 'modifiedTime desc')
    url.searchParams.set('pageSize', String(DRIVE_PAGE_SIZE))
    url.searchParams.set(
      'fields',
      'nextPageToken,files(id,name,webViewLink,createdTime,modifiedTime)'
    )
    // Include files from shared/team drives
    url.searchParams.set('supportsAllDrives', 'true')
    url.searchParams.set('includeItemsFromAllDrives', 'true')
    if (pageToken) url.searchParams.set('pageToken', pageToken)

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!res.ok) {
      const errorText = await res.text()
      throw new Error(`Drive search failed: ${errorText}`)
    }

    const data = await res.json()
    allFiles.push(...((data.files ?? []) as DriveFile[]))
    pageToken = data.nextPageToken
  } while (pageToken)

  return allFiles
}

export async function fetchDocContent(
  accessToken: string,
  docId: string
): Promise<string | null> {
  const url = `https://docs.googleapis.com/v1/documents/${docId}`

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Docs API failed: ${errorText}`)
  }

  const doc = await res.json()
  return extractTextFromGoogleDoc(doc)
}

function extractTextFromGoogleDoc(doc: {
  body?: {
    content?: Array<{
      paragraph?: {
        elements?: Array<{
          textRun?: { content?: string }
        }>
      }
    }>
  }
}): string | null {
  if (!doc.body?.content) return null

  const lines: string[] = []

  for (const element of doc.body.content) {
    if (element.paragraph?.elements) {
      const paragraphText = element.paragraph.elements
        .map(e => e.textRun?.content ?? '')
        .join('')
      if (paragraphText.trim()) {
        lines.push(paragraphText)
      }
    }
  }

  const text = lines.join('')
  return text || null
}

// =============================================================================
// Parsing Helpers
// =============================================================================

/**
 * Extract participant names from transcript content.
 * Looks for speaker labels like "[HH:MM] Name:" or "Name:" at line starts.
 */
export function extractParticipantNames(content: string | null): string[] {
  if (!content) return []

  const names = new Set<string>()

  // Pattern: "[HH:MM] Name:" or "[HH:MM AM/PM] Name:"
  const timestampPattern = /\[\d{1,2}:\d{2}(?:\s*(?:AM|PM))?\]\s*([^:]+):/gi
  let match
  while ((match = timestampPattern.exec(content)) !== null) {
    const name = match[1].trim()
    if (name && name.length < 50) {
      names.add(name)
    }
  }

  // Pattern: line starts with "Name:" (common in Gemini Notes)
  if (names.size === 0) {
    const lineStartPattern = /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*:/gm
    while ((match = lineStartPattern.exec(content)) !== null) {
      const name = match[1].trim()
      if (name && name.length < 50) {
        names.add(name)
      }
    }
  }

  return Array.from(names)
}

/**
 * Extract meeting date from document title.
 * Gemini Notes use: "Title - YYYY/MM/DD HH:MM TZ - Notes by Gemini"
 * Falls back to createdTime.
 */
function extractMeetingDate(
  title: string,
  createdTime: string
): string | null {
  // Try to extract date from title
  const datePattern = /(\d{4}\/\d{2}\/\d{2})/
  const dateMatch = title.match(datePattern)

  if (dateMatch) {
    const dateStr = dateMatch[1].replace(/\//g, '-')
    // Try to also extract time
    const timePattern = /(\d{2}:\d{2})/
    const timeMatch = title.match(timePattern)
    const timeStr = timeMatch ? `T${timeMatch[1]}:00` : 'T00:00:00'

    try {
      const date = new Date(`${dateStr}${timeStr}`)
      if (!isNaN(date.getTime())) {
        return date.toISOString()
      }
    } catch {
      // Fall through to createdTime
    }
  }

  // Fall back to createdTime
  return createdTime
}
