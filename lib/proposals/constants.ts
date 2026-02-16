import {
  FileText,
  Send,
  Eye,
  CheckCircle,
  XCircle,
  type LucideIcon,
} from 'lucide-react'

import type { ProposalRisk, TermsSection } from './types'

// =============================================================================
// Proposal Status
// =============================================================================

export const PROPOSAL_STATUSES = ['DRAFT', 'SENT', 'VIEWED', 'ACCEPTED', 'REJECTED'] as const
export type ProposalStatusValue = (typeof PROPOSAL_STATUSES)[number]

export const PROPOSAL_STATUS_LABELS: Record<ProposalStatusValue, string> = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  VIEWED: 'Viewed',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
}

/**
 * Display configuration for proposal statuses, including icons and colors.
 * Used by UI components to render status badges consistently.
 */
export const PROPOSAL_STATUS_CONFIG: Record<
  ProposalStatusValue,
  { label: string; icon: LucideIcon; className: string }
> = {
  DRAFT: {
    label: 'Draft',
    icon: FileText,
    className: 'border-transparent bg-slate-100 text-slate-800 dark:bg-slate-800/40 dark:text-slate-200',
  },
  SENT: {
    label: 'Sent',
    icon: Send,
    className: 'border-transparent bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  },
  VIEWED: {
    label: 'Viewed',
    icon: Eye,
    className: 'border-transparent bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200',
  },
  ACCEPTED: {
    label: 'Accepted',
    icon: CheckCircle,
    className: 'border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  },
  REJECTED: {
    label: 'Rejected',
    icon: XCircle,
    className: 'border-transparent bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
  },
}

// =============================================================================
// Default Values
// =============================================================================

export const DEFAULT_HOURLY_RATE = 200
export const DEFAULT_KICKOFF_DAYS = 10
export const DEFAULT_PROPOSAL_VALIDITY_DAYS = 30

// =============================================================================
// Vendor Information
// =============================================================================

export const VENDOR_INFO = {
  name: 'Place To Stand Agency',
  website: 'https://placetostandagency.com/',
  address: {
    street: '1800 W Koenig Lane',
    city: 'Austin',
    state: 'TX',
    zip: '78756',
  },
  email: 'jason@placetostandagency.com',
  phone: '(512) 200-4178',
} as const

// =============================================================================
// Default Risks
// =============================================================================

export const DEFAULT_RISKS: ProposalRisk[] = [
  {
    title: 'Scope Evolution',
    description:
      'As discovery progresses, requirements may evolve based on technical findings or stakeholder feedback. Any significant scope changes will be documented in an updated SOW before proceeding.',
  },
  {
    title: 'Third-Party Dependencies',
    description:
      'Custom software solutions involving external services or APIs will require ongoing maintenance and compatibility updates, billed at the standard hourly rate, to ensure long-term reliability.',
  },
  {
    title: '"As Is" Service',
    description:
      'The custom-built deliverables and any software are provided "as is." Place To Stand Agency cannot guarantee specific business results, market performance, or the behavior of external APIs or services.',
  },
  {
    title: 'Total Liability Limit',
    description:
      'Our total liability under this Agreement is limited to the total fees paid to us during the 12 months before a claim arose (excluding gross negligence or intentional misconduct).',
  },
]

// =============================================================================
// Static Text Sections
// =============================================================================

export const SCOPE_OF_WORK_INTRO = `Place To Stand will provide software and technical services as described in this Scope of Work ("SOW"). Each SOW describes, to the best of our abilities – what we'll do, deliverables, and pricing. If a new phase or feature is added, we'll prepare a new or updated SOW. Our services for MVP will focus on, but are not limited to, the following items:`

export const RISKS_INTRO = `The goal is to deliver a successful MVP, but as with any custom software development project, potential risks exist that the Client should be aware of:`

export const NEXT_STEPS_TEXT = `Upon acceptance of this scope of work, please sign below.
After signing, we will schedule a kickoff meeting and begin the scope of work.`

// =============================================================================
// Full Terms and Conditions
// =============================================================================

export const FULL_TERMS_AND_CONDITIONS: TermsSection[] = [
  {
    title: 'Scope & Agreement',
    content: `By accepting this proposal, you indicate that the services outlined above have been thoroughly reviewed and are fully understood.
This agreement can be terminated by either party with 30 days written notice. If the Agreement ends, the client will forfeit any pre-paid amounts not yet used.`,
  },
  {
    title: 'Ownership & Intellectual Property',
    content: `Your Property: You own all final deliverables and materials created specifically for you once paid in full.
Your Data: You own your data. We won't use or share it except to perform our services.
Our Tools & Know-How: We keep ownership of our existing tools, templates, frameworks, code libraries, and general know-how that we use across projects. You get a non-exclusive, perpetual, royalty-free license to use anything from us that's embedded in your deliverables as needed for your business.`,
  },
  {
    title: 'Confidentiality & Publicity',
    content: `Both Parties agree to keep each other's confidential information private and use it only to perform under this Agreement. Confidential information includes business plans, code, data, pricing, or anything marked or reasonably understood as confidential.
Information is not confidential if it was already known, publicly available, or independently developed without using the other Party's confidential information. Either Party may disclose information if required by law, after giving notice (when legally allowed).
We may list you as a client & briefly describe the project on our website or marketing materials, unless you ask us in writing not to.`,
  },
  {
    title: 'Warranty, Liability & Force Majeure',
    content: `We'll perform our work in a professional and workmanlike manner consistent with industry standards.
Deliverables and any software are provided "as is." We can't guarantee business results or the behavior of third-party APIs or services. Except for what's stated above, we make no other warranties—express or implied—including merchantability or fitness for a particular purpose.
Custom software solutions involving third-party providers may require maintenance at our standard hourly rate to ensure reliability and compatibility with future updates.
Neither Party is liable for indirect or consequential damages (like lost profits or data).
Our total liability under this Agreement is limited to the total fees you paid to us during the 12 months before the claim arose.
These limits don't apply to your payment obligations or either Party's gross negligence or intentional misconduct.
Neither Party is liable for delays or failures caused by events beyond reasonable control (natural disasters, internet outages, war, government actions, etc.).`,
  },
  {
    title: 'Availability',
    content: `Support is subject to Place To Stand's availability and is generally available Monday through Friday from 9AM to 5PM Central Time. Place To Stand cannot guarantee explicit availability at any given time.
Support provided outside our normal hours listed above can be provided at the sole discretion of Place To Stand at 1.5x our normal hourly rates. Support is not available during bank holidays. Our availability for support outside of our normal hours is not guaranteed and is subject to staff availability.
We will answer any requests at our next availability. Our response time is usually within 1-2 business days, often sooner, but we cannot guarantee any specific response time. A 3 hour surcharge may apply for emergency service, at our discretion.
All services will be provided remotely with a minimum one week turnaround time for tasks unless a specific due date is requested. In that case, we will try our best to accommodate but it may not always be guaranteed.`,
  },
  {
    title: 'Payments',
    content: `All payments are due upon receipt of invoice. Work will not commence until payment is received.
Fees may include sales or similar taxes if determined applicable by our CPA.`,
  },
  {
    title: 'Subcontractors',
    content: `Certain requests may require the Agency to hire subcontractors for services that do not fall within its core competency. While these subcontractors may have different rates and/or payment terms, any use of a subcontractor that would result in additional charges to the Client is subject to the Client's prior agreement, either through a separate agreement or explicit written approval, before services are rendered and before any financial obligation is incurred from a third party. Furthermore, it is understood that this agreement, and the financial obligations agreed upon, are specific to the Place To Stand Agency (PTS) and the Client.`,
  },
  {
    title: 'Governing Law and Disputes',
    content: `This Agreement is governed by Texas law. Any disputes will be handled in the state or federal courts located in Travis County, Texas, and both Parties consent to that venue.`,
  },
]

// Terms and Conditions section titles (for reference)
export const TERMS_SECTIONS = FULL_TERMS_AND_CONDITIONS.map(t => t.title)
