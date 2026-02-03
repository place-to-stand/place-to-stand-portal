import type { ProposalContent } from '@/lib/proposals/types'
import {
  VENDOR_INFO,
  SCOPE_OF_WORK_INTRO,
  RISKS_INTRO,
  FULL_TERMS_AND_CONDITIONS,
  DEFAULT_RISKS,
} from '@/lib/proposals/constants'
import { SignatureBlock, type SignatureBlockProps } from './signature-block'

type ProposalDocumentProps = {
  title: string
  content: ProposalContent
  estimatedValue?: string | null
  expirationDate?: string | null
  signature?: SignatureBlockProps
}

export function ProposalDocument({
  title,
  content,
  expirationDate,
  signature,
}: ProposalDocumentProps) {
  const {
    client,
    projectOverviewText,
    phases,
    risks: contentRisks,
    rates,
    proposalValidUntil,
    kickoffDays,
  } = content

  // Always show risks — use content risks if available, otherwise defaults
  const risks = contentRisks && contentRisks.length > 0 ? contentRisks : DEFAULT_RISKS

  const validUntil = expirationDate ?? proposalValidUntil

  return (
    <article className="space-y-10 print:space-y-6">
      {/* Cover / Header */}
      <header className="space-y-4 border-b pb-8">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm text-muted-foreground">
          <div>
            <span className="font-medium text-foreground">Prepared for:</span>{' '}
            {client.companyName}
          </div>
          <div>
            <span className="font-medium text-foreground">Contact:</span>{' '}
            {client.contactName} ({client.contactEmail})
          </div>
          {validUntil && (
            <div>
              <span className="font-medium text-foreground">Valid until:</span>{' '}
              {new Date(validUntil).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </div>
          )}
        </div>
        <div className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">From:</span>{' '}
          {VENDOR_INFO.name} &middot; {VENDOR_INFO.email} &middot; {VENDOR_INFO.phone}
        </div>
      </header>

      {/* Project Overview */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Project Overview</h2>
        <div className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
          {projectOverviewText}
        </div>
      </section>

      {/* Scope of Work */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Scope of Work</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {SCOPE_OF_WORK_INTRO}
        </p>
        <div className="space-y-6">
          {phases.map(phase => (
            <div key={phase.index} className="rounded-lg border p-4">
              <h3 className="font-semibold">
                Phase {phase.index}: {phase.title}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">{phase.purpose}</p>
              {phase.deliverables.length > 0 && (
                <ul className="mt-3 space-y-1">
                  {phase.deliverables.map((d, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      {d}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Risks — always shown */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Risks & Considerations</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{RISKS_INTRO}</p>
        <div className="space-y-3">
          {risks.map((risk, i) => (
            <div key={i} className="rounded-lg border p-4">
              <h3 className="text-sm font-semibold">{risk.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{risk.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Rates & Engagement */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Rates & Engagement</h2>
        <div className="rounded-lg border p-4">
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium">Hourly Rate</dt>
              <dd className="text-sm text-muted-foreground">
                ${rates.hourlyRate}/hr
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium">Initial Commitment</dt>
              <dd className="text-sm text-muted-foreground">
                {rates.initialCommitmentDescription}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium">Estimated Scoping Hours</dt>
              <dd className="text-sm text-muted-foreground">
                {rates.estimatedScopingHours}
              </dd>
            </div>
            {kickoffDays && (
              <div>
                <dt className="text-sm font-medium">Kickoff Timeline</dt>
                <dd className="text-sm text-muted-foreground">
                  Within {kickoffDays} business days of acceptance
                </dd>
              </div>
            )}
          </dl>
        </div>
      </section>

      {/* Terms & Conditions — always shown */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Terms & Conditions</h2>
        {FULL_TERMS_AND_CONDITIONS.map((section, i) => (
          <div key={i} className="space-y-1">
            <h3 className="text-sm font-semibold">
              {i + 1}. {section.title}
            </h3>
            <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {section.content}
            </p>
          </div>
        ))}
      </section>

      {/* Signature Block — only shown when signature data is passed */}
      {signature && <SignatureBlock {...signature} />}
    </article>
  )
}
