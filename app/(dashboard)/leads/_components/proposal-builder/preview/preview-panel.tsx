'use client'

import { useMemo } from 'react'
import { format } from 'date-fns'
import {
  ALargeSmall,
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ChevronDown,
  Minus,
  Plus,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { sanitizeEditorHtml } from '@/components/ui/rich-text-editor/utils'
import { cn } from '@/lib/utils'
import {
  DOCUMENT_COLORS,
  DOCUMENT_ELEMENTS,
  FONT_FAMILY_OPTIONS,
  TEXT_ALIGNMENT_OPTIONS,
  getDocumentStyles,
  type DocumentSettings,
  type TextAlignment,
} from '@/lib/proposals/document-styles'
import {
  VENDOR_INFO,
  SCOPE_OF_WORK_INTRO,
  RISKS_INTRO,
  NEXT_STEPS_TEXT,
  FULL_TERMS_AND_CONDITIONS,
} from '@/lib/proposals/constants'
import type { ProposalPhase, ProposalClientInfo, ProposalRates } from '@/lib/proposals/types'

// Font size options for increment/decrement
const FONT_SIZES: DocumentSettings['bodyFontSize'][] = [10, 11, 12]

// Line spacing options
const LINE_SPACING_OPTIONS: Array<{ value: DocumentSettings['lineSpacing']; label: string }> = [
  { value: 1.0, label: 'Single' },
  { value: 1.15, label: '1.15' },
  { value: 1.5, label: '1.5' },
  { value: 2.0, label: 'Double' },
]

type PreviewContent = {
  title: string
  client: ProposalClientInfo
  projectOverviewText: string
  phases: ProposalPhase[]
  risks: Array<{ title: string; description: string }>
  includeFullTerms: boolean
  rates: ProposalRates
  proposalValidUntil: string
  kickoffDays: number
}

type PreviewPanelProps = {
  content: PreviewContent
  documentSettings: DocumentSettings
  onDocumentSettingsChange: (settings: DocumentSettings) => void
}

// Helper function to get alignment icon
function getAlignmentIcon(alignment: TextAlignment, className = "h-3.5 w-3.5") {
  switch (alignment) {
    case 'left': return <AlignLeft className={className} />
    case 'center': return <AlignCenter className={className} />
    case 'right': return <AlignRight className={className} />
    case 'justified': return <AlignJustify className={className} />
  }
}

// Helper component for alignment button group
function AlignmentButtons({
  value,
  onChange,
  label,
}: {
  value: TextAlignment
  onChange: (alignment: TextAlignment) => void
  label: string
}) {
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 gap-1 font-normal text-xs"
            >
              {getAlignmentIcon(value)}
              <span className="text-[10px] text-muted-foreground">{label}</span>
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">{label} alignment</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" className="w-28">
        {TEXT_ALIGNMENT_OPTIONS.map(option => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              'gap-2',
              value === option.value && 'bg-accent'
            )}
          >
            {getAlignmentIcon(option.value)}
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function PreviewPanel({
  content,
  documentSettings,
  onDocumentSettingsChange,
}: PreviewPanelProps) {
  // Get computed styles based on settings
  const styles = useMemo(
    () => getDocumentStyles(documentSettings),
    [documentSettings]
  )

  // Map alignment to CSS text-align
  const headerAlign = documentSettings.headerAlignment === 'justified' ? 'justify' : documentSettings.headerAlignment
  const bodyAlign = documentSettings.bodyAlignment === 'justified' ? 'justify' : documentSettings.bodyAlignment

  // Filter out empty risks
  const allRisks = useMemo(() => {
    return content.risks.filter(r => r.title?.trim() || r.description?.trim())
  }, [content.risks])

  // Format validity date
  const validUntilFormatted = useMemo(() => {
    try {
      return format(new Date(content.proposalValidUntil), 'MMMM d, yyyy')
    } catch {
      return content.proposalValidUntil
    }
  }, [content.proposalValidUntil])

  // Font size increment/decrement handlers
  const currentSizeIndex = FONT_SIZES.indexOf(documentSettings.bodyFontSize)
  const canDecrease = currentSizeIndex > 0
  const canIncrease = currentSizeIndex < FONT_SIZES.length - 1

  const handleFontSizeDecrease = () => {
    if (canDecrease) {
      onDocumentSettingsChange({
        ...documentSettings,
        bodyFontSize: FONT_SIZES[currentSizeIndex - 1],
      })
    }
  }

  const handleFontSizeIncrease = () => {
    if (canIncrease) {
      onDocumentSettingsChange({
        ...documentSettings,
        bodyFontSize: FONT_SIZES[currentSizeIndex + 1],
      })
    }
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex w-[580px] flex-shrink-0 flex-col bg-neutral-100 dark:bg-neutral-900 min-h-0">
        {/* Google Docs-style Toolbar */}
        <div className="flex-shrink-0 border-b bg-background">
          {/* Title bar */}
          <div className="px-3 py-1.5 border-b">
            <span className="text-xs font-medium text-muted-foreground">Document Preview</span>
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-0.5 px-2 py-1 overflow-x-auto">
            {/* Font Family Dropdown */}
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 gap-1 font-normal text-xs min-w-[100px] justify-between"
                      style={{ fontFamily: styles.fontFamily }}
                    >
                      <span className="truncate">{documentSettings.fontFamily}</span>
                      <ChevronDown className="h-3 w-3 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom">Font</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="start" className="w-40">
                {FONT_FAMILY_OPTIONS.map(font => (
                  <DropdownMenuItem
                    key={font.value}
                    onClick={() =>
                      onDocumentSettingsChange({ ...documentSettings, fontFamily: font.value })
                    }
                    className={cn(
                      'text-sm',
                      documentSettings.fontFamily === font.value && 'bg-accent'
                    )}
                    style={{ fontFamily: font.css }}
                  >
                    {font.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Separator */}
            <div className="h-5 w-px bg-border mx-1" />

            {/* Font Size Controls */}
            <div className="flex items-center">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={handleFontSizeDecrease}
                    disabled={!canDecrease}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Decrease font size</TooltipContent>
              </Tooltip>

              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-10 px-1 font-normal text-xs"
                      >
                        {documentSettings.bodyFontSize}
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Font size</TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="center" className="w-16">
                  {FONT_SIZES.map(size => (
                    <DropdownMenuItem
                      key={size}
                      onClick={() =>
                        onDocumentSettingsChange({ ...documentSettings, bodyFontSize: size })
                      }
                      className={cn(
                        'justify-center',
                        documentSettings.bodyFontSize === size && 'bg-accent'
                      )}
                    >
                      {size}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={handleFontSizeIncrease}
                    disabled={!canIncrease}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Increase font size</TooltipContent>
              </Tooltip>
            </div>

            {/* Separator */}
            <div className="h-5 w-px bg-border mx-1" />

            {/* Line Spacing Dropdown */}
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 gap-1 font-normal text-xs"
                    >
                      <svg
                        className="h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <line x1="3" y1="6" x2="21" y2="6" />
                        <line x1="3" y1="12" x2="21" y2="12" />
                        <line x1="3" y1="18" x2="21" y2="18" />
                        <path d="M19 3v4M19 17v4M5 3v4M5 17v4" strokeWidth="1.5" />
                      </svg>
                      <ChevronDown className="h-3 w-3 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom">Line spacing</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="start" className="w-28">
                {LINE_SPACING_OPTIONS.map(option => (
                  <DropdownMenuItem
                    key={option.value}
                    onClick={() =>
                      onDocumentSettingsChange({ ...documentSettings, lineSpacing: option.value })
                    }
                    className={cn(
                      documentSettings.lineSpacing === option.value && 'bg-accent'
                    )}
                  >
                    {option.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Separator */}
            <div className="h-5 w-px bg-border mx-1" />

            {/* Section Spacing Dropdown */}
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 gap-1 font-normal text-xs"
                    >
                      <ALargeSmall className="h-4 w-4" />
                      <ChevronDown className="h-3 w-3 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom">Section spacing</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="start" className="w-28">
                <DropdownMenuItem
                  onClick={() =>
                    onDocumentSettingsChange({ ...documentSettings, sectionSpacing: 'compact' })
                  }
                  className={cn(
                    documentSettings.sectionSpacing === 'compact' && 'bg-accent'
                  )}
                >
                  Compact
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    onDocumentSettingsChange({ ...documentSettings, sectionSpacing: 'normal' })
                  }
                  className={cn(
                    documentSettings.sectionSpacing === 'normal' && 'bg-accent'
                  )}
                >
                  Normal
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    onDocumentSettingsChange({ ...documentSettings, sectionSpacing: 'relaxed' })
                  }
                  className={cn(
                    documentSettings.sectionSpacing === 'relaxed' && 'bg-accent'
                  )}
                >
                  Relaxed
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Separator */}
            <div className="h-5 w-px bg-border mx-1" />

            {/* Alignment Controls */}
            <div className="flex items-center gap-0.5">
              {/* Header Alignment */}
              <AlignmentButtons
                value={documentSettings.headerAlignment}
                onChange={(alignment) =>
                  onDocumentSettingsChange({ ...documentSettings, headerAlignment: alignment })
                }
                label="Headers"
              />

              {/* Body Alignment */}
              <AlignmentButtons
                value={documentSettings.bodyAlignment}
                onChange={(alignment) =>
                  onDocumentSettingsChange({ ...documentSettings, bodyAlignment: alignment })
                }
                label="Body"
              />
            </div>
          </div>
        </div>

      <div className="flex-1 min-h-0 overflow-auto">
        <div className="flex justify-center p-6 pb-24">
          {/* Document Container - simulates paper */}
          <div
            className="bg-white shadow-lg dark:bg-white"
            style={{
              fontFamily: styles.fontFamily,
              color: DOCUMENT_COLORS.text,
              padding: '48px',
              width: '520px',
            }}
          >
            {/* Cover Section */}
            <section style={{ marginBottom: styles.sectionGap, textAlign: headerAlign as 'left' | 'center' | 'right' | 'justify' }}>
              {/* Logo */}
              <div
                style={{
                  fontSize: styles.logoSize,
                  fontWeight: 700,
                  lineHeight: 1.2,
                }}
              >
                PLACE TO STAND
              </div>
              <div
                style={{
                  fontSize: styles.bodySize,
                  fontWeight: 400,
                  marginBottom: styles.paragraphGap,
                }}
              >
                AGENCY
              </div>

              {/* Divider */}
              <div
                style={{
                  marginBottom: styles.paragraphGap,
                  fontFamily: 'monospace',
                }}
              >
                {DOCUMENT_ELEMENTS.divider}
              </div>

              {/* Proposal Title */}
              <div
                style={{
                  fontSize: styles.bodySize,
                  marginBottom: 4,
                }}
              >
                Proposal for
              </div>
              <div
                style={{
                  fontSize: styles.clientHeaderSize,
                  fontWeight: 700,
                }}
              >
                {content.client.companyName || '(Company Name)'}
              </div>
            </section>

            {/* Client / Vendor Info */}
            <section style={{ marginBottom: styles.sectionGap }}>
              {/* CLIENT */}
              <div
                style={{
                  fontSize: styles.bodySize,
                  fontWeight: 700,
                  marginBottom: 4,
                }}
              >
                CLIENT
              </div>
              <div style={{ fontSize: styles.bodySize, lineHeight: styles.lineHeight, marginBottom: styles.paragraphGap }}>
                <div>{content.client.companyName || '(Company)'}</div>
                <div>{content.client.contactName || '(Contact Name)'}</div>
                <div>{content.client.contactEmail || '(email@example.com)'}</div>
                {content.client.contact2Name && <div>{content.client.contact2Name}</div>}
                {content.client.contact2Email && <div>{content.client.contact2Email}</div>}
              </div>

              {/* VENDOR */}
              <div
                style={{
                  fontSize: styles.bodySize,
                  fontWeight: 700,
                  marginBottom: 4,
                }}
              >
                VENDOR
              </div>
              <div style={{ fontSize: styles.bodySize, lineHeight: styles.lineHeight }}>
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
            <section style={{ marginBottom: styles.sectionGap }}>
              <div
                style={{
                  fontSize: styles.headerSize,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  marginBottom: 8,
                  textAlign: headerAlign as 'left' | 'center' | 'right' | 'justify',
                }}
              >
                PROJECT OVERVIEW
              </div>
              {content.projectOverviewText ? (
                <div
                  style={{
                    fontSize: styles.bodySize,
                    lineHeight: styles.lineHeight,
                    textAlign: bodyAlign as 'left' | 'center' | 'right' | 'justify',
                  }}
                  className="prose prose-sm max-w-none [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:my-1"
                  dangerouslySetInnerHTML={{ __html: sanitizeEditorHtml(content.projectOverviewText) }}
                />
              ) : (
                <div
                  style={{
                    fontSize: styles.bodySize,
                    lineHeight: styles.lineHeight,
                    color: '#999',
                    textAlign: bodyAlign as 'left' | 'center' | 'right' | 'justify',
                  }}
                >
                  (Project overview will appear here)
                </div>
              )}
            </section>

            {/* Scope of Work */}
            <section style={{ marginBottom: styles.sectionGap }}>
              <div
                style={{
                  fontSize: styles.headerSize,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  marginBottom: 8,
                  textAlign: headerAlign as 'left' | 'center' | 'right' | 'justify',
                }}
              >
                SCOPE OF WORK
              </div>
              <div
                style={{
                  fontSize: styles.bodySize,
                  lineHeight: styles.lineHeight,
                  marginBottom: styles.paragraphGap,
                  textAlign: bodyAlign as 'left' | 'center' | 'right' | 'justify',
                }}
              >
                {SCOPE_OF_WORK_INTRO}
              </div>

              {/* Phases */}
              {content.phases.map((phase, index) => (
                <div key={index} style={{ marginBottom: styles.paragraphGap }}>
                  <div
                    style={{
                      fontSize: styles.phaseSize,
                      fontWeight: 700,
                      marginBottom: 4,
                    }}
                  >
                    Phase {index + 1}: {phase.title || '(Phase Title)'}
                  </div>
                  <div style={{ fontSize: styles.bodySize, lineHeight: styles.lineHeight }}>
                    <span style={{ fontWeight: 700 }}>
                      Purpose:{' '}
                    </span>
                    {phase.purpose || '(Purpose description)'}
                  </div>
                  <div style={{ fontSize: styles.bodySize, lineHeight: styles.lineHeight, marginTop: 4 }}>
                    <span style={{ fontWeight: 700 }}>
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
            <section style={{ marginBottom: styles.sectionGap }}>
              <div
                style={{
                  fontSize: styles.headerSize,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  marginBottom: 8,
                  textAlign: headerAlign as 'left' | 'center' | 'right' | 'justify',
                }}
              >
                POTENTIAL RISKS
              </div>
              <div
                style={{
                  fontSize: styles.bodySize,
                  lineHeight: styles.lineHeight,
                  marginBottom: styles.paragraphGap,
                  textAlign: bodyAlign as 'left' | 'center' | 'right' | 'justify',
                }}
              >
                {RISKS_INTRO}
              </div>
              <ul style={{ margin: 0, paddingLeft: 24, fontSize: styles.bodySize, lineHeight: styles.lineHeight }}>
                {allRisks.map((risk, index) => (
                  <li key={index} style={{ listStyleType: 'disc', marginBottom: 4 }}>
                    <span style={{ fontWeight: 700 }}>
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
            <section style={{ marginBottom: styles.sectionGap }}>
              <div
                style={{
                  fontSize: styles.headerSize,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  marginBottom: 8,
                  textAlign: headerAlign as 'left' | 'center' | 'right' | 'justify',
                }}
              >
                RATES & INITIAL ENGAGEMENT
              </div>
              <div style={{ fontSize: styles.bodySize, lineHeight: styles.lineHeight, textAlign: bodyAlign as 'left' | 'center' | 'right' | 'justify' }}>
                <div>
                  <span style={{ fontWeight: 700 }}>
                    Rate:{' '}
                  </span>
                  ${content.rates.hourlyRate} per hour
                </div>
                <div>
                  <span style={{ fontWeight: 700 }}>
                    Initial Commitment:{' '}
                  </span>
                  {content.rates.initialCommitmentDescription || '(Not specified)'}
                </div>
                <div>
                  <span style={{ fontWeight: 700 }}>
                    Estimated Scoping/First Deliverable:{' '}
                  </span>
                  {content.rates.estimatedScopingHours || '(Not specified)'}
                </div>
              </div>
            </section>

            {/* Start Date */}
            <section style={{ marginBottom: styles.sectionGap }}>
              <div
                style={{
                  fontSize: styles.headerSize,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  marginBottom: 8,
                  textAlign: headerAlign as 'left' | 'center' | 'right' | 'justify',
                }}
              >
                START DATE
              </div>
              <div
                style={{
                  fontSize: styles.bodySize,
                  lineHeight: styles.lineHeight,
                  textAlign: bodyAlign as 'left' | 'center' | 'right' | 'justify',
                }}
              >
                This proposal is valid until {validUntilFormatted}. If this proposal
                is accepted and signed before expiration, the partnership can be
                kicked off within {content.kickoffDays} business days.
              </div>
            </section>

            {/* Next Steps */}
            <section style={{ marginBottom: styles.sectionGap }}>
              <div
                style={{
                  fontSize: styles.headerSize,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  marginBottom: 8,
                  textAlign: headerAlign as 'left' | 'center' | 'right' | 'justify',
                }}
              >
                NEXT STEPS
              </div>
              <div
                style={{
                  fontSize: styles.bodySize,
                  lineHeight: styles.lineHeight,
                  whiteSpace: 'pre-wrap',
                  textAlign: bodyAlign as 'left' | 'center' | 'right' | 'justify',
                }}
              >
                {NEXT_STEPS_TEXT}
              </div>
            </section>

            {/* Terms and Conditions */}
            <section style={{ marginBottom: styles.sectionGap }}>
              <div
                style={{
                  fontSize: styles.headerSize,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  marginBottom: 8,
                  textAlign: headerAlign as 'left' | 'center' | 'right' | 'justify',
                }}
              >
                TERMS AND CONDITIONS
              </div>
              {content.includeFullTerms ? (
                <div style={{ fontSize: styles.bodySize, lineHeight: styles.lineHeight, textAlign: bodyAlign as 'left' | 'center' | 'right' | 'justify' }}>
                  {FULL_TERMS_AND_CONDITIONS.map((section, index) => (
                    <div key={index} style={{ marginBottom: styles.paragraphGap }}>
                      <div
                        style={{
                          fontWeight: 700,
                          marginBottom: 4,
                        }}
                      >
                        {section.title}
                      </div>
                      <div
                        style={{
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
                    fontSize: styles.bodySize,
                    lineHeight: styles.lineHeight,
                    textAlign: bodyAlign as 'left' | 'center' | 'right' | 'justify',
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
                  fontSize: styles.headerSize,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  marginBottom: styles.paragraphGap,
                  textAlign: headerAlign as 'left' | 'center' | 'right' | 'justify',
                }}
              >
                SIGNATURES
              </div>

              {/* Client Signature */}
              <div style={{ marginBottom: styles.sectionGap }}>
                <div
                  style={{
                    fontSize: styles.bodySize,
                    fontWeight: 700,
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
                  <div style={{ fontSize: styles.bodySize }}>
                    {content.client.signatoryName ||
                      content.client.contactName ||
                      '(Signatory Name)'}
                  </div>
                </div>
                <div style={{ fontSize: styles.bodySize }}>
                  Date: {DOCUMENT_ELEMENTS.signatureLine.slice(0, 20)}
                </div>
              </div>

              {/* Agency Signature */}
              <div>
                <div
                  style={{
                    fontSize: styles.bodySize,
                    fontWeight: 700,
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
                  <div style={{ fontSize: styles.bodySize }}>
                    {VENDOR_INFO.name}
                  </div>
                </div>
                <div style={{ fontSize: styles.bodySize }}>
                  Date: {DOCUMENT_ELEMENTS.signatureLine.slice(0, 20)}
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
    </TooltipProvider>
  )
}
