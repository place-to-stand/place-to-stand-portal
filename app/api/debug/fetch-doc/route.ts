import { NextRequest, NextResponse } from 'next/server'

import { getCurrentUser } from '@/lib/auth/session'
import { getValidAccessToken } from '@/lib/gmail/client'

/**
 * GET /api/debug/fetch-doc?id=DOC_ID
 * Fetch content from a Google Doc
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const docId = req.nextUrl.searchParams.get('id')
  if (!docId) {
    return NextResponse.json({ error: 'Missing doc id' }, { status: 400 })
  }

  try {
    const { accessToken } = await getValidAccessToken(user.id)

    // Fetch the document content
    const url = `https://docs.googleapis.com/v1/documents/${docId}`

    console.log('[Docs API] Fetching doc:', docId)

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!res.ok) {
      const errorText = await res.text()
      console.error('[Docs API] Error:', errorText)
      return NextResponse.json({ error: errorText }, { status: res.status })
    }

    const doc = await res.json()

    // Extract text content from the document body
    const textContent = extractTextFromDoc(doc)

    return NextResponse.json({
      title: doc.title,
      textContent,
      // Include raw body for debugging (truncated)
      bodyPreview: JSON.stringify(doc.body).substring(0, 2000),
    })
  } catch (error) {
    console.error('[Docs API] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * Extract plain text from a Google Docs document body
 */
function extractTextFromDoc(doc: { body?: { content?: Array<unknown> } }): string {
  if (!doc.body?.content) return ''

  const lines: string[] = []

  for (const element of doc.body.content) {
    const el = element as {
      paragraph?: {
        elements?: Array<{
          textRun?: { content?: string }
        }>
      }
    }

    if (el.paragraph?.elements) {
      const paragraphText = el.paragraph.elements
        .map(e => e.textRun?.content ?? '')
        .join('')
      if (paragraphText.trim()) {
        lines.push(paragraphText)
      }
    }
  }

  return lines.join('')
}
