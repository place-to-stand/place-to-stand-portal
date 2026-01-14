/** Gmail message header */
interface GmailHeader {
  name?: string | null
  value?: string | null
}

/** Gmail message payload */
interface GmailMessagePayload {
  headers?: GmailHeader[] | null
}

/** Gmail message (minimal interface for threading extraction) */
interface GmailMessage {
  threadId?: string | null
  payload?: GmailMessagePayload | null
}

export interface ThreadingHeaders {
  gmailThreadId: string | undefined
  inReplyTo: string | undefined
  references: string[] | undefined
}

/**
 * Extract threading headers from a Gmail message for proper reply threading.
 * Returns threadId, In-Reply-To, and References headers.
 */
export function extractThreadingHeaders(message: GmailMessage): ThreadingHeaders {
  const headers = message.payload?.headers || []

  // Get the Gmail thread ID
  const gmailThreadId = message.threadId || undefined

  // Extract Message-ID header for In-Reply-To
  const messageIdHeader = headers.find(
    (h: GmailHeader) => h.name?.toLowerCase() === 'message-id'
  )
  const inReplyTo = messageIdHeader?.value || undefined

  // Build References array
  let references: string[] | undefined

  if (inReplyTo) {
    references = [inReplyTo]
  }

  // Include existing References if present
  const referencesHeader = headers.find(
    (h: GmailHeader) => h.name?.toLowerCase() === 'references'
  )
  if (referencesHeader?.value) {
    const existingRefs = referencesHeader.value.split(/\s+/).filter(Boolean)
    references = [...existingRefs, ...(references || [])]
  }

  return {
    gmailThreadId,
    inReplyTo,
    references,
  }
}
