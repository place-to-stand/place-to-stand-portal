'use client'

import { useMemo } from 'react'

import {
  DOCUMENT_TYPOGRAPHY,
  DOCUMENT_SPACING,
  DOCUMENT_FONTS,
  DOCUMENT_COLORS,
  DOCUMENT_ELEMENTS,
} from '@/lib/proposals/document-styles'
import {
  VENDOR_INFO,
  SCOPE_OF_WORK_INTRO,
  RISKS_INTRO,
  NEXT_STEPS_TEXT,
  DEFAULT_RISKS,
  FULL_TERMS_AND_CONDITIONS,
} from '@/lib/proposals/constants'
import type { ProposalPhase, ProposalClientInfo, ProposalRates } from '@/lib/proposals/types'
import { format } from 'date-fns'

type PreviewContent = {
  title: string
  client: ProposalClientInfo
  projectOverviewText: string
  phases: ProposalPhase[]
  risks: Array<{ title: string; description: string }>
  includeDefaultRisks: boolean
  includeFullTerms: boolean
  rates: ProposalRates
  proposalValidUntil: string
  kickoffDays: number
}

type PreviewPanelProps = {
  content: PreviewContent
}

export function PreviewPanel({ content }: PreviewPanelProps) {
  // Combine default and custom risks
  const allRisks = useMemo(() => {
    const risks = [...content.risks]
    if (content.includeDefaultRisks) {
      risks.push(...DEFAULT_RISKS)
    }
    return risks
  }, [content.risks, content.includeDefaultRisks])

  // Format validity date
  const validUntilFormatted = useMemo(() => {
    try {
      return format(new Date(content.proposalValidUntil), 'MMMM d, yyyy')
    } catch {
      return content.proposalValidUntil
    }
  }, [content.proposalValidUntil])

  return (
    <div className="flex w-[580px] flex-shrink-0 flex-col bg-neutral-100 dark:bg-neutral-900 min-h-0">
      <div className="flex-shrink-0 border-b bg-background px-4 py-3">
        <h3 className="text-sm font-medium">Live Preview</h3>
        <p className="text-xs text-muted-foreground">
          Matches Google Docs output
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        <div className="flex justify-center p-6 pb-24">
          {/* Document Container - simulates paper */}
          <div
            className="bg-white shadow-lg dark:bg-white"
            style={{
              fontFamily: DOCUMENT_FONTS.family,
              color: DOCUMENT_COLORS.text,
              padding: '48px',
              width: '520px',
            }}
          >
            {/* Cover Section */}
            <section style={{ marginBottom: DOCUMENT_SPACING.sectionGapPx }}>
              {/* Logo */}
              <div
                style={{
                  fontSize: DOCUMENT_TYPOGRAPHY.logo.main.size,
                  fontWeight: DOCUMENT_TYPOGRAPHY.logo.main.weight,
                  lineHeight: DOCUMENT_TYPOGRAPHY.logo.main.lineHeight,
                }}
              >
                PLACE TO STAND
              </div>
              <div
                style={{
                  fontSize: DOCUMENT_TYPOGRAPHY.logo.subtitle.size,
                  fontWeight: DOCUMENT_TYPOGRAPHY.logo.subtitle.weight,
                  marginBottom: DOCUMENT_SPACING.paragraphGapPx,
                }}
              >
                AGENCY
              </div>

              {/* Divider */}
              <div
                style={{
                  marginBottom: DOCUMENT_SPACING.paragraphGapPx,
                  fontFamily: 'monospace',
                }}
              >
                {DOCUMENT_ELEMENTS.divider}
              </div>

              {/* Proposal Title */}
              <div
                style={{
                  fontSize: DOCUMENT_TYPOGRAPHY.proposalForText.size,
                  marginBottom: 4,
                }}
              >
                Proposal for
              </div>
              <div
                style={{
                  fontSize: DOCUMENT_TYPOGRAPHY.clientCompanyHeader.size,
                  fontWeight: DOCUMENT_TYPOGRAPHY.clientCompanyHeader.weight,
                }}
              >
                {content.client.companyName || '(Company Name)'}
              </div>
            </section>

            {/* Client / Vendor Info */}
            <section style={{ marginBottom: DOCUMENT_SPACING.sectionGapPx }}>
              {/* CLIENT */}
              <div
                style={{
                  fontSize: DOCUMENT_TYPOGRAPHY.signatureHeader.size,
                  fontWeight: DOCUMENT_TYPOGRAPHY.signatureHeader.weight,
                  marginBottom: 4,
                }}
              >
                CLIENT
              </div>
              <div style={{ fontSize: DOCUMENT_TYPOGRAPHY.body.size, marginBottom: DOCUMENT_SPACING.paragraphGapPx }}>
                <div>{content.client.companyName || '(Company)'}</div>
                <div>{content.client.contactName || '(Contact Name)'}</div>
                <div>{content.client.contactEmail || '(email@example.com)'}</div>
                {content.client.contact2Name && <div>{content.client.contact2Name}</div>}
                {content.client.contact2Email && <div>{content.client.contact2Email}</div>}
              </div>

              {/* VENDOR */}
              <div
                style={{
                  fontSize: DOCUMENT_TYPOGRAPHY.signatureHeader.size,
                  fontWeight: DOCUMENT_TYPOGRAPHY.signatureHeader.weight,
                  marginBottom: 4,
                }}
              >
                VENDOR
              </div>
              <div style={{ fontSize: DOCUMENT_TYPOGRAPHY.body.size }}>
                <div>{VENDOR_INFO.website}</div>
                <div>{VENDOR_INFO.name}</div>
                <div>{VENDOR_INFO.address.street}</div>
                <div>
                  {VENDOR_INFO.address.city}, {VENDOR_INFO.address.state}{' '}
                  {VENDOR_INFO.address.zip}
                </div>
                <div>{VENDOR_INFO.email}</div>
                <div>{VENDOR_INFO.phone}</div>
              </div>
            </section>

            {/* Project Overview */}
            <section style={{ marginBottom: DOCUMENT_SPACING.sectionGapPx }}>
              <div
                style={{
                  fontSize: DOCUMENT_TYPOGRAPHY.sectionHeader.size,
                  fontWeight: DOCUMENT_TYPOGRAPHY.sectionHeader.weight,
                  textTransform: DOCUMENT_TYPOGRAPHY.sectionHeader.textTransform,
                  marginBottom: DOCUMENT_SPACING.lineGapPx,
                }}
              >
                PROJECT OVERVIEW
              </div>
              <div
                style={{
                  fontSize: DOCUMENT_TYPOGRAPHY.body.size,
                  lineHeight: DOCUMENT_TYPOGRAPHY.body.lineHeight,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {content.projectOverviewText || '(Project overview will appear here)'}
              </div>
            </section>

            {/* Scope of Work */}
            <section style={{ marginBottom: DOCUMENT_SPACING.sectionGapPx }}>
              <div
                style={{
                  fontSize: DOCUMENT_TYPOGRAPHY.sectionHeader.size,
                  fontWeight: DOCUMENT_TYPOGRAPHY.sectionHeader.weight,
                  textTransform: DOCUMENT_TYPOGRAPHY.sectionHeader.textTransform,
                  marginBottom: DOCUMENT_SPACING.lineGapPx,
                }}
              >
                SCOPE OF WORK
              </div>
              <div
                style={{
                  fontSize: DOCUMENT_TYPOGRAPHY.body.size,
                  lineHeight: DOCUMENT_TYPOGRAPHY.body.lineHeight,
                  marginBottom: DOCUMENT_SPACING.paragraphGapPx,
                }}
              >
                {SCOPE_OF_WORK_INTRO}
              </div>

              {/* Phases */}
              {content.phases.map((phase, index) => (
                <div key={index} style={{ marginBottom: DOCUMENT_SPACING.paragraphGapPx }}>
                  <div
                    style={{
                      fontSize: DOCUMENT_TYPOGRAPHY.phaseTitle.size,
                      fontWeight: DOCUMENT_TYPOGRAPHY.phaseTitle.weight,
                      marginBottom: 4,
                    }}
                  >
                    Phase {index + 1}: {phase.title || '(Phase Title)'}
                  </div>
                  <div style={{ fontSize: DOCUMENT_TYPOGRAPHY.body.size }}>
                    <span style={{ fontWeight: DOCUMENT_TYPOGRAPHY.label.weight }}>
                      Purpose:{' '}
                    </span>
                    {phase.purpose || '(Purpose description)'}
                  </div>
                  <div style={{ fontSize: DOCUMENT_TYPOGRAPHY.body.size, marginTop: 4 }}>
                    <span style={{ fontWeight: DOCUMENT_TYPOGRAPHY.label.weight }}>
                      Deliverables:
                    </span>
                    <ul style={{ margin: '4px 0 0 24px', paddingLeft: 0 }}>
                      {phase.deliverables.length > 0 ? (
                        phase.deliverables.map((d, i) => (
                          <li key={i} style={{ listStyleType: 'disc' }}>
                            {d || '(Deliverable)'}
                          </li>
                        ))
                      ) : (
                        <li style={{ listStyleType: 'disc' }}>(No deliverables)</li>
                      )}
                    </ul>
                  </div>
                </div>
              ))}
            </section>

            {/* Potential Risks */}
            <section style={{ marginBottom: DOCUMENT_SPACING.sectionGapPx }}>
              <div
                style={{
                  fontSize: DOCUMENT_TYPOGRAPHY.sectionHeader.size,
                  fontWeight: DOCUMENT_TYPOGRAPHY.sectionHeader.weight,
                  textTransform: DOCUMENT_TYPOGRAPHY.sectionHeader.textTransform,
                  marginBottom: DOCUMENT_SPACING.lineGapPx,
                }}
              >
                POTENTIAL RISKS
              </div>
              <div
                style={{
                  fontSize: DOCUMENT_TYPOGRAPHY.body.size,
                  lineHeight: DOCUMENT_TYPOGRAPHY.body.lineHeight,
                  marginBottom: DOCUMENT_SPACING.paragraphGapPx,
                }}
              >
                {RISKS_INTRO}
              </div>
              <ul style={{ margin: 0, paddingLeft: 24, fontSize: DOCUMENT_TYPOGRAPHY.body.size }}>
                {allRisks.map((risk, index) => (
                  <li key={index} style={{ listStyleType: 'disc', marginBottom: 4 }}>
                    <span style={{ fontWeight: DOCUMENT_TYPOGRAPHY.label.weight }}>
                      {risk.title}:
                    </span>{' '}
                    {risk.description}
                  </li>
                ))}
                {allRisks.length === 0 && (
                  <li style={{ listStyleType: 'disc', color: '#999' }}>
                    (No risks specified)
                  </li>
                )}
              </ul>
            </section>

            {/* Rates & Initial Engagement */}
            <section style={{ marginBottom: DOCUMENT_SPACING.sectionGapPx }}>
              <div
                style={{
                  fontSize: DOCUMENT_TYPOGRAPHY.sectionHeader.size,
                  fontWeight: DOCUMENT_TYPOGRAPHY.sectionHeader.weight,
                  textTransform: DOCUMENT_TYPOGRAPHY.sectionHeader.textTransform,
                  marginBottom: DOCUMENT_SPACING.lineGapPx,
                }}
              >
                RATES & INITIAL ENGAGEMENT
              </div>
              <div style={{ fontSize: DOCUMENT_TYPOGRAPHY.body.size }}>
                <div>
                  <span style={{ fontWeight: DOCUMENT_TYPOGRAPHY.label.weight }}>
                    Rate:{' '}
                  </span>
                  ${content.rates.hourlyRate} per hour
                </div>
                <div>
                  <span style={{ fontWeight: DOCUMENT_TYPOGRAPHY.label.weight }}>
                    Initial Commitment:{' '}
                  </span>
                  {content.rates.initialCommitmentDescription || '(Not specified)'}
                </div>
                <div>
                  <span style={{ fontWeight: DOCUMENT_TYPOGRAPHY.label.weight }}>
                    Estimated Scoping/First Deliverable:{' '}
                  </span>
                  {content.rates.estimatedScopingHours || '(Not specified)'}
                </div>
              </div>
            </section>

            {/* Start Date */}
            <section style={{ marginBottom: DOCUMENT_SPACING.sectionGapPx }}>
              <div
                style={{
                  fontSize: DOCUMENT_TYPOGRAPHY.sectionHeader.size,
                  fontWeight: DOCUMENT_TYPOGRAPHY.sectionHeader.weight,
                  textTransform: DOCUMENT_TYPOGRAPHY.sectionHeader.textTransform,
                  marginBottom: DOCUMENT_SPACING.lineGapPx,
                }}
              >
                START DATE
              </div>
              <div
                style={{
                  fontSize: DOCUMENT_TYPOGRAPHY.body.size,
                  lineHeight: DOCUMENT_TYPOGRAPHY.body.lineHeight,
                }}
              >
                This proposal is valid until {validUntilFormatted}. If this proposal
                is accepted and signed before expiration, the partnership can be
                kicked off within {content.kickoffDays} business days.
              </div>
            </section>

            {/* Next Steps */}
            <section style={{ marginBottom: DOCUMENT_SPACING.sectionGapPx }}>
              <div
                style={{
                  fontSize: DOCUMENT_TYPOGRAPHY.sectionHeader.size,
                  fontWeight: DOCUMENT_TYPOGRAPHY.sectionHeader.weight,
                  textTransform: DOCUMENT_TYPOGRAPHY.sectionHeader.textTransform,
                  marginBottom: DOCUMENT_SPACING.lineGapPx,
                }}
              >
                NEXT STEPS
              </div>
              <div
                style={{
                  fontSize: DOCUMENT_TYPOGRAPHY.body.size,
                  lineHeight: DOCUMENT_TYPOGRAPHY.body.lineHeight,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {NEXT_STEPS_TEXT}
              </div>
            </section>

            {/* Terms and Conditions */}
            <section style={{ marginBottom: DOCUMENT_SPACING.sectionGapPx }}>
              <div
                style={{
                  fontSize: DOCUMENT_TYPOGRAPHY.sectionHeader.size,
                  fontWeight: DOCUMENT_TYPOGRAPHY.sectionHeader.weight,
                  textTransform: DOCUMENT_TYPOGRAPHY.sectionHeader.textTransform,
                  marginBottom: DOCUMENT_SPACING.lineGapPx,
                }}
              >
                TERMS AND CONDITIONS
              </div>
              {content.includeFullTerms ? (
                <div style={{ fontSize: DOCUMENT_TYPOGRAPHY.body.size }}>
                  {FULL_TERMS_AND_CONDITIONS.map((section, index) => (
                    <div key={index} style={{ marginBottom: DOCUMENT_SPACING.paragraphGapPx }}>
                      <div
                        style={{
                          fontWeight: DOCUMENT_TYPOGRAPHY.label.weight,
                          marginBottom: 4,
                        }}
                      >
                        {section.title}
                      </div>
                      <div
                        style={{
                          lineHeight: DOCUMENT_TYPOGRAPHY.body.lineHeight,
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {section.content}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  style={{
                    fontSize: DOCUMENT_TYPOGRAPHY.body.size,
                    lineHeight: DOCUMENT_TYPOGRAPHY.body.lineHeight,
                  }}
                >
                  Standard terms and conditions apply. Full terms available upon request.
                </div>
              )}
            </section>

            {/* Signatures */}
            <section>
              <div
                style={{
                  fontSize: DOCUMENT_TYPOGRAPHY.sectionHeader.size,
                  fontWeight: DOCUMENT_TYPOGRAPHY.sectionHeader.weight,
                  textTransform: DOCUMENT_TYPOGRAPHY.sectionHeader.textTransform,
                  marginBottom: DOCUMENT_SPACING.paragraphGapPx,
                }}
              >
                SIGNATURES
              </div>

              {/* Client Signature */}
              <div style={{ marginBottom: DOCUMENT_SPACING.sectionGapPx }}>
                <div
                  style={{
                    fontSize: DOCUMENT_TYPOGRAPHY.signatureHeader.size,
                    fontWeight: DOCUMENT_TYPOGRAPHY.signatureHeader.weight,
                    marginBottom: 8,
                  }}
                >
                  CLIENT
                </div>
                <div
                  style={{
                    backgroundColor: DOCUMENT_COLORS.signatureBox,
                    padding: '24px 16px',
                    borderRadius: 4,
                    marginBottom: 8,
                  }}
                >
                  <div
                    style={{
                      borderBottom: '1px solid #000',
                      marginBottom: 4,
                      height: 24,
                    }}
                  />
                  <div style={{ fontSize: DOCUMENT_TYPOGRAPHY.body.size }}>
                    {content.client.signatoryName ||
                      content.client.contactName ||
                      '(Signatory Name)'}
                  </div>
                </div>
                <div style={{ fontSize: DOCUMENT_TYPOGRAPHY.body.size }}>
                  Date: {DOCUMENT_ELEMENTS.signatureLine.slice(0, 20)}
                </div>
              </div>

              {/* Agency Signature */}
              <div>
                <div
                  style={{
                    fontSize: DOCUMENT_TYPOGRAPHY.signatureHeader.size,
                    fontWeight: DOCUMENT_TYPOGRAPHY.signatureHeader.weight,
                    marginBottom: 8,
                  }}
                >
                  AGENCY
                </div>
                <div
                  style={{
                    backgroundColor: DOCUMENT_COLORS.signatureBox,
                    padding: '24px 16px',
                    borderRadius: 4,
                    marginBottom: 8,
                  }}
                >
                  <div
                    style={{
                      borderBottom: '1px solid #000',
                      marginBottom: 4,
                      height: 24,
                    }}
                  />
                  <div style={{ fontSize: DOCUMENT_TYPOGRAPHY.body.size }}>
                    {VENDOR_INFO.name}
                  </div>
                </div>
                <div style={{ fontSize: DOCUMENT_TYPOGRAPHY.body.size }}>
                  Date: {DOCUMENT_ELEMENTS.signatureLine.slice(0, 20)}
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
