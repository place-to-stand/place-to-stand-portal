import type { ProposalRisk } from './types'

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
    title: 'Integration Complexity',
    description:
      'Integrating the new platform with client-specific third-party systems (e.g., HRIS, PowerBI data feeds) is a critical step, and unforeseen compatibility issues may require custom work, potentially impacting the timeline and cost.',
  },
  {
    title: 'Ongoing Maintenance',
    description:
      'Custom software solutions involving third-party providers will require ongoing maintenance and compatibility updates, billed at the standard hourly rate, to ensure long-term reliability against future system changes.',
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

// Terms and Conditions sections (static boilerplate - abbreviated titles)
export const TERMS_SECTIONS = [
  'Scope & Agreement',
  'Ownership & Intellectual Property',
  'Confidentiality & Publicity',
  'Warranty, Liability & Force Majeure',
  'Availability',
  'Payments',
  'Subcontractors',
  'Governing Law and Disputes',
] as const
