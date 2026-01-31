import { NextRequest, NextResponse } from 'next/server'

import { getCurrentUser } from '@/lib/auth/session'
import { getValidAccessToken } from '@/lib/gmail/client'

/**
 * GET /api/debug/search-drive?q=Meeting
 * Search Google Drive for documents matching a query
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const searchQuery = req.nextUrl.searchParams.get('q') || 'Meeting'

  try {
    const { accessToken } = await getValidAccessToken(user.id)

    // Search for docs with "Meeting" in the name, sorted by modified time
    const driveQuery = `name contains '${searchQuery}' and mimeType='application/vnd.google-apps.document'`
    const url = new URL('https://www.googleapis.com/drive/v3/files')
    url.searchParams.set('q', driveQuery)
    url.searchParams.set('orderBy', 'modifiedTime desc')
    url.searchParams.set('pageSize', '10')
    url.searchParams.set('fields', 'files(id,name,mimeType,createdTime,modifiedTime,webViewLink)')

    console.log('[Drive Search] Query:', driveQuery)

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!res.ok) {
      const errorText = await res.text()
      console.error('[Drive Search] Error:', errorText)
      return NextResponse.json({ error: errorText }, { status: res.status })
    }

    const data = await res.json()
    console.log('[Drive Search] Found', data.files?.length ?? 0, 'files')

    return NextResponse.json({
      query: driveQuery,
      files: data.files ?? [],
    })
  } catch (error) {
    console.error('[Drive Search] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
