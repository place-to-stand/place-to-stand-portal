/**
 * Proving a person can see a GitHub App installation (S2 in the PR #279
 * audit). An installation id in the install callback's URL is just a number
 * anyone can type, so the portal only saves one after the person signs in
 * to GitHub (OAuth, as the App) and GitHub lists that installation among
 * the ones their account can reach.
 */

const GITHUB_API_BASE = 'https://api.github.com'
const GITHUB_OAUTH_BASE = 'https://github.com/login/oauth'

/** GitHub's sign-in page for the App; it returns to the App's Callback URL. */
export function userAuthorizeUrl(clientId: string, state: string): string {
  const params = new URLSearchParams({ client_id: clientId, state })
  return `${GITHUB_OAUTH_BASE}/authorize?${params.toString()}`
}

/** Trades the callback's one-time `code` for a user access token. */
export async function exchangeUserCode(options: {
  clientId: string
  clientSecret: string
  code: string
}): Promise<string> {
  const response = await fetch(`${GITHUB_OAUTH_BASE}/access_token`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: options.clientId,
      client_secret: options.clientSecret,
      code: options.code,
    }),
  })
  const body = (await response.json().catch(() => null)) as {
    access_token?: string
    error?: string
  } | null
  if (!response.ok || !body?.access_token) {
    throw new Error(
      `GitHub code exchange failed (${response.status}): ${body?.error ?? 'no token'}`
    )
  }
  return body.access_token
}

/**
 * True when the signed-in GitHub user can reach this installation of the
 * App (GitHub's `GET /user/installations` lists only those).
 */
export async function userCanAccessInstallation(
  userToken: string,
  installationId: number
): Promise<boolean> {
  for (let page = 1; page <= 10; page += 1) {
    const response = await fetch(
      `${GITHUB_API_BASE}/user/installations?per_page=100&page=${page}`,
      {
        headers: {
          Authorization: `Bearer ${userToken}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      }
    )
    if (!response.ok) {
      throw new Error(
        `Failed to list the user's installations (${response.status})`
      )
    }
    const body = (await response.json()) as {
      total_count: number
      installations: { id: number }[]
    }
    if (body.installations.some(item => item.id === installationId)) {
      return true
    }
    if (page * 100 >= body.total_count || !body.installations.length) {
      return false
    }
  }
  return false
}

/** Revokes a user token once it has done its one check (best effort). */
export async function revokeUserToken(options: {
  clientId: string
  clientSecret: string
  token: string
}): Promise<void> {
  const basic = Buffer.from(
    `${options.clientId}:${options.clientSecret}`
  ).toString('base64')
  try {
    await fetch(`${GITHUB_API_BASE}/applications/${options.clientId}/token`, {
      method: 'DELETE',
      headers: {
        Authorization: `Basic ${basic}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ access_token: options.token }),
    })
  } catch (error) {
    console.error('Failed to revoke a GitHub user token', error)
  }
}
