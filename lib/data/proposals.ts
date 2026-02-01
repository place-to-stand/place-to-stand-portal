import 'server-only'

import { cache } from 'react'
import { createHash, randomBytes } from 'crypto'
import { hash, compare } from 'bcryptjs'

import {
  fetchProposalById,
  fetchProposalByShareToken,
  fetchProposalByCountersignToken,
  fetchAllProposals,
  updateProposal,
  recordProposalView,
  recordProposalResponse,
  recordCountersignature,
  type Proposal,
  type ProposalStatus,
  type ProposalWithRelations,
  type SignatureData,
  type CountersignatureData,
} from '@/lib/queries/proposals'

// =============================================================================
// Token generation
// =============================================================================

function generateShareToken(): string {
  return crypto.randomUUID().replace(/-/g, '')
}

function generateCountersignToken(): string {
  return randomBytes(32).toString('hex')
}

// =============================================================================
// Sharing management (admin-facing)
// =============================================================================

export async function enableProposalSharing(
  proposalId: string,
  password?: string | null
): Promise<{ shareToken: string } | null> {
  const proposal = await fetchProposalById(proposalId)
  if (!proposal) return null

  const shareToken = proposal.shareToken ?? generateShareToken()
  const sharePasswordHash = password ? await hash(password, 10) : proposal.sharePasswordHash ?? null

  await updateProposal(proposalId, {
    shareToken,
    sharePasswordHash,
    shareEnabled: true,
  })

  return { shareToken }
}

export async function disableProposalSharing(
  proposalId: string
): Promise<boolean> {
  const result = await updateProposal(proposalId, { shareEnabled: false })
  return result !== null
}

export async function updateSharePassword(
  proposalId: string,
  password: string | null
): Promise<boolean> {
  const passwordHash = password ? await hash(password, 10) : null
  const result = await updateProposal(proposalId, {
    sharePasswordHash: passwordHash,
  })
  return result !== null
}

// =============================================================================
// Public access (unauthenticated)
// =============================================================================

export async function verifySharePassword(
  token: string,
  password?: string
): Promise<{ ok: true; proposal: Proposal } | { ok: false; needsPassword: boolean }> {
  const proposal = await fetchProposalByShareToken(token)
  if (!proposal) return { ok: false, needsPassword: false }

  if (proposal.sharePasswordHash) {
    if (!password) return { ok: false, needsPassword: true }
    const valid = await compare(password, proposal.sharePasswordHash)
    if (!valid) return { ok: false, needsPassword: true }
  }

  return { ok: true, proposal }
}

export async function viewSharedProposal(token: string): Promise<Proposal | null> {
  const proposal = await fetchProposalByShareToken(token)
  if (!proposal) return null

  const previousCount = await recordProposalView(proposal.id)

  // Send "first viewed" notification to creator
  if (previousCount === 0) {
    sendViewedNotification(proposal).catch(err => {
      console.error('[proposals] Failed to send viewed notification:', err)
    })
  }

  return proposal
}

/**
 * Record a client response (accept/reject) on a shared proposal.
 * On acceptance: computes content hash, generates countersign token,
 * and triggers countersign email (fire-and-forget).
 */
export async function respondToProposal(
  token: string,
  action: 'ACCEPTED' | 'REJECTED',
  comment?: string | null,
  signature?: SignatureData | null
): Promise<Proposal | null> {
  const proposal = await fetchProposalByShareToken(token)
  if (!proposal) return null

  // Don't allow changing a response once set
  if (proposal.acceptedAt || proposal.rejectedAt) return null

  const updated = await recordProposalResponse(proposal.id, action, comment, signature)
  if (!updated) return null

  // On acceptance: compute content hash and generate countersign token
  if (action === 'ACCEPTED') {
    const contentHash = createHash('sha256')
      .update(JSON.stringify(proposal.content))
      .digest('hex')
    const countersignToken = generateCountersignToken()

    await updateProposal(proposal.id, {
      contentHashAtSigning: contentHash,
      countersignToken,
    })

    // Fire-and-forget: send countersign email to creator
    sendCountersignNotification(proposal.id, countersignToken).catch(err => {
      console.error('[proposals] Failed to send countersign notification:', err)
    })
  }

  return updated
}

// =============================================================================
// Countersign flow
// =============================================================================

/**
 * Countersign a proposal. Validates that it's accepted and not already countersigned.
 */
export async function countersignProposal(
  token: string,
  data: CountersignatureData
): Promise<Proposal | null> {
  const proposal = await fetchProposalByCountersignToken(token)
  if (!proposal) return null

  // Must be accepted and not already countersigned
  if (proposal.status !== 'ACCEPTED' || proposal.countersignedAt) return null

  const updated = await recordCountersignature(proposal.id, data)
  if (!updated) return null

  // Fire-and-forget: generate full PDF, store it, and send completion notifications
  generateAndSendExecutedProposal(updated).catch(err => {
    console.error('[proposals] Failed to generate/send executed proposal:', err)
  })

  return updated
}

