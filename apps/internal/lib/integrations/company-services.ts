import 'server-only'

import { serverEnv } from '@/lib/env.server'
import { getStripe } from '@/lib/stripe/client'
import type {
  CompanyService,
  CompanyServiceId,
} from '@/lib/types/integrations'

/** Every env var a service needs, and which of them are missing. */
function envState(vars: Record<string, string | undefined>) {
  const missing = Object.entries(vars)
    .filter(([, value]) => !value)
    .map(([name]) => name)
  return { envVars: Object.keys(vars), missing }
}

function configured(
  id: CompanyServiceId,
  vars: Record<string, string | undefined>,
  detail?: string
): CompanyService {
  const { envVars, missing } = envState(vars)
  if (missing.length === envVars.length) {
    return { id, status: 'not_configured', envVars }
  }
  if (missing.length > 0) {
    return {
      id,
      status: 'error',
      envVars,
      detail: `Missing ${missing.join(', ')}.`,
    }
  }
  return { id, status: 'configured', envVars, detail }
}

/**
 * Stripe is the one company service checked live: it takes the money and
 * carries each payment's sales tax, so a dead key matters right away.
 */
async function stripeStatus(): Promise<CompanyService> {
  const envVars = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET']
  const key = serverEnv.STRIPE_SECRET_KEY
  if (!key) {
    return { id: 'stripe', status: 'not_configured', envVars }
  }

  const mode = key.startsWith('sk_live_') || key.startsWith('rk_live_')
    ? 'Live mode'
    : 'Test mode'

  if (!serverEnv.STRIPE_WEBHOOK_SECRET) {
    return {
      id: 'stripe',
      status: 'error',
      envVars,
      detail: `${mode}. Missing STRIPE_WEBHOOK_SECRET, so paid invoices never get marked paid.`,
    }
  }

  try {
    const account = await getStripe().accounts.retrieveCurrent()
    const name =
      account.settings?.dashboard?.display_name ??
      account.business_profile?.name ??
      account.id
    return {
      id: 'stripe',
      status: 'connected',
      envVars,
      detail: `${name} · ${mode}`,
    }
  } catch (error) {
    console.error('Stripe status check failed', error)
    const statusCode =
      typeof error === 'object' && error !== null && 'statusCode' in error
        ? (error as { statusCode?: number }).statusCode
        : undefined
    return {
      id: 'stripe',
      status: 'error',
      envVars,
      detail:
        statusCode === 401 || statusCode === 403
          ? `Stripe rejected the key (${statusCode}).`
          : 'Stripe could not be reached.',
    }
  }
}

/** Company services configured in the server environment, in display order. */
export async function fetchCompanyServices(): Promise<CompanyService[]> {
  const stripe = await stripeStatus()

  return [
    stripe,
    configured(
      'resend',
      {
        RESEND_API_KEY: serverEnv.RESEND_API_KEY,
        RESEND_FROM_EMAIL: serverEnv.RESEND_FROM_EMAIL,
      },
      `Sends as ${serverEnv.RESEND_FROM_EMAIL}`
    ),
    configured('posthog', {
      NEXT_PUBLIC_POSTHOG_KEY: serverEnv.NEXT_PUBLIC_POSTHOG_KEY,
      NEXT_PUBLIC_POSTHOG_HOST: serverEnv.NEXT_PUBLIC_POSTHOG_HOST,
    }),
    configured('ai_gateway', {
      AI_GATEWAY_API_KEY: serverEnv.AI_GATEWAY_API_KEY,
    }),
    configured('github_app', {
      GITHUB_APP_ID: serverEnv.GITHUB_APP_ID,
      GITHUB_APP_PRIVATE_KEY: serverEnv.GITHUB_APP_PRIVATE_KEY,
    }),
    configured('google_chat', {
      GOOGLE_CHAT_SALES_WEBHOOK_URL: serverEnv.GOOGLE_CHAT_SALES_WEBHOOK_URL,
    }),
    configured('marketing_forms', {
      CONTACT_INTAKE_TOKEN: serverEnv.CONTACT_INTAKE_TOKEN,
      AUDIT_INTAKE_TOKEN: serverEnv.AUDIT_INTAKE_TOKEN,
    }),
  ]
}
