import { importPKCS8, SignJWT } from 'jose'
import { createPrivateKey } from 'node:crypto'
import type { InstallationToken, GitHubInstallation } from './types'

const GITHUB_API_BASE = 'https://api.github.com'

/**
 * Import a PEM private key that may be PKCS#1 (RSA PRIVATE KEY) or PKCS#8 (PRIVATE KEY).
 * GitHub App keys are generated as PKCS#1, but jose's importPKCS8 requires PKCS#8.
 */
async function importPrivateKey(pem: string) {
  if (pem.includes('BEGIN PRIVATE KEY')) {
    return importPKCS8(pem, 'RS256')
  }

  // Convert PKCS#1 to PKCS#8 via Node crypto
  const keyObject = createPrivateKey({ key: pem, format: 'pem' })
  const pkcs8Pem = keyObject
    .export({ type: 'pkcs8', format: 'pem' })
    .toString()
  return importPKCS8(pkcs8Pem, 'RS256')
}

/**
 * Generate a JWT for GitHub App authentication.
 * The JWT is used to authenticate as the GitHub App itself (not as an installation).
 * Valid for up to 10 minutes.
 */
export async function generateAppJwt(
  appId: string,
  privateKeyBase64: string
): Promise<string> {
  const privateKeyPem = Buffer.from(privateKeyBase64, 'base64').toString(
    'utf-8'
  )
  const privateKey = await importPrivateKey(privateKeyPem)

  const now = Math.floor(Date.now() / 1000)

  return new SignJWT({})
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuedAt(now - 60) // 60 seconds in the past to account for clock drift
    .setExpirationTime(now + 600) // 10 minutes
    .setIssuer(appId)
    .sign(privateKey)
}

/**
 * Exchange App JWT for an installation-scoped access token.
 * The token is valid for 1 hour and scoped to the installation's permissions.
 * Tokens are generated on-demand and never stored.
 */
export async function getInstallationToken(
  installationId: number,
  appId: string,
  privateKeyBase64: string
): Promise<InstallationToken> {
  const jwt = await generateAppJwt(appId, privateKeyBase64)

  const response = await fetch(
    `${GITHUB_API_BASE}/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: 'application/vnd.github.v3+json',
      },
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(
      `Failed to get installation token (${response.status}): ${error}`
    )
  }

  return response.json()
}

/**
 * Get installation details using the App JWT.
 */
export async function getInstallationById(
  installationId: number,
  appId: string,
  privateKeyBase64: string
): Promise<GitHubInstallation> {
  const jwt = await generateAppJwt(appId, privateKeyBase64)

  const response = await fetch(
    `${GITHUB_API_BASE}/app/installations/${installationId}`,
    {
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: 'application/vnd.github.v3+json',
      },
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(
      `Failed to get installation (${response.status}): ${error}`
    )
  }

  return response.json()
}