/**
 * Send countersign email notification to the proposal creator (self-send via Gmail).
 */
async function sendCountersignNotification(
  proposalId: string,
  countersignToken: string
): Promise<void> {
  // Dynamic imports to avoid circular dependencies and keep this module lean
  const { getDefaultGoogleConnectionId, sendEmail } = await import('@/lib/gmail/client')
  const { serverEnv } = await import('@/lib/env.server')

  const proposal = await fetchProposalById(proposalId)
  if (!proposal) return

  const connectionId = await getDefaultGoogleConnectionId(proposal.createdBy)
  if (!connectionId) {
    console.warn('[proposals] No Gmail connection for creator, skipping countersign email')
    return
  }

  const baseUrl = serverEnv.APP_BASE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? ''
  const countersignUrl = `${baseUrl}/p/${countersignToken}/countersign`

  const subject = `Action Required: Countersign "${proposal.title}"`
  const bodyHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px;">
      <h2 style="color: #111; margin-bottom: 8px;">Proposal Signed by Client</h2>
      <p style="color: #555; font-size: 14px; line-height: 1.6;">
        <strong>${proposal.signerName ?? 'The client'}</strong> has accepted and signed
        <strong>"${proposal.title}"</strong>.
      </p>
      ${proposal.signatureData ? `
        <div style="margin: 16px 0; padding: 12px; border: 1px solid #e5e7eb; border-radius: 6px; background: #fff; display: inline-block;">
          <img src="${proposal.signatureData}" alt="Client signature" style="height: 48px; width: auto;" />
        </div>
      ` : ''}
      <p style="color: #555; font-size: 14px; line-height: 1.6;">
        Please review and add your countersignature to complete this agreement.
      </p>
      <a href="${countersignUrl}" style="display: inline-block; margin-top: 12px; padding: 10px 24px; background: #111; color: #fff; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 500;">
        Countersign Now
      </a>
      <p style="color: #999; font-size: 12px; margin-top: 24px;">
        Or copy this link: ${countersignUrl}
      </p>
    </div>
  `

  // Look up the provider email for self-send
  const { db } = await import('@/lib/db')
  const { oauthConnections } = await import('@/lib/db/schema')
  const { eq } = await import('drizzle-orm')
  const [conn] = await db
    .select({ providerEmail: oauthConnections.providerEmail })
    .from(oauthConnections)
    .where(eq(oauthConnections.id, connectionId))
    .limit(1)

  if (!conn?.providerEmail) {
    console.warn('[proposals] No provider email found for connection, skipping countersign email')
    return
  }

  await sendEmail(proposal.createdBy, {
    to: [conn.providerEmail],
    subject,
    bodyHtml,
  }, { connectionId })
}

// =============================================================================
// Executed PDF generation
// =============================================================================

async function generateAndSendExecutedProposal(proposal: Proposal): Promise<void> {
  const { generateFullProposalPdf } = await import('@/lib/proposals/full-pdf')
  const { uploadExecutedPdf } = await import('@/lib/storage/proposal-documents')

  // Generate the full proposal PDF (content + dual-party signatures)
  const pdfBuffer = await generateFullProposalPdf(proposal)

  // Store in Supabase Storage (non-blocking for email)
  uploadExecutedPdf(proposal.id, pdfBuffer)
    .then(storagePath => updateProposal(proposal.id, { executedPdfPath: storagePath }))
    .catch(err => console.error('[proposals] Failed to store executed PDF:', err))

  // Send completion emails with the full PDF attached
  await sendCompletionNotifications(proposal, pdfBuffer)
}

// =============================================================================
// Notifications
// =============================================================================

/**
 * Notify creator that their proposal was viewed for the first time.
 */
async function sendViewedNotification(proposal: Proposal): Promise<void> {
  const { getDefaultGoogleConnectionId, sendEmail } = await import('@/lib/gmail/client')
  const { db } = await import('@/lib/db')
  const { oauthConnections } = await import('@/lib/db/schema')
  const { eq } = await import('drizzle-orm')

  const connectionId = await getDefaultGoogleConnectionId(proposal.createdBy)
  if (!connectionId) return

  const [conn] = await db
    .select({ providerEmail: oauthConnections.providerEmail })
    .from(oauthConnections)
    .where(eq(oauthConnections.id, connectionId))
    .limit(1)

  if (!conn?.providerEmail) return

  const subject = `"${proposal.title}" was just viewed`
  const bodyHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px;">
      <h2 style="color: #111; margin-bottom: 8px;">Proposal Viewed</h2>
      <p style="color: #555; font-size: 14px; line-height: 1.6;">
        Your proposal <strong>"${proposal.title}"</strong> was just viewed by the recipient for the first time.
      </p>
    </div>
  `

  await sendEmail(proposal.createdBy, {
    to: [conn.providerEmail],
    subject,
    bodyHtml,
  }, { connectionId })
}

