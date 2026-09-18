import 'server-only'

import {
  auditNotificationEmail,
  auditResultsEmail,
  contactConfirmationEmail,
  contactNotificationEmail,
} from '@pts/email'
import { resolveFormEmailAddresses } from '@/lib/form-submissions/delivery/addresses'
import { leadHref, submissionHref } from '@/lib/sheets/hrefs'

import type { EmailTemplateEntry } from './catalog'

const FORM_DELIVERY =
  'Resend SDK through lib/email/send.ts, from lib/form-submissions/delivery; routed to Mailpit outside production. Sent once per submission: the send claims a timestamp on the row first, and a failed send is retried by /api/cron/retry-submission-emails.'

const SAMPLE_SUBMISSION_ID = '00000000-0000-4000-a000-000000000000'
const SAMPLE_LEAD_ID = '00000000-0000-4000-a000-000000000001'

const SAMPLE_CONTACT = {
  name: 'Jordan Sample',
  email: 'jordan@example.com',
  company: 'Sample Co',
  website: 'https://example.com',
}

const SAMPLE_SOURCE = {
  summary: 'Google Ads · sample-campaign · "sample search term"',
  landingPath: '/',
  device: 'Desktop · 1440px',
  timezone: 'America/Los_Angeles',
  replayUrl: 'https://us.posthog.com/replay/sample-session',
}

const SAMPLE_AUDIT_RESULT = {
  phaseName: 'Scale',
  phaseTagline: 'Re-architect your stack and rethink operations for demand.',
  summary:
    'Sample Co has working processes that are starting to strain. The biggest wins are in removing manual handoffs between the tools the team already uses.',
  recommendations: [
    {
      serviceName: 'Workflow automation',
      tagline: 'Connect your tools, automate handoffs, see every process.',
      reasons: ['Re-keys data between systems', 'Reports built by hand'],
    },
    {
      serviceName: 'Internal tools',
      tagline: 'Purpose-built software for the work only you do.',
      reasons: ['Spreadsheets used as a system of record'],
    },
  ],
}

/**
 * Catalog entries for the marketing form emails (PRD 008). Kept apart from the
 * auth entries only for file size; `buildEmailTemplateCatalog` splices them in.
 * Samples call the real templates with obviously fake data, as everywhere else.
 */
export function buildFormEmailEntries(
  internalOrigin: string
): EmailTemplateEntry[] {
  const formAddresses = resolveFormEmailAddresses()

  return [
    {
      id: 'contact-notification',
      status: 'active',
      name: 'Contact form — team notification',
      description:
        'Tells the team someone used the marketing-site contact form. Leads with a link to the submission, then who, what they said, and a one-line summary of where they came from.',
      portals: ['internal'],
      triggers: [
        'POST /api/integrations/contact-submissions with `deliver: true` (the marketing site’s contact form)',
      ],
      recipient: formAddresses.teamInbox,
      from: formAddresses.from,
      replyTo: 'The visitor’s address, so replying answers them directly',
      delivery: FORM_DELIVERY,
      attachments: null,
      source: 'packages/email/src/templates/contact-notification.ts',
      variants: [
        {
          label: 'Admin',
          sample: contactNotificationEmail({
            submissionUrl: `${internalOrigin}${submissionHref(SAMPLE_SUBMISSION_ID)}`,
            contact: SAMPLE_CONTACT,
            subject: 'Website redesign',
            message:
              'This is a sample message.\n\nWe are looking for help rebuilding our site and would like to talk through timelines.',
            source: SAMPLE_SOURCE,
            repeat: {
              count: 2,
              leadUrl: `${internalOrigin}${leadHref(SAMPLE_LEAD_ID)}`,
            },
          }),
        },
      ],
    },
    {
      id: 'contact-confirmation',
      status: 'active',
      name: 'Contact form — visitor confirmation',
      description:
        'Receipt for a visitor who used the contact form, echoing what they sent. Skipped when the address has requested more than three deliveries in fifteen minutes.',
      portals: ['internal'],
      triggers: ['Same request as the team notification'],
      recipient: 'The address entered on the contact form',
      from: formAddresses.from,
      replyTo: formAddresses.teamInbox,
      delivery: `${FORM_DELIVERY} With marketing consent, the visitor is also added to the Resend audience (production only).`,
      attachments: null,
      source: 'packages/email/src/templates/contact-confirmation.ts',
      variants: [
        {
          label: 'Visitor',
          sample: contactConfirmationEmail({
            contact: SAMPLE_CONTACT,
            subject: 'Website redesign',
            message:
              'This is a sample message.\n\nWe are looking for help rebuilding our site and would like to talk through timelines.',
            replyTo: formAddresses.teamInbox,
          }),
        },
      ],
    },
    {
      id: 'audit-notification',
      status: 'active',
      name: 'Opportunity Audit — team notification',
      description:
        'Tells the team a visitor finished the Opportunity Audit and left their details. Same reading order as the contact notification, with the scored result and the full answer transcript.',
      portals: ['internal'],
      triggers: [
        'POST /api/integrations/audit-responses with status `captured` and `deliver: true` (sent by the marketing site’s BotID-gated server action, never by a progress beacon)',
      ],
      recipient: formAddresses.teamInbox,
      from: formAddresses.from,
      replyTo: 'The visitor’s address, so replying answers them directly',
      delivery: FORM_DELIVERY,
      attachments: null,
      source: 'packages/email/src/templates/audit-notification.ts',
      variants: [
        {
          label: 'Admin',
          sample: auditNotificationEmail({
            submissionUrl: `${internalOrigin}${submissionHref(SAMPLE_SUBMISSION_ID)}`,
            contact: { ...SAMPLE_CONTACT, website: null },
            message: 'Sample note: we would like to start in Q1.',
            result: SAMPLE_AUDIT_RESULT,
            transcript: [
              {
                prompt: 'How many people work at your company?',
                answer: '11–50',
              },
              {
                prompt: 'Where does your team lose the most time?',
                answer: 'Re-keying data, Building reports by hand',
              },
            ],
            source: SAMPLE_SOURCE,
            repeat: null,
          }),
        },
      ],
    },
    {
      id: 'audit-results',
      status: 'active',
      name: 'Opportunity Audit — visitor results',
      description:
        'The visitor’s copy of their audit result: business phase, summary, and where to start. Not sent when the stored audit has no scored result.',
      portals: ['internal'],
      triggers: ['Same request as the team notification'],
      recipient: 'The address entered on the audit’s capture form',
      from: formAddresses.from,
      replyTo: formAddresses.teamInbox,
      delivery: `${FORM_DELIVERY} With marketing consent, the visitor is also added to the Resend audience (production only).`,
      attachments: null,
      source: 'packages/email/src/templates/audit-results.ts',
      variants: [
        {
          label: 'Visitor',
          sample: auditResultsEmail({
            name: SAMPLE_CONTACT.name,
            result: SAMPLE_AUDIT_RESULT,
            replyTo: formAddresses.teamInbox,
          }),
        },
      ],
    },
  ]
}
