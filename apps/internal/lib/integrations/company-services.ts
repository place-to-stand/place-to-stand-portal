import 'server-only'

import { serverEnv } from '@/lib/env.server'
import {
  MercuryApiError,
  fetchMercuryAccounts,
} from '@/lib/integrations/mercury/api'
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
 * Stripe and Mercury are checked live: they hold the money, so a dead key
 * matters right away. The rest only report whether their variables are set.
 */
async function stripeStatus(): Promise<CompanyService> {
  const envVars = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET']
  const key = serverEnv.STRIPE_SECRET_KEY
  if (!key) {
    return { id: 'stripe', status: 'not_configured', envVars }
  }

  const mode =
    key.startsWith('sk_live_') || key.startsWith('rk_live_') ? 'Live' : 'Test'

  if (!serverEnv.STRIPE_WEBHOOK_SECRET) {
    return {
      id: 'stripe',
      status: 'error',
      envVars,
      detail: `${mode} mode. Missing STRIPE_WEBHOOK_SECRET, so paid invoices never get marked paid.`,
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

async function mercuryStatus(): Promise<CompanyService> {
  const envVars = ['MERCURY_API_TOKEN']
  const token = serverEnv.MERCURY_API_TOKEN
  if (!token) {
    return { id: 'mercury', status: 'not_configured', envVars }
  }

  try {
    const accounts = await fetchMercuryAccounts(token)
    return {
      id: 'mercury',
      status: 'connected',
      envVars,
      detail: `${accounts.length} account${accounts.length === 1 ? '' : 's'}`,
    }
  } catch (error) {
    console.error('Mercury status check failed', error)
    return {
      id: 'mercury',
      status: 'error',
      envVars,
      detail:
        error instanceof MercuryApiError
          ? error.status === 401 || error.status === 403
            ? `Mercury rejected the token (${error.status}).`
            : `${error.message}.`
          : 'Mercury could not be reached.',
    }
  }
}

/** Company services configured in the server environment. */
export async function fetchCompanyServices(): Promise<CompanyService[]> {
  const [stripe, mercury] = await Promise.all([stripeStatus(), mercuryStatus()])

  return [
    stripe,
    mercury,
    configured(
      'resend',
      {
        RESEND_API_KEY: serverEnv.RESEND_API_KEY,
        RESEND_FROM_EMAIL: serverEnv.RESEND_FROM_EMAIL,
      },
      serverEnv.RESEND_FROM_EMAIL
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
