// Run: npx tsx --test apps/internal/lib/oauth/state.test.mts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { oauthLandingPath, safeReturnPath } from './state-path.ts'

test('keeps a path inside the portal', () => {
  assert.equal(
    safeReturnPath('/leads?lead=11111111-1111-4111-8111-111111111111'),
    '/leads?lead=11111111-1111-4111-8111-111111111111'
  )
})

test('never sends anyone to another site', () => {
  for (const bad of [
    '//evil.com',
    '/\\evil.com',
    '/\t/evil.com',
    '/\n/evil.com',
    '/\r/evil.com',
    'https://evil.com',
    'evil.com',
    '',
    null,
  ]) {
    const result = safeReturnPath(bad)
    assert.ok(result === null || result.startsWith('/'), String(bad))
    if (result) assert.ok(!result.startsWith('//'), String(bad))
  }
  assert.equal(safeReturnPath('/\t/evil.com'), null)
  assert.equal(safeReturnPath('//evil.com'), null)
})

test('an OAuth result lands on the Account sheet it came from', () => {
  assert.equal(
    oauthLandingPath(null, { success: 'github_connected' }),
    '/my/home?account=integrations&success=github_connected'
  )
  assert.equal(
    oauthLandingPath('/projects/a/b/tasks?project=x&account=integrations', {
      error: 'oauth_failed',
    }),
    '/projects/a/b/tasks?project=x&account=integrations&error=oauth_failed'
  )
  assert.equal(
    oauthLandingPath('/my/home?account=integrations&error=old', {
      success: 'google_connected',
    }),
    '/my/home?account=integrations&success=google_connected'
  )
  // A lead's Emails section reads its own result; the URL stays clean.
  assert.equal(
    oauthLandingPath('/leads?lead=1', { success: 'google_connected' }),
    '/leads?lead=1'
  )
})
