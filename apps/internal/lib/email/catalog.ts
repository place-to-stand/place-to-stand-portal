import 'server-only'

import {
  adminInviteEmail,
  invoiceEmail,
  magicLinkEmail,
  passwordChangedEmail,
  passwordResetEmail,
  portalInviteEmail,
  type RenderedEmail,
} from '@pts/email'
import { serverEnv } from '@/lib/env.server'
import type { TemplateAudience } from '@/lib/templates/audience'

import { buildFormEmailEntries } from './catalog-forms'

type EmailTemplateVariant = {
  /** Whose copy of the template this is; a template has one per audience. */
  audience: TemplateAudience
  sample: RenderedEmail
}

type EmailTemplateStatus = 'active' | 'disabled'

/** The flow an email belongs to; the list is sectioned by it. */
export type EmailTemplateGroup =
  'accounts' | 'contact-form' | 'audit' | 'client'

export type EmailTemplateEntry = {
  id: string
  group: EmailTemplateGroup
  /** Short enough to read under its group heading, e.g. "Team notification". */
  name: string
  description: string
  /** One plain sentence on when it goes out: no routes, flags, or file paths. */
  overview: string
  /** Whether any code path actually sends it today. */
  status: EmailTemplateStatus
  triggers: string[]
  recipient: string
  from: string
  replyTo: string
  delivery: string
  attachments: string | null
  /** Where the copy lives, relative to the repo root. */
  source: string
  variants: EmailTemplateVariant[]
}

/**
 * Mirrors the wrappers in `lib/email/auth-emails.ts` (internal) and
 * `apps/client/lib/email/auth-emails.ts` (client). Both read Supabase's
 * `otp_expiry` (3600s) so the copy states the window the token actually has.
 */
const LINK_EXPIRY_MINUTES = 60
const INTERNAL_DESTINATION = 'the Place To Stand internal portal'
const CLIENT_DESTINATION = 'the Place To Stand client portal'

const INTERNAL_SDK_DELIVERY =
  'Resend SDK through lib/email/send.ts; routed to Mailpit outside production'
const CLIENT_HTTP_DELIVERY =
  'Resend HTTP API through the @pts/email transport; routed to Mailpit outside production'

/**
 * Renders every outbound email with placeholder data so the catalog page can
 * show exactly what recipients get. Sample values are obviously fake on
 * purpose — nothing here should be mistaken for a real link or credential.
 */
