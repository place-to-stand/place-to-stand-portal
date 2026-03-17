import 'server-only'

import { readFile } from 'fs/promises'
import { join } from 'path'
import { jsPDF } from 'jspdf'
import type { Proposal } from '@/lib/queries/proposals'
import type { ProposalContent } from './types'
import {
  VENDOR_INFO,
  SCOPE_OF_WORK_INTRO,
  RISKS_INTRO,
  FULL_TERMS_AND_CONDITIONS,
  DEFAULT_RISKS,
} from './constants'

/**
 * Generate a full proposal PDF including content and dual-party signature block.
 * Mirrors the ProposalDocument layout rendered in the web viewer.
 */
export async function generateFullProposalPdf(
  proposal: Proposal
): Promise<Buffer> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 20
  const contentWidth = pageWidth - margin * 2
  let y = margin

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function ensureSpace(needed: number) {
    if (y + needed > pageHeight - 15) {
      doc.addPage()
      y = margin
    }
  }

  function addText(
    text: string,
    size: number,
    style: 'normal' | 'bold' = 'normal',
    x = margin
  ) {
    doc.setFontSize(size)
    doc.setFont('helvetica', style)
    doc.setTextColor(0, 0, 0)
    const lines = doc.splitTextToSize(text, contentWidth - (x - margin))
    ensureSpace(lines.length * size * 0.45)
    doc.text(lines, x, y)
    y += lines.length * size * 0.45
  }

  function addWrappedText(
    text: string,
    size: number,
    style: 'normal' | 'bold' = 'normal',
    color: [number, number, number] = [100, 100, 100]
  ) {
    doc.setFontSize(size)
    doc.setFont('helvetica', style)
    doc.setTextColor(...color)
    const lines = doc.splitTextToSize(text, contentWidth)
    ensureSpace(lines.length * size * 0.4)
    doc.text(lines, margin, y)
    y += lines.length * size * 0.4
  }

  function addLine() {
    ensureSpace(4)
    doc.setDrawColor(200, 200, 200)
    doc.line(margin, y, pageWidth - margin, y)
    y += 4
  }

  function addSpacer(mm: number) {
    y += mm
  }

  function addSectionTitle(title: string) {
    ensureSpace(14)
    addSpacer(4)
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0, 0, 0)
    doc.text(title, margin, y)
    y += 7
  }

  // ---------------------------------------------------------------------------
  // Content
  // ---------------------------------------------------------------------------

  const content = proposal.content as ProposalContent | Record<string, never>
  const hasContent = content && 'client' in content && 'phases' in content

  if (!hasContent) {
    // Fallback: just title + signatures
    addText(proposal.title, 18, 'bold')
    addSpacer(6)
    addText('This proposal does not have structured content.', 10)
  } else {
    const pc = content as ProposalContent
    const validUntil = proposal.expirationDate ?? pc.proposalValidUntil

    // Logo — centered, prominent
    try {
      const logoPath = join(process.cwd(), 'public', 'pts-logo-black-transparent.png')
      const logoBuffer = await readFile(logoPath)
      const logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`
      // Original image is 1353×138 (~9.8:1 ratio). Render at 80mm wide × ~8mm tall, centered.
      const logoWidth = 80
      const logoHeight = 8
      const logoX = (pageWidth - logoWidth) / 2
      doc.addImage(logoBase64, 'PNG', logoX, y, logoWidth, logoHeight)
      y += logoHeight + 8
    } catch {
      // If logo can't be loaded, skip it silently
    }

    // Header
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0, 0, 0)
    doc.text(proposal.title, margin, y)
    y += 10

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 100)
    doc.text(`Prepared for: ${pc.client.companyName}`, margin, y)
    y += 4
    doc.text(
      `Contact: ${pc.client.contactName} (${pc.client.contactEmail})`,
      margin,
      y
    )
    y += 4
    if (validUntil) {
      doc.text(
        `Valid until: ${new Date(validUntil).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
        margin,
        y
      )
      y += 4
    }
    doc.text(
      `From: ${VENDOR_INFO.name} \u00b7 ${VENDOR_INFO.email} \u00b7 ${VENDOR_INFO.phone}`,
      margin,
      y
    )
    y += 6
    addLine()

    // Project Overview
    addSectionTitle('Project Overview')
    addWrappedText(pc.projectOverviewText, 10)

    // Scope of Work
    addSectionTitle('Scope of Work')
    addWrappedText(SCOPE_OF_WORK_INTRO, 9)
    addSpacer(3)

    for (const phase of pc.phases) {
      ensureSpace(20)
      addText(`Phase ${phase.index}: ${phase.title}`, 11, 'bold')
      addWrappedText(phase.purpose, 9)
      if (phase.deliverables.length > 0) {
        addSpacer(1)
        for (const d of phase.deliverables) {
          ensureSpace(6)
          doc.setFontSize(9)
          doc.setFont('helvetica', 'normal')
          doc.setTextColor(100, 100, 100)
          const lines = doc.splitTextToSize(`\u2022 ${d}`, contentWidth - 4)
          doc.text(lines, margin + 4, y)
          y += lines.length * 3.6
        }
      }
      addSpacer(3)
    }

    // Risks
    const risks =
      pc.risks && pc.risks.length > 0 ? pc.risks : DEFAULT_RISKS
    addSectionTitle('Risks & Considerations')
    addWrappedText(RISKS_INTRO, 9)
    addSpacer(2)
    for (const risk of risks) {
      ensureSpace(12)
      addText(risk.title, 10, 'bold')
      addWrappedText(risk.description, 9)
      addSpacer(2)
    }

    // Rates
    addSectionTitle('Rates & Engagement')
    addText(`Hourly Rate: $${pc.rates.hourlyRate}/hr`, 10)
    addText(`Initial Commitment: ${pc.rates.initialCommitmentDescription}`, 10)
    addText(`Estimated Scoping Hours: ${pc.rates.estimatedScopingHours}`, 10)
    if (pc.kickoffDays) {
      addText(
        `Kickoff Timeline: Within ${pc.kickoffDays} business days of acceptance`,
        10
      )
    }

    // Terms — match web viewer logic: only show if termsContent or includeFullTerms
    const shouldShowTerms = pc.termsContent?.length || pc.includeFullTerms !== false
    if (shouldShowTerms) {
      const termsToShow = pc.termsContent?.length ? pc.termsContent : FULL_TERMS_AND_CONDITIONS
      addSectionTitle('Terms & Conditions')
      for (let i = 0; i < termsToShow.length; i++) {
        const section = termsToShow[i]
        ensureSpace(14)
        addText(`${i + 1}. ${section.title}`, 10, 'bold')
        addWrappedText(section.content, 9)
        addSpacer(2)
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Signature Block
  // ---------------------------------------------------------------------------

  addSpacer(4)
  addLine()
  addSectionTitle('Signatures')

  const sigBlockY = y
  const halfWidth = contentWidth / 2 - 2

  function drawSignaturePanel(
    x: number,
    width: number,
    label: string,
    name: string | null | undefined,
    email: string | null | undefined,
    signatureDataUrl: string | null | undefined,
    signedAt: string | null | undefined
  ) {
    const startY = sigBlockY
    let py = startY

    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(100, 100, 100)
    doc.text(label.toUpperCase(), x, py)
    py += 5

    // Signature image or placeholder
    if (signatureDataUrl?.startsWith('data:image/png')) {
      try {
        doc.addImage(signatureDataUrl, 'PNG', x, py, 50, 16)
        py += 18
      } catch {
        doc.setFontSize(9)
        doc.setFont('helvetica', 'italic')
        doc.text('[Signature image unavailable]', x, py + 4)
        py += 8
      }
    } else {
      doc.setFontSize(9)
      doc.setFont('helvetica', 'italic')
      doc.setTextColor(150, 150, 150)
      doc.text(signedAt ? '[Signed electronically]' : 'Awaiting signature', x, py + 4)
      py += 8
    }

    // Line under signature
    doc.setDrawColor(180, 180, 180)
    doc.line(x, py, x + width, py)
    py += 4

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(60, 60, 60)
    doc.text(`Name: ${name ?? '\u2014'}`, x, py)
    py += 4
    doc.text(`Email: ${email ?? '\u2014'}`, x, py)
    py += 4
    if (signedAt) {
      doc.text(
        `Date: ${new Date(signedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
        x,
        py
      )
    } else {
      doc.text('Date: \u2014', x, py)
    }
    py += 4

    return py
  }

  ensureSpace(50)
  // Re-capture y after ensureSpace may have added a page
  const blockStartY = y
  // We need both panels to start at the same y — reassign sigBlockY via closure workaround
  const panelLeftEnd = drawSignaturePanel(
    margin,
    halfWidth,
    'Client',
    proposal.signerName,
    proposal.signerEmail,
    proposal.signatureData,
    proposal.acceptedAt
  )
  // Temporarily reset y for right panel
  const savedY = y
  y = blockStartY
  const panelRightEnd = drawSignaturePanel(
    margin + halfWidth + 4,
    halfWidth,
    'Place To Stand',
    proposal.countersignerName,
    proposal.countersignerEmail,
    proposal.countersignatureData,
    proposal.countersignedAt
  )
  y = Math.max(panelLeftEnd, panelRightEnd, savedY)

  // ---------------------------------------------------------------------------
  // Footer
  // ---------------------------------------------------------------------------

  addSpacer(6)
  addLine()
  addSpacer(2)

  if (proposal.contentHashAtSigning) {
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(150, 150, 150)
    doc.text(`Content Hash (SHA-256): ${proposal.contentHashAtSigning}`, margin, y)
    y += 3
  }

  doc.setFontSize(7)
  doc.setTextColor(150, 150, 150)
  doc.text(
    `Generated ${new Date().toLocaleString()} \u2014 Place to Stand`,
    pageWidth / 2,
    pageHeight - 8,
    { align: 'center' }
  )

  const arrayBuffer = doc.output('arraybuffer')
  return Buffer.from(arrayBuffer)
}
