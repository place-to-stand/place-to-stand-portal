import 'server-only'

import { getValidAccessToken, OAuthReconnectRequiredError } from '@/lib/gmail/client'

// Re-export for consumers
export { OAuthReconnectRequiredError }

// =============================================================================
// Types
// =============================================================================

export interface ConferenceRecord {
  name: string // conferenceRecords/{conferenceRecord}
  startTime: string
  endTime?: string
  expireTime?: string
  space: string // spaces/{space} - the meeting space resource name
}

export interface ConferenceRecordList {
  conferenceRecords: ConferenceRecord[]
  nextPageToken?: string
}

export interface Transcript {
  name: string // conferenceRecords/{conferenceRecord}/transcripts/{transcript}
  state: 'STATE_UNSPECIFIED' | 'STARTED' | 'ENDED'
  startTime?: string
  endTime?: string
  docsDestination?: {
    document: string // Google Docs document resource name
    exportUri: string // URI to download the document
  }
}

export interface TranscriptList {
  transcripts: Transcript[]
  nextPageToken?: string
}

export interface TranscriptEntry {
  name: string // conferenceRecords/{conferenceRecord}/transcripts/{transcript}/entries/{entry}
  participant: string // conferenceRecords/{conferenceRecord}/participants/{participant}
  text: string
  languageCode: string
  startTime: string
  endTime: string
}

export interface TranscriptEntryList {
  transcriptEntries: TranscriptEntry[]
  nextPageToken?: string
}

export interface Participant {
  name: string // conferenceRecords/{conferenceRecord}/participants/{participant}
  earliestStartTime?: string
  latestEndTime?: string
  signedinUser?: {
    user: string
    displayName: string
  }
  anonymousUser?: {
    displayName: string
  }
  phoneUser?: {
    displayName: string
  }
}

export interface ParticipantList {
  participants: Participant[]
  nextPageToken?: string
}

// =============================================================================
// Meet API Functions
// =============================================================================

const MEET_API_BASE = 'https://meet.googleapis.com/v2'

/**
 * List conference records for a specific meeting space.
 * The space name is derived from the conferenceId in the format "spaces/{conferenceId}".
 */
export async function listConferenceRecords(
  userId: string,
  conferenceId: string,
  options?: { connectionId?: string; pageToken?: string }
): Promise<ConferenceRecordList> {
  const { accessToken } = await getValidAccessToken(userId, options?.connectionId)

  const url = new URL(`${MEET_API_BASE}/conferenceRecords`)
  const filter = `space.name="spaces/${conferenceId}"`
  url.searchParams.set('filter', filter)
  if (options?.pageToken) {
    url.searchParams.set('pageToken', options.pageToken)
  }

  console.log(`[Meet API] Request URL: ${url.toString()}`)
  console.log(`[Meet API] Filter: ${filter}`)

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  const responseText = await res.text()
  console.log(`[Meet API] Response status: ${res.status}`)
  console.log(`[Meet API] Response body: ${responseText.substring(0, 500)}`)

  if (!res.ok) {
    throw new Error(`Failed to list conference records: ${responseText}`)
  }

  const data = JSON.parse(responseText)
  return {
    conferenceRecords: data.conferenceRecords ?? [],
    nextPageToken: data.nextPageToken,
  }
}

/**
 * Get a single conference record by name.
 */
export async function getConferenceRecord(
  userId: string,
  conferenceRecordName: string,
  options?: { connectionId?: string }
): Promise<ConferenceRecord> {
  const { accessToken } = await getValidAccessToken(userId, options?.connectionId)

  const res = await fetch(`${MEET_API_BASE}/${conferenceRecordName}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Failed to get conference record: ${errorText}`)
  }

  return res.json()
}

/**
 * List transcripts for a conference record.
 */
export async function listTranscripts(
  userId: string,
  conferenceRecordName: string,
  options?: { connectionId?: string; pageToken?: string }
): Promise<TranscriptList> {
  const { accessToken } = await getValidAccessToken(userId, options?.connectionId)

  const url = new URL(`${MEET_API_BASE}/${conferenceRecordName}/transcripts`)
  if (options?.pageToken) {
    url.searchParams.set('pageToken', options.pageToken)
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    const errorText = await res.text()
    // 404 typically means no transcripts exist
    if (res.status === 404) {
      return { transcripts: [] }
    }
    throw new Error(`Failed to list transcripts: ${errorText}`)
  }

  const data = await res.json()
  return {
    transcripts: data.transcripts ?? [],
    nextPageToken: data.nextPageToken,
  }
}

/**
 * Get a single transcript by name.
 */
export async function getTranscript(
  userId: string,
  transcriptName: string,
  options?: { connectionId?: string }
): Promise<Transcript> {
  const { accessToken } = await getValidAccessToken(userId, options?.connectionId)

  const res = await fetch(`${MEET_API_BASE}/${transcriptName}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Failed to get transcript: ${errorText}`)
  }

  return res.json()
}

/**
 * List transcript entries (the actual text content) for a transcript.
 * Returns entries in chronological order.
 */
