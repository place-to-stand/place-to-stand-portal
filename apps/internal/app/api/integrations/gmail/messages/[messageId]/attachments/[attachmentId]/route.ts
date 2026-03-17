import { NextResponse, type NextRequest } from 'next/server'
import { requireUser } from '@/lib/auth/session'
import { getAttachment } from '@/lib/gmail/client'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ messageId: string; attachmentId: string }> }
) {
  const user = await requireUser()
  const { messageId, attachmentId } = await params

  try {
    const content = await getAttachment(user.id, messageId, attachmentId)

    // Return the binary content (convert Buffer to Uint8Array for NextResponse compatibility)
    return new NextResponse(new Uint8Array(content), {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (err) {
    console.error('Gmail attachment fetch error:', err)
    return NextResponse.json(
      { error: 'Failed to fetch attachment' },
      { status: 500 }
    )
  }
}
