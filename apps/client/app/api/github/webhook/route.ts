import { NextResponse, type NextRequest } from 'next/server'
import { eq } from 'drizzle-orm'
import { createHmac, timingSafeEqual } from 'crypto'

import { db } from '@/lib/db'
import { githubAppInstallations } from '@pts/db/schema'
import { getEnv } from '@/lib/env.server'

/**
 * POST /api/github/webhook
 *
 * Receives webhook events from GitHub for the GitHub App.
 * Handles: installation, installation_repositories events.
 */
export async function POST(request: NextRequest) {
  const env = getEnv()

  // Verify webhook signature
  const signature = request.headers.get('x-hub-signature-256')
  const body = await request.text()

  if (!signature || !verifySignature(body, signature, env.GITHUB_APP_WEBHOOK_SECRET)) {
    return NextResponse.json(
      { ok: false, error: 'Invalid signature' },
      { status: 401 }
    )
  }

  const event = request.headers.get('x-github-event')
  const payload = JSON.parse(body)

  switch (event) {
    case 'installation':
      await handleInstallationEvent(payload)
      break
    case 'installation_repositories':
      // Repository selection changed — no DB update needed currently.
      // The installation token will automatically scope to the updated repos.
      break
    default:
      // Ignore unhandled events
      break
  }

  return NextResponse.json({ ok: true })
}

async function handleInstallationEvent(payload: {
  action: string
  installation: {
    id: number
    account: {
      login: string
      id: number
      avatar_url: string
      type: string
    }
    permissions: Record<string, string>
    events: string[]
    repository_selection: string
    suspended_at: string | null
  }
}) {
  const { action, installation } = payload

  switch (action) {
    case 'created':
      // Installation was already saved in the callback route.
      // This webhook fires as a confirmation — update if needed.
      await db
        .update(githubAppInstallations)
        .set({
          permissions: installation.permissions,
          events: installation.events,
          repositorySelection: installation.repository_selection,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(githubAppInstallations.installationId, installation.id))
      break

    case 'deleted':
      await db
        .update(githubAppInstallations)
        .set({
          status: 'REMOVED',
          deletedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(githubAppInstallations.installationId, installation.id))
      break

    case 'suspend':
      await db
        .update(githubAppInstallations)
        .set({
          status: 'SUSPENDED',
          suspendedAt: installation.suspended_at ?? new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(githubAppInstallations.installationId, installation.id))
      break

    case 'unsuspend':
      await db
        .update(githubAppInstallations)
        .set({
          status: 'ACTIVE',
          suspendedAt: null,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(githubAppInstallations.installationId, installation.id))
      break

    case 'new_permissions_accepted':
      await db
        .update(githubAppInstallations)
        .set({
          permissions: installation.permissions,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(githubAppInstallations.installationId, installation.id))
      break
  }
}

function verifySignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const hmac = createHmac('sha256', secret)
  hmac.update(payload)
  const expected = `sha256=${hmac.digest('hex')}`

  try {
    return timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    )
  } catch {
    return false
  }
}