export async function listTranscriptEntries(
  userId: string,
  transcriptName: string,
  options?: { connectionId?: string; pageToken?: string; pageSize?: number }
): Promise<TranscriptEntryList> {
  const { accessToken } = await getValidAccessToken(userId, options?.connectionId)

  const url = new URL(`${MEET_API_BASE}/${transcriptName}/entries`)
  url.searchParams.set('pageSize', String(options?.pageSize ?? 100))
  if (options?.pageToken) {
    url.searchParams.set('pageToken', options.pageToken)
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Failed to list transcript entries: ${errorText}`)
  }

  const data = await res.json()
  return {
    transcriptEntries: data.transcriptEntries ?? [],
    nextPageToken: data.nextPageToken,
  }
}

/**
 * Fetch all transcript entries for a transcript, handling pagination.
 */
export async function fetchAllTranscriptEntries(
  userId: string,
  transcriptName: string,
  options?: { connectionId?: string }
): Promise<TranscriptEntry[]> {
  const allEntries: TranscriptEntry[] = []
  let pageToken: string | undefined

  do {
    const result = await listTranscriptEntries(userId, transcriptName, {
      connectionId: options?.connectionId,
      pageToken,
      pageSize: 100,
    })
    allEntries.push(...result.transcriptEntries)
    pageToken = result.nextPageToken
  } while (pageToken)

  return allEntries
}

/**
 * List participants for a conference record.
 */
export async function listParticipants(
  userId: string,
  conferenceRecordName: string,
  options?: { connectionId?: string; pageToken?: string }
): Promise<ParticipantList> {
  const { accessToken } = await getValidAccessToken(userId, options?.connectionId)

  const url = new URL(`${MEET_API_BASE}/${conferenceRecordName}/participants`)
  if (options?.pageToken) {
    url.searchParams.set('pageToken', options.pageToken)
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Failed to list participants: ${errorText}`)
  }

  const data = await res.json()
  return {
    participants: data.participants ?? [],
    nextPageToken: data.nextPageToken,
  }
}

/**
 * Format transcript entries into readable text.
 * Groups consecutive entries by speaker and formats with timestamps.
 */
export function formatTranscriptText(
  entries: TranscriptEntry[],
  participants: Map<string, string> // participant name -> display name
): string {
  if (entries.length === 0) {
    return ''
  }

  const lines: string[] = []
  let currentSpeaker = ''
  let currentText = ''

  for (const entry of entries) {
    const speakerName = participants.get(entry.participant) ?? 'Unknown'
    const timestamp = new Date(entry.startTime).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    })

    if (speakerName !== currentSpeaker) {
      // New speaker - push current text and start new block
      if (currentText) {
        lines.push(currentText.trim())
        lines.push('')
      }
      currentSpeaker = speakerName
      currentText = `[${timestamp}] ${speakerName}:\n${entry.text}`
    } else {
      // Same speaker - append to current text
      currentText += ` ${entry.text}`
    }
  }

  // Push final block
  if (currentText) {
    lines.push(currentText.trim())
  }

  return lines.join('\n')
}

/**
 * Fetch and format the full transcript for a meeting.
 * Returns null if no transcript is available.
 */
export async function fetchFormattedTranscript(
  userId: string,
  conferenceId: string,
  options?: { connectionId?: string }
): Promise<{ text: string; conferenceRecordId: string; transcriptId: string } | null> {
  console.log(`[Meet API] Fetching transcript for conferenceId: ${conferenceId}`)

  // 1. Find conference records for this meeting space
  const conferenceRecords = await listConferenceRecords(userId, conferenceId, options)
  console.log(`[Meet API] Found ${conferenceRecords.conferenceRecords.length} conference records`)

  if (conferenceRecords.conferenceRecords.length === 0) {
    console.log('[Meet API] No conference records found - meeting may not have started yet')
    return null
  }

  // Use the most recent conference record (in case of recurring meetings)
  const conferenceRecord = conferenceRecords.conferenceRecords[0]
  const conferenceRecordName = conferenceRecord.name

  // 2. List transcripts for this conference
  const transcriptsResult = await listTranscripts(userId, conferenceRecordName, options)
  console.log(`[Meet API] Found ${transcriptsResult.transcripts.length} transcripts`)

  if (transcriptsResult.transcripts.length === 0) {
    console.log('[Meet API] No transcripts found - transcript may not have been enabled')
    return null
  }

  // Use the first transcript (typically there's only one)
  const transcript = transcriptsResult.transcripts[0]
  console.log(`[Meet API] Transcript state: ${transcript.state}`)

  // Check if transcript is complete
  if (transcript.state !== 'ENDED') {
    console.log('[Meet API] Transcript still processing, state:', transcript.state)
    return null // Transcript still processing
  }

  // 3. Fetch transcript entries
  const entries = await fetchAllTranscriptEntries(userId, transcript.name, options)
  console.log(`[Meet API] Found ${entries.length} transcript entries`)

  if (entries.length === 0) {
    console.log('[Meet API] No transcript entries found')
    return null
  }

  // 4. Fetch participants to map IDs to names
  const participantsResult = await listParticipants(userId, conferenceRecordName, options)
  const participantMap = new Map<string, string>()

  for (const p of participantsResult.participants) {
    const displayName =
      p.signedinUser?.displayName ??
      p.anonymousUser?.displayName ??
      p.phoneUser?.displayName ??
      'Unknown'
    participantMap.set(p.name, displayName)
  }

  // 5. Format the transcript
  const text = formatTranscriptText(entries, participantMap)
  console.log(`[Meet API] Formatted transcript: ${text.length} chars`)

  // Extract IDs from resource names
  const conferenceRecordId = conferenceRecordName.replace('conferenceRecords/', '')
  const transcriptId = transcript.name.split('/transcripts/')[1]

  console.log(`[Meet API] Successfully fetched transcript for conference ${conferenceRecordId}`)

  return {
    text,
    conferenceRecordId,
    transcriptId,
  }
}

