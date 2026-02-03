import 'server-only'

import { jsPDF } from 'jspdf'
import type { Proposal } from '@/lib/queries/proposals'

/**
 * Generate a completion certificate PDF for a fully-executed proposal.
 * Returns a Buffer containing the PDF data.
 */
export async function generateCompletionCertificate(
  proposal: Proposal
): Promise<Buffer> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 20
  const contentWidth = pageWidth - margin * 2
  let y = margin

  // Helper functions
  function addCenteredText(text: string, size: number, style: 'normal' | 'bold' = 'normal') {
    doc.setFontSize(size)
    doc.setFont('helvetica', style)
    doc.text(text, pageWidth / 2, y, { align: 'center' })
    y += size * 0.5
  }

  function addText(text: string, size: number, style: 'normal' | 'bold' = 'normal', x = margin) {
    doc.setFontSize(size)
    doc.setFont('helvetica', style)
    doc.text(text, x, y)
    y += size * 0.45
  }

  function addLine() {
    doc.setDrawColor(200, 200, 200)
    doc.line(margin, y, pageWidth - margin, y)
    y += 4
  }

  function addSpacer(mm: number) {
    y += mm
  }

  // Title
  addCenteredText('CERTIFICATE OF EXECUTION', 18, 'bold')
  addSpacer(4)
  addCenteredText('Electronic Signature Confirmation', 11)
  addSpacer(6)
  addLine()
  addSpacer(4)

  // Proposal details
  addText('PROPOSAL DETAILS', 11, 'bold')
  addSpacer(2)
  addText(`Title: ${proposal.title}`, 10)
  addText(`Document ID: ${proposal.id}`, 10)
  if (proposal.estimatedValue) {
    addText(`Value: $${parseFloat(proposal.estimatedValue).toLocaleString()}`, 10)
  }
  if (proposal.contentHashAtSigning) {
    addText(`Content Hash (SHA-256): ${proposal.contentHashAtSigning}`, 8)
  }
  addSpacer(6)
  addLine()
  addSpacer(4)

  // Party 1: Client
  addText('PARTY 1 — CLIENT', 11, 'bold')
  addSpacer(2)
  addText(`Name: ${proposal.signerName ?? 'N/A'}`, 10)
  addText(`Email: ${proposal.signerEmail ?? 'N/A'}`, 10)
  addText(`Signed: ${proposal.acceptedAt ? new Date(proposal.acceptedAt).toLocaleString() : 'N/A'}`, 10)
  addText(`IP Address: ${proposal.signerIpAddress ?? 'N/A'}`, 10)
  addText(`E-Signature Consent: ${proposal.signatureConsent ? 'Yes' : 'No'}`, 10)

  // Add client signature image if available
  if (proposal.signatureData?.startsWith('data:image/png')) {
    addSpacer(2)
    try {
      doc.addImage(proposal.signatureData, 'PNG', margin, y, 60, 20)
      y += 22
    } catch {
      addText('[Signature image could not be embedded]', 9)
    }
  }

  addSpacer(6)
  addLine()
  addSpacer(4)

  // Party 2: Countersigner
  addText('PARTY 2 — TEAM', 11, 'bold')
  addSpacer(2)
  addText(`Name: ${proposal.countersignerName ?? 'N/A'}`, 10)
  addText(`Email: ${proposal.countersignerEmail ?? 'N/A'}`, 10)
  addText(`Signed: ${proposal.countersignedAt ? new Date(proposal.countersignedAt).toLocaleString() : 'N/A'}`, 10)
  addText(`IP Address: ${proposal.countersignerIpAddress ?? 'N/A'}`, 10)
  addText(`E-Signature Consent: ${proposal.countersignatureConsent ? 'Yes' : 'No'}`, 10)

  // Add countersignature image if available
  if (proposal.countersignatureData?.startsWith('data:image/png')) {
    addSpacer(2)
    try {
      doc.addImage(proposal.countersignatureData, 'PNG', margin, y, 60, 20)
      y += 22
    } catch {
      addText('[Signature image could not be embedded]', 9)
    }
  }

  addSpacer(6)
  addLine()
  addSpacer(4)

  // Legal notice
  addText('LEGAL NOTICE', 11, 'bold')
  addSpacer(2)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  const legalText =
    'Both parties indicated their agreement by applying their electronic signatures to this ' +
    'proposal. Each party confirmed that their electronic signature is the legal equivalent ' +
    'of their manual signature. This certificate serves as a record of the signing event ' +
    'and is not the signed document itself.'
  const splitLegal = doc.splitTextToSize(legalText, contentWidth)
  doc.text(splitLegal, margin, y)
  y += splitLegal.length * 4

  addSpacer(6)

  // Footer
  doc.setFontSize(8)
  doc.setTextColor(150, 150, 150)
  doc.text(
    `Generated ${new Date().toLocaleString()} — Place to Stand`,
    pageWidth / 2,
    doc.internal.pageSize.getHeight() - 10,
    { align: 'center' }
  )

  // Return as Buffer
  const arrayBuffer = doc.output('arraybuffer')
  return Buffer.from(arrayBuffer)
}
