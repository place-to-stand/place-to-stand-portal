import { expect, test, type Page, type Request } from '@playwright/test'

import { expectHealthy } from './helpers'

/**
 * The person sheet: create and edit are the same sheet (Access included),
 * Save is one request (one server action, one transaction), and a role
 * change asks which month it starts.
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
  await page.locator('tbody tr').first().locator('td').first().click()
  const sheet = page.getByRole('dialog')
  // A Sales sign-in is Team access.
  await expect(sheet.getByRole('radio', { name: 'Team' })).toBeChecked()
  await expect(
    sheet.getByText('Signs in to this portal as Sales', { exact: false })
  ).toBeVisible()

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
  // Only next month, this month and at most one open earlier month.
  // Month options only (the Role list may still be closing).
  const options = page.getByRole('option', { name: /\d{4}/ })
  expect(await options.count()).toBeGreaterThanOrEqual(2)
  expect(await options.count()).toBeLessThanOrEqual(3)
  await page.keyboard.press('Escape')

  // Staff: no client portal on offer.
  await expect(sheet.getByRole('radio', { name: 'Client portal' })).toHaveCount(
    0
  )
  // No access: no month to pick, and they can't sign in.
  await sheet.getByRole('radio', { name: 'No access' }).click()
  await expect(roleStarts).toHaveCount(0)
  await expect(sheet.getByText('Can’t sign in.')).toBeVisible()
  await expect(
    sheet.getByText('won’t be able to sign in once you save.', { exact: false })
  ).toBeVisible()

  // Close without saving: the change counts as unsaved.
  await page.keyboard.press('Escape')
  await expect(page.getByText('Discard changes?')).toBeVisible()
})

test('a client sign-in is Client portal access, ticked by company', async ({
  page,
}) => {
  await page.goto('/people?role=CLIENT')
  await expectHealthy(page)
  const rows = page
    .locator('tbody tr')
    .filter({ has: page.locator('[data-slot="badge"]', { hasText: 'Client' }) })
  test.skip((await rows.count()) === 0, 'needs a person with a client sign-in')
  await rows.first().locator('td').first().click()
  const sheet = page.getByRole('dialog')
  const portal = sheet.getByRole('radio', { name: 'Client portal' })
  await expect(portal).toBeChecked()
  await expect(
    sheet.getByText('Signs in to the client portal as', { exact: false })
  ).toBeVisible()
  await expect(sheet.getByText('Sign-in email')).toBeVisible()
  // Which companies they see: each client company card's switch, on now.
  await expect(
    sheet.getByRole('switch', { name: /^Portal access at / }).first()
  ).toBeEnabled()

  // Client portal to Team is a role change: it asks which month.
  await sheet.getByRole('radio', { name: 'Team' }).click()
  await expect(
    sheet.getByRole('combobox', { name: 'Role', exact: true })
  ).toBeVisible()
  await expect(
    sheet.getByRole('combobox', { name: 'Role starts' })
  ).toBeVisible()
  await expect(sheet.getByText('Sign-in email')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(page.getByText('Discard changes?')).toBeVisible()
})

test('stopping being Admin starts next month, and warns about this month', async ({
  page,
}) => {
  // Another admin: you can't change your own sign-in.
  const adminEmail = process.env.E2E_ADMIN_EMAIL ?? 'jason@local.test'
  await page.goto('/people?role=ADMIN')
  await expectHealthy(page)
  // A live Admin sign-in (a switched-off one is No access).
  const rows = page
    .locator('tbody tr')
    .filter({ hasNotText: adminEmail })
    .filter({ has: page.locator('[data-slot="badge"]', { hasText: 'Admin' }) })
  test.skip(
    (await rows.count()) === 0,
    'needs a second person with an Admin sign-in'
  )
  await rows.first().locator('td').first().click()
  const sheet = page.getByRole('dialog')
  await expect(sheet.getByRole('radio', { name: 'Team' })).toBeChecked()
  const role = sheet.getByRole('combobox', { name: 'Role', exact: true })
  await expect(role).toContainText('Admin')

  await role.click()
  await page.getByRole('option', { name: 'Sales' }).click()
  const roleStarts = sheet.getByRole('combobox', { name: 'Role starts' })
  await expect(roleStarts).toContainText('(next month)')
  const warning = sheet.getByText(
    'Their hours this month won’t count as payroll.'
  )
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
    // Create shows the same Access section as edit.
    await expect(sheet.getByRole('radio', { name: 'No access' })).toBeChecked()
    await sheet.getByRole('radio', { name: 'Client portal' }).click()
    await expect(
      sheet.getByText(
        `Signs in to the client portal as ${email} · sees no companies yet.`
      )
    ).toBeVisible()
    await expect(
      sheet.getByText(
        `${name} will get a client portal sign-in (${email}) and an email link when you save.`
      )
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
    await row.locator('td').first().click()
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

  test('a save over someone else’s newer save is refused', async ({
    page,
    context,
  }) => {
    const stamp = Date.now()
    const name = `E2E concurrent ${stamp}`
    const email = `e2e-concurrent-${stamp}@local.test`

    // A throwaway person, archived at the end.
    await page.goto('/people?contact=new')
    const created = page.getByRole('dialog')
    await created.getByPlaceholder('John Doe').fill(name)
    await created.getByPlaceholder('contact@example.com').fill(email)
    await created.getByRole('button', { name: 'Create person' }).click()
    await expect(created).toBeHidden()

    // Two tabs open the same person (each waits for the sheet's load,
    // which carries the version Save sends back).
    const openPerson = async (tab: Page) => {
      await tab.goto(`/people?q=${encodeURIComponent(email)}`)
      await tab
        .locator('tbody tr')
        .filter({ hasText: name })
        .first()
        .locator('td')
        .first()
        .click()
      const sheet = tab.getByRole('dialog')
      await expect(sheet.getByPlaceholder('John Doe')).toHaveValue(name)
      await tab.waitForLoadState('networkidle')
      return sheet
    }
    const other = await context.newPage()
    const first = await openPerson(page)
    const second = await openPerson(other)

    // The first tab saves.
    await first
      .getByPlaceholder('linkedin.com/in/jane-doe')
      .fill(`linkedin.com/in/first-${stamp}`)
    await first.getByRole('button', { name: 'Save changes' }).click()
    await expect(first).toBeHidden()

    // The second, loaded before that save, is refused with a toast and
    // stays open.
    await second
      .getByPlaceholder('linkedin.com/in/jane-doe')
      .fill(`linkedin.com/in/second-${stamp}`)
    await second.getByRole('button', { name: 'Save changes' }).click()
    await expect(
      other.getByText(
        'Someone else saved this person. Reload to see their changes.'
      )
    ).toBeVisible()
    await expect(second).toBeVisible()
    await other.close()

    // The first save stands; then put it back (archive the person).
    const reopened = await openPerson(page)
    await expect(
      reopened.getByPlaceholder('linkedin.com/in/jane-doe')
    ).toHaveValue(new RegExp(`linkedin\\.com/in/first-${stamp}$`))
    await reopened.getByRole('button', { name: 'Archive person' }).click()
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Archive' })
      .click()
    await expect(page.getByRole('dialog')).toBeHidden()
  })
})