export function buildEmailTemplateCatalog(): EmailTemplateEntry[] {
  const from = `Place To Stand <${serverEnv.RESEND_FROM_EMAIL}>`
  const replyTo = serverEnv.RESEND_REPLY_TO_EMAIL
  const internalOrigin = new URL(serverEnv.GOOGLE_REDIRECT_URI).origin
  const clientOrigin = serverEnv.CLIENT_PORTAL_URL

  const authVariants = (
    render: (destination: string, origin: string) => RenderedEmail
  ): EmailTemplateVariant[] => [
    {
      audience: 'team',
      sample: render(INTERNAL_DESTINATION, internalOrigin),
    },
    {
      audience: 'client',
      sample: render(CLIENT_DESTINATION, clientOrigin),
    },
  ]

  return [
    {
      id: 'magic-link',
      overview: 'Sent when someone asks for a sign-in link.',
      group: 'accounts',
      status: 'active',
      name: 'Magic link sign-in',
      description:
        'A one-time sign-in link. The link itself comes from Supabase; only the wrapper email is ours.',
      triggers: ['"Email me a sign-in link" on either sign-in page'],
      recipient:
        'The address entered on the sign-in form, only if a user exists',
      from,
      replyTo,
      delivery: `Admin: ${INTERNAL_SDK_DELIVERY}. Client: ${CLIENT_HTTP_DELIVERY}.`,
      attachments: null,
      source: 'packages/email/src/templates/magic-link.ts',
      variants: authVariants((destination, origin) =>
        magicLinkEmail({
          actionLink: `${origin}/auth/confirm?token_hash=sample-token&type=magiclink`,
          destination,
          expiresInMinutes: LINK_EXPIRY_MINUTES,
          replyTo,
        })
      ),
    },
    {
      id: 'password-reset',
      overview: 'Sent when someone forgets their password.',
      group: 'accounts',
      status: 'active',
      name: 'Password reset',
      description:
        'Recovery link for the forgot-password flow. Replaces the stock Supabase reset email, which was getting flagged as phishing.',
      triggers: ['Forgot-password form on either portal'],
      recipient: 'The address entered on the form, only if a user exists',
      from,
      replyTo,
      delivery: `Admin: ${INTERNAL_SDK_DELIVERY}. Client: ${CLIENT_HTTP_DELIVERY}.`,
      attachments: null,
      source: 'packages/email/src/templates/password-reset.ts',
      variants: authVariants((destination, origin) =>
        passwordResetEmail({
          actionLink: `${origin}/auth/confirm?token_hash=sample-token&type=recovery`,
          destination,
          expiresInMinutes: LINK_EXPIRY_MINUTES,
          replyTo,
        })
      ),
    },
    {
      id: 'password-changed',
      overview: 'Sent after someone changes their password.',
      group: 'accounts',
      status: 'active',
      name: 'Password changed',
      description:
        'Confirmation sent after a password change has already taken effect. Carries no link on purpose. Supabase’s own notice is disabled so only one message lands.',
      triggers: [
        'Admin: forced password reset, or changing the password from the profile sheet',
        'Client: forced password reset, or setting a password in the onboarding wizard',
      ],
      recipient: 'The signed-in user’s email',
      from,
      replyTo,
      delivery: `Admin: ${INTERNAL_SDK_DELIVERY}. Client: ${CLIENT_HTTP_DELIVERY}.`,
      attachments: null,
      source: 'packages/email/src/templates/password-changed.ts',
      variants: authVariants(destination =>
        passwordChangedEmail({ destination, replyTo })
      ),
    },
    {
      id: 'portal-invite',
      overview: 'Sent when a person is given client portal access.',
      group: 'accounts',
      status: 'active',
      name: 'Client portal invite',
      description:
        'Welcomes a new client portal user with a one-time sign-in link. Sent from the internal portal, but lands with people at the client.',
      triggers: [
        'Promoting a person to a portal user',
        'Turning on “Can sign in” with the Client role on a person',
      ],
      recipient: 'The new portal user',
      from,
      replyTo,
      delivery: INTERNAL_SDK_DELIVERY,
      attachments: null,
      source: 'packages/email/src/templates/portal-invite.ts',
      variants: [
        {
          audience: 'client',
          sample: portalInviteEmail({
            fullName: 'Jordan Sample',
            actionLink: `${clientOrigin}/auth/confirm?token_hash=sample-token&type=magiclink`,
            signInUrl: `${clientOrigin}/sign-in`,
            expiresInMinutes: LINK_EXPIRY_MINUTES,
            replyTo,
          }),
        },
      ],
    },
    {
      id: 'admin-invite',
      overview: 'Sent when a new admin is added.',
      group: 'accounts',
      status: 'active',
      name: 'Admin invite',
      description:
        'Gives a new admin a temporary password. They are forced through a password reset on first sign-in.',
      triggers: [
        'Turning on “Can sign in” with the Admin or Sales role on a person',
      ],
      recipient: 'The new admin user',
      from,
      replyTo,
      delivery: INTERNAL_SDK_DELIVERY,
      attachments: null,
      source: 'packages/email/src/templates/admin-invite.ts',
      variants: [
        {
          audience: 'team',
          sample: adminInviteEmail({
            email: 'new.admin@example.com',
            fullName: 'Jordan Sample',
            temporaryPassword: 'sample-temporary-password',
            signInUrl: `${internalOrigin}/sign-in`,
            replyTo,
          }),
        },
      ],
    },
    ...buildFormEmailEntries(internalOrigin),
    {
      id: 'invoice',
      overview: 'Sent when an admin sends a client an invoice.',
      group: 'client',
      status: 'active',
      name: 'Invoice',
      description:
        'An invoice for a client: the admin’s own note, the invoice number, amount due and issue date, and one button to the public share page where the client views and pays. Every field is editable in the send dialog before it goes out.',
      triggers: [
        'Send to client on a draft invoice (also marks it sent)',
        'Email again on a sent or viewed invoice (a reminder; the status is unchanged)',
      ],
      recipient:
        'The client’s primary contact, with the sending admin cc’d — both editable before sending',
      from,
      replyTo: 'The signed-in admin’s email address',
      delivery: INTERNAL_SDK_DELIVERY,
      attachments: null,
      source: 'packages/email/src/templates/invoice.ts',
      variants: [
        {
          audience: 'client',
          sample: invoiceEmail({
            subject: 'Invoice INV-0042 from Place To Stand',
            clientName: 'Sample Co',
            invoiceNumber: 'INV-0042',
            amountDue: '$1,000.00',
            issuedDate: 'Sep 28, 2026',
            message:
              "Hi Jordan,\n\nHere's invoice INV-0042 for $1,000.00. You can view the details and pay online with the button below.\n\nThanks,\nAlex",
            viewUrl: `${internalOrigin}/share/invoices/sample-token`,
            replyTo: 'admin@example.com',
          }),
        },
      ],
    },
  ]
}