// =============================================================================
// Gemini Notes (via Google Drive/Docs)
// =============================================================================

/**
 * Search Google Drive for Gemini meeting notes.
 * Gemini creates documents with titles like "Meeting Title - YYYY/MM/DD HH:MM TZ - Notes by Gemini"
 */
export async function searchGeminiNotes(
  userId: string,
  meetingTitle: string,
  meetingDate: Date,
  options?: { connectionId?: string }
): Promise<{ id: string; name: string; webViewLink: string } | null> {
  const { accessToken } = await getValidAccessToken(userId, options?.connectionId)

  // Format date for search - Gemini uses YYYY/MM/DD format
  const year = meetingDate.getFullYear()
  const month = String(meetingDate.getMonth() + 1).padStart(2, '0')
  const day = String(meetingDate.getDate()).padStart(2, '0')
  const dateStr = `${year}/${month}/${day}`

  // Search for docs matching the meeting title and "Notes by Gemini"
  // Use a broad search then filter results
  const searchTitle = meetingTitle.split(' ').slice(0, 3).join(' ') // First 3 words
  const driveQuery = `name contains '${searchTitle}' and name contains 'Notes by Gemini' and mimeType='application/vnd.google-apps.document'`

  console.log(`[Gemini Notes] Searching Drive with query: ${driveQuery}`)

  const url = new URL('https://www.googleapis.com/drive/v3/files')
  url.searchParams.set('q', driveQuery)
  url.searchParams.set('orderBy', 'modifiedTime desc')
  url.searchParams.set('pageSize', '10')
  url.searchParams.set('fields', 'files(id,name,webViewLink,createdTime)')

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    const errorText = await res.text()
    console.error('[Gemini Notes] Drive search error:', errorText)
    return null
  }

  const data = await res.json()
  const files = data.files as Array<{ id: string; name: string; webViewLink: string; createdTime: string }>

  console.log(`[Gemini Notes] Found ${files.length} potential matches`)

  // Find the best match - should contain the date
  const match = files.find(f => f.name.includes(dateStr))

  if (match) {
    console.log(`[Gemini Notes] Found matching doc: ${match.name}`)
    return match
  }

  // If no exact date match, return the most recent one that was created around the meeting time
  if (files.length > 0) {
    const meetingTime = meetingDate.getTime()
    const closest = files.find(f => {
      const docTime = new Date(f.createdTime).getTime()
      const hoursDiff = Math.abs(docTime - meetingTime) / (1000 * 60 * 60)
      return hoursDiff < 24 // Within 24 hours
    })

    if (closest) {
      console.log(`[Gemini Notes] Found close match: ${closest.name}`)
      return closest
    }
  }

  console.log('[Gemini Notes] No matching document found')
  return null
}

/**
 * Fetch content from a Google Doc (Gemini notes)
 */
export async function fetchGeminiNotesContent(
  userId: string,
  docId: string,
  options?: { connectionId?: string }
): Promise<string | null> {
  const { accessToken } = await getValidAccessToken(userId, options?.connectionId)

  const url = `https://docs.googleapis.com/v1/documents/${docId}`

  console.log(`[Gemini Notes] Fetching doc: ${docId}`)

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    const errorText = await res.text()
    console.error('[Gemini Notes] Docs API error:', errorText)
    return null
  }

  const doc = await res.json()
  const text = extractTextFromGoogleDoc(doc)

  console.log(`[Gemini Notes] Extracted ${text.length} chars from doc`)

  return text
}

/**
 * Extract plain text from a Google Docs document body
 */
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
}): string {
  if (!doc.body?.content) return ''

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

  return lines.join('')
}

/**
 * Fetch Gemini notes for a meeting (search Drive and get content)
 */
export async function fetchGeminiMeetingNotes(
  userId: string,
  meetingTitle: string,
  meetingDate: Date,
  options?: { connectionId?: string }
): Promise<{ text: string; docId: string; docUrl: string } | null> {
  // Search for the notes document
  const doc = await searchGeminiNotes(userId, meetingTitle, meetingDate, options)

  if (!doc) {
    return null
  }

  // Fetch the content
  const text = await fetchGeminiNotesContent(userId, doc.id, options)

  if (!text) {
    return null
  }

  return {
    text,
    docId: doc.id,
    docUrl: doc.webViewLink,
  }
}
