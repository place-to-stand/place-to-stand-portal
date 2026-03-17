import { NextResponse } from 'next/server'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { fetchProposalById } from '@/lib/queries/proposals'
import { generateCompletionCertificate } from '@/lib/proposals/certificate'
import { downloadExecutedPdf } from '@/lib/storage/proposal-documents'
import { ForbiddenError, UnauthorizedError } from '@/lib/errors/http'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser()
    assertAdmin(user)

    const { id } = await params

    const proposal = await fetchProposalById(id)
    if (!proposal) {
      return NextResponse.json({ ok: false, error: 'Proposal not found' }, { status: 404 })
    }

    if (!proposal.countersignedAt) {
      return NextResponse.json(
        { ok: false, error: 'Proposal is not fully executed' },
        { status: 400 }
      )
    }

    const sanitizedTitle = proposal.title.replace(/[^a-zA-Z0-9-_ ]/g, '').trim().replace(/\s+/g, '-')

    // Prefer stored full PDF; fall back to certificate-only for legacy proposals
    let pdf: Buffer | null = null
    if (proposal.executedPdfPath) {
      pdf = await downloadExecutedPdf(proposal.executedPdfPath)
    }

    if (pdf) {
      return new NextResponse(new Uint8Array(pdf), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${sanitizedTitle}.pdf"`,
        },
      })
    }

    // Fallback: generate certificate-only PDF
    const certPdf = await generateCompletionCertificate(proposal)
    return new NextResponse(new Uint8Array(certPdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="certificate-${sanitizedTitle}.pdf"`,
      },
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
    }
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 })
  }
}
