import { NextResponse, type NextRequest } from 'next/server'
import { and, eq, ne } from 'drizzle-orm'
import { createHmac, timingSafeEqual } from 'crypto'

import { db } from '@/lib/db'
import { githubAppInstallations } from '@pts/db/schema'
import { getGitHubAppEnv } from '@/lib/env.server'
import {
  getInstallationById,
  isInstallationNotFoundError,
} from '@pts/github/app-auth'

/**
 * POST /api/github/webhook
 *
 * Receives webhook events from GitHub for the GitHub App.
 * Handles: installation, installation_repositories events.
 */
export async function POST(request: NextRequest) {
  const env = getGitHubAppEnv()

  // Verify webhook signature
  const signature = request.headers.get('x-hub-signature-256')
  const body = await request.text()

  if (
    !signature ||
    !verifySignature(body, signature, env.GITHUB_APP_WEBHOOK_SECRET)
  ) {
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

  // A signed body carries no timestamp, so anyone who sees one can replay
  // it. Before changing an installation's status, ask GitHub what it is now
  // and apply the event only if it matches.
  let liveSuspendedAt: string | null = null
  if (action === 'deleted' || action === 'suspend' || action === 'unsuspend') {
    const live = await fetchLiveInstallation(installation.id)
    if (live.state === 'unknown') return
    const expected =
      action === 'deleted'
        ? 'removed'
        : action === 'suspend'
          ? 'suspended'
          : 'active'
    if (live.state !== expected) return
    liveSuspendedAt = live.suspendedAt
  }

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

    // A removed install stays removed: GitHub can redeliver an older
    // suspend or unsuspend after the delete, and that must not revive it.
    case 'suspend':
      await db
        .update(githubAppInstallations)
        .set({
          status: 'SUSPENDED',
          suspendedAt: liveSuspendedAt ?? new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(
          and(
            eq(githubAppInstallations.installationId, installation.id),
            ne(githubAppInstallations.status, 'REMOVED')
          )
        )
      break

    case 'unsuspend':
      await db
        .update(githubAppInstallations)
        .set({
          status: 'ACTIVE',
          suspendedAt: null,
          updatedAt: new Date().toISOString(),
        })
        .where(
          and(
            eq(githubAppInstallations.installationId, installation.id),
            ne(githubAppInstallations.status, 'REMOVED')
          )
        )
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

type LiveInstallation =
  | { state: 'removed' | 'unknown'; suspendedAt: null }
  | { state: 'active' | 'suspended'; suspendedAt: string | null }

/**
 * The installation as GitHub has it now: `removed` on a 404, `unknown` when
 * GitHub can't be asked (the event is then ignored; the repos and link
 * routes still self-heal a removed installation on their next call).
 */
async function fetchLiveInstallation(
  installationId: number
): Promise<LiveInstallation> {
  const env = getGitHubAppEnv()
  try {
    const live = await getInstallationById(
      installationId,
      env.GITHUB_APP_ID,
      env.GITHUB_APP_PRIVATE_KEY
    )
    return live.suspended_at
      ? { state: 'suspended', suspendedAt: live.suspended_at }
      : { state: 'active', suspendedAt: null }
  } catch (error) {
    if (isInstallationNotFoundError(error)) {
      return { state: 'removed', suspendedAt: null }
    }
    console.error('Failed to check GitHub installation state', error)
    return { state: 'unknown', suspendedAt: null }
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
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  } catch {
    return false
  }
}
