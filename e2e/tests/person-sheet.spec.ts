import { expect, test, type Page, type Request } from '@playwright/test'

import { expectHealthy } from './helpers'

/**
 * The person sheet: create and edit are the same sheet (Sign-in included
 * for admins), Save is one request (one server action, one transaction),
 * and a role change asks which month it starts.
 */

const isServerAction = (request: Request) =>
  request.method() === 'POST' && Boolean(request.headers()['next-action'])

/** Records every server-action request from now on. */
function recordServerActions(page: Page) {
  const actions: Request[] = []
  const listener = (request: Request) => {
    if (isServerAction(request)) actions.push(request)
  }
  page.on('request', listener)
  return { actions, stop: () => page.off('request', listener) }
}

test('changing a role asks which month it starts', async ({ page }) => {
  // The sales test account has a sign-in (and isn't the admin running this).
  const salesEmail = process.env.E2E_SALES_EMAIL ?? 'dave@local.test'
  await page.goto(`/people?q=${encodeURIComponent(salesEmail)}`)
  await expectHealthy(page)
  await page.locator('tbody tr').first().click()
  const sheet = page.getByRole('dialog')
  await expect(sheet.getByText('Can sign in')).toBeVisible()

  const roleStarts = sheet.getByRole('combobox', { name: 'Role starts' })
  await expect(roleStarts).toHaveCount(0)

  await sheet.getByRole('combobox', { name: 'Role', exact: true }).click()
  await page.getByRole('option', { name: 'Admin' }).click()
  await expect(roleStarts).toBeVisible()
  await expect(roleStarts).toContainText('(this month)')

  await roleStarts.click()
  await expect(
    page.getByRole('option', { name: /\(next month\)/ })
  ).toBeVisible()
  await expect(page.getByRole('option', { name: /October 2025/ })).toBeVisible()
  await page.keyboard.press('Escape')

  // Close without saving: the role change counts as unsaved.
  await page.keyboard.press('Escape')
  await expect(page.getByText('Discard changes?')).toBeVisible()
})

test('stopping being Admin starts next month, and warns about this month', async ({
  page,
}) => {
  // Another admin: you can't change your own sign-in.
  const adminEmail = process.env.E2E_ADMIN_EMAIL ?? 'jason@local.test'
  await page.goto('/people?signIn=ADMIN')
  await expectHealthy(page)
  const rows = page.locator('tbody tr').filter({ hasNotText: adminEmail })
  test.skip((await rows.count()) === 0, 'needs a second person with an Admin sign-in')
  await rows.first().click()
  const sheet = page.getByRole('dialog')
  await expect(sheet.getByText('Can sign in')).toBeVisible()
  const role = sheet.getByRole('combobox', { name: 'Role', exact: true })
  await expect(role).toContainText('Admin')

  await role.click()
  await page.getByRole('option', { name: 'Sales' }).click()
  const roleStarts = sheet.getByRole('combobox', { name: 'Role starts' })
  await expect(roleStarts).toContainText('(next month)')
  const warning = sheet.getByText('Their hours this month won’t count as payroll.')
  await expect(warning).toHaveCount(0)

  await roleStarts.click()
  await page.getByRole('option', { name: /\(this month\)/ }).click()
  await expect(roleStarts).toContainText('(this month)')
  await expect(warning).toBeVisible()

  // Back to Admin: no month to pick. Leave without saving.
  await role.click()
  await page.getByRole('option', { name: 'Admin' }).click()
  await expect(roleStarts).toHaveCount(0)
  await page.keyboard.press('Escape')
})

test.describe('writes', () => {
  test.skip(!process.env.E2E_WRITES, 'set E2E_WRITES=1 on a throwaway database')

  test('creating a person with a client sign-in is one request on Save', async ({
    page,
  }) => {
    const stamp = Date.now()
    const name = `E2E person ${stamp}`
    const email = `e2e-person-${stamp}@local.test`

    await page.goto('/people?contact=new')
    const sheet = page.getByRole('dialog')
    await expect(sheet).toBeVisible()

    const beforeSave = recordServerActions(page)
    await sheet.getByPlaceholder('John Doe').fill(name)
    await sheet.getByPlaceholder('contact@example.com').fill(email)
    // Create shows the same Sign-in section as edit.
    await sheet.getByRole('switch', { name: 'Can sign in' }).click()
    await expect(
      sheet.getByRole('combobox').filter({ hasText: 'Client' })
    ).toBeVisible()
    await expect(
      sheet.getByText(`creates a client portal sign-in for ${email}`)
    ).toBeVisible()
    beforeSave.stop()
    expect(beforeSave.actions.map(request => request.url())).toEqual([])

    // Count what Save sends before its answer arrives: the list's own
    // refresh afterwards is a read, not part of the save.
    const onSave = recordServerActions(page)
    const answered = page.waitForResponse(
      response =>
        response.request().method() === 'POST' &&
        Boolean(response.request().headers()['next-action'])
    )
    await sheet.getByRole('button', { name: 'Create person' }).click()
    await answered
    onSave.stop()
    expect(onSave.actions).toHaveLength(1)
    await expect(sheet).toBeHidden()

    // Saved together: the new person has a Client sign-in.
    await page.goto(`/people?q=${encodeURIComponent(email)}`)
    const row = page.locator('tbody tr').first()
    await expect(row).toContainText(name)
    await expect(
      row.locator('[data-slot="badge"]', { hasText: 'Client' })
    ).toBeVisible()

    // Put it back: archiving the person switches their sign-in off.
    await row.click()
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Archive person' })
      .click()
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Archive' })
      .click()
    await expect(page.getByRole('dialog')).toBeHidden()
  })
})