/**
 * Send completion notifications after both parties have signed.
 * - Self-send to creator via Gmail
 * - Send to client via Resend (if sentToEmail exists)
 */
async function sendCompletionNotifications(proposal: Proposal, pdfBuffer: Buffer): Promise<void> {
  const { getDefaultGoogleConnectionId, sendEmail } = await import('@/lib/gmail/client')
  const { getResendClient } = await import('@/lib/email/resend')
  const { db } = await import('@/lib/db')
  const { oauthConnections } = await import('@/lib/db/schema')
  const { eq } = await import('drizzle-orm')

  const { serverEnv } = await import('@/lib/env.server')
  const baseUrl = serverEnv.APP_BASE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? ''
  const viewUrl = proposal.shareToken ? `${baseUrl}/p/${proposal.shareToken}` : null

  const subject = `Proposal Fully Executed: "${proposal.title}"`
  const bodyHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px;">
      <h2 style="color: #111; margin-bottom: 8px;">Proposal Complete</h2>
      <p style="color: #555; font-size: 14px; line-height: 1.6;">
        <strong>"${proposal.title}"</strong> has been fully executed. Both parties have signed.
      </p>
      <div style="margin: 16px 0; padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px;">
        <p style="margin: 0 0 8px; font-size: 13px; color: #666;">
          <strong>Client:</strong> ${proposal.signerName ?? 'N/A'} ${proposal.signerEmail ? `(${proposal.signerEmail})` : ''}
          <br/>Signed: ${proposal.acceptedAt ? new Date(proposal.acceptedAt).toLocaleString() : 'N/A'}
        </p>
        <p style="margin: 0; font-size: 13px; color: #666;">
          <strong>Countersigner:</strong> ${proposal.countersignerName ?? 'N/A'} ${proposal.countersignerEmail ? `(${proposal.countersignerEmail})` : ''}
          <br/>Signed: ${proposal.countersignedAt ? new Date(proposal.countersignedAt).toLocaleString() : 'N/A'}
        </p>
      </div>
      ${viewUrl ? `
      <a href="${viewUrl}" style="display: inline-block; margin-top: 12px; padding: 10px 24px; background: #111; color: #fff; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 500;">
        View Executed Proposal
      </a>
      <p style="color: #999; font-size: 12px; margin-top: 12px;">
        Or copy this link: ${viewUrl}
      </p>
      ` : ''}
    </div>
  `

  // 1. Self-send to creator via Gmail
  try {
    const connectionId = await getDefaultGoogleConnectionId(proposal.createdBy)
    if (connectionId) {
      const [conn] = await db
        .select({ providerEmail: oauthConnections.providerEmail })
        .from(oauthConnections)
        .where(eq(oauthConnections.id, connectionId))
        .limit(1)

      if (conn?.providerEmail) {
        await sendEmail(proposal.createdBy, {
          to: [conn.providerEmail],
          subject,
          bodyHtml,
          attachments: [{
            filename: `${proposal.title.replace(/[^a-zA-Z0-9-_ ]/g, '').trim().replace(/\s+/g, '-')}.pdf`,
            mimeType: 'application/pdf',
            content: pdfBuffer,
          }],
        }, { connectionId })
      }
    }
  } catch (err) {
    console.error('[proposals] Failed to send completion email to creator:', err)
  }

  // 2. Send to client via Resend
  const clientEmail = proposal.sentToEmail ?? proposal.signerEmail
  if (clientEmail) {
    try {
      const { serverEnv: env } = await import('@/lib/env.server')
      const resend = getResendClient()
      await resend.emails.send({
        from: `Place To Stand <${env.RESEND_FROM_EMAIL}>`,
        to: clientEmail,
        subject,
        html: bodyHtml,
        attachments: [{
          filename: `${proposal.title.replace(/[^a-zA-Z0-9-_ ]/g, '').trim().replace(/\s+/g, '-')}.pdf`,
          content: pdfBuffer,
        }],
      })
    } catch (err) {
      console.error('[proposals] Failed to send completion email to client:', err)
    }
  }
}

// =============================================================================
// Dashboard data
// =============================================================================

export const fetchProposalsDashboard = cache(
  async (statusFilter?: ProposalStatus[]) => {
    return fetchAllProposals(statusFilter)
  }
)

export type { Proposal, ProposalStatus, ProposalWithRelations }
