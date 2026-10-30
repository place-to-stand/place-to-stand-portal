import { expect, test, type Request } from '@playwright/test'

/**
 * The project sheet saves everything — the project row, its members and its
 * repo/hosting links — in one server action (one database transaction).
 * Changes data: runs only with E2E_WRITES=1 on a throwaway database, and
 * archives the project it creates.
 */
test.skip(!process.env.E2E_WRITES, 'set E2E_WRITES=1 on a throwaway database')

const isServerAction = (request: Request) =>
  request.method() === 'POST' && Boolean(request.headers()['next-action'])

const isLinkRestCall = (request: Request) =>
  request.method() !== 'GET' &&
  /\/api\/projects\/[^/]+\/(github-repos|integration-links)/.test(request.url())

test('project: create with a member in one save', async ({ page }) => {
  const name = `E2E project ${Date.now()}`

  await page.goto('/projects?project=new')
  const sheet = page.getByRole('dialog')
  await expect(sheet).toBeVisible()

  await sheet.getByRole('textbox', { name: 'Name' }).fill(name)
  // Create shows the same fields as edit, slug included (blank = from name).
  await expect(sheet.getByRole('textbox', { name: /^Slug/ })).toBeVisible()

  // An internal project needs no client.
  await sheet.getByRole('combobox', { name: 'Project type' }).click()
  await page.getByRole('option', { name: 'Internal project' }).click()

  // Wait for the members list to load, then add the first sales user.
  await expect(
    sheet.getByText(/^(No members yet|No sales staff yet)\.$/)
  ).toBeVisible()
  test.skip(
    (await sheet.getByText('No sales staff yet.').count()) > 0,
    'needs at least one sales user'
  )
  await sheet.getByRole('button', { name: 'Add member' }).first().click()
  const firstCandidate = page.getByRole('option').first()
  const memberName = ((await firstCandidate.textContent()) ?? '').trim()
  await firstCandidate.click()
  await expect(sheet.getByRole('button', { name: `Remove ${memberName}` }))
    .toBeVisible()

  // Count only what Save sends.
  const actions: Request[] = []
  const linkCalls: Request[] = []
  page.on('request', request => {
    if (isServerAction(request)) actions.push(request)
    if (isLinkRestCall(request)) linkCalls.push(request)
  })

  const saveResponse = page.waitForResponse(
    response => isServerAction(response.request()) && response.ok()
  )
  await sheet.getByRole('button', { name: /^Create project/ }).click()
  const body = await (await saveResponse).text()
  await expect(sheet).toBeHidden()

  expect(actions).toHaveLength(1)
  expect(linkCalls).toHaveLength(0)

  const projectId = body.match(/"projectId":"([0-9a-f-]{36})"/)?.[1]
  expect(projectId, 'saveProject returns the new id').toBeTruthy()

  // Reopen: the member was saved with the project.
  await page.goto(`/projects?project=${projectId}`)
  const edit = page.getByRole('dialog')
  await expect(edit.getByRole('textbox', { name: 'Name' })).toHaveValue(name)
  await expect(edit.getByRole('button', { name: `Remove ${memberName}` }))
    .toBeVisible()

  // Put it back: archive the project.
  await edit.getByRole('button', { name: 'Archive project' }).click()
  await page.getByRole('button', { name: 'Archive', exact: true }).click()
  await expect(edit).toBeHidden()
})
