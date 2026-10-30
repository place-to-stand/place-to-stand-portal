import path from 'node:path'

import { expect, test, type Page } from '@playwright/test'

import { expectHealthy } from './helpers'

// Sales: the CRM plus projects they're a member of (projects.view_member).
test('sales sees the CRM and member projects only', async ({ page }) => {
  await page.goto('/leads')
  await expectHealthy(page)
  const nav = page.locator('[data-sidebar="menu-button"]')
  await expect(nav.filter({ hasText: 'Leads' })).toHaveCount(1)
  for (const hidden of [
    'Invoices',
    'Hour blocks',
    'Time logs',
    'Monthly close',
    'Design system',
    'Integrations',
  ]) {
    await expect(nav.filter({ hasText: hidden })).toHaveCount(0)
  }
})

test('sales is sent back from admin pages', async ({ page }) => {
  for (const path of [
    '/invoices',
    '/hour-blocks',
    '/design',
    '/reports/monthly-close',
  ]) {
    await page.goto(path)
    await expect(page).not.toHaveURL(new RegExp(`${path}$`))
  }
})

test('sales sees a person with a sign-in read-only, without sign-in or portal fields', async ({
  page,
}) => {
  // The admin test account has a sign-in.
  const adminEmail = process.env.E2E_ADMIN_EMAIL ?? 'jason@local.test'
  await page.goto(`/people?q=${encodeURIComponent(adminEmail)}`)
  await expectHealthy(page)
  // No sign-in or portal access columns for Sales.
  await expect(page.getByRole('columnheader', { name: 'Sign-in' })).toHaveCount(
    0
  )
  await expect(
    page.getByRole('columnheader', { name: 'Portal access' })
  ).toHaveCount(0)

  // The name cell: the row's middle can be the company link.
  await page.locator('tbody tr').first().getByRole('cell').first().click()
  const sheet = page.getByRole('dialog')
  await expect(sheet).toBeVisible()
  await expect(
    sheet.getByText('Only an admin can edit someone who can sign in.')
  ).toBeVisible()
  await expect(sheet.getByPlaceholder('John Doe')).toBeDisabled()
  await expect(sheet.getByPlaceholder('contact@example.com')).toBeDisabled()
  // No Sign-in section, role or portal access.
  await expect(sheet.getByText('Can sign in', { exact: true })).toHaveCount(0)
  await expect(sheet.getByText('Role', { exact: true })).toHaveCount(0)
  await expect(sheet.getByText('Portal access')).toHaveCount(0)
  await expect(
    sheet.getByRole('button', { name: 'Save changes' })
  ).toBeDisabled()
})

test('sales sees no billing or sign-in controls on a company', async ({
  page,
}) => {
  await page.goto('/companies')
  await page.locator('tbody tr').first().locator('td').first().click()
  const sheet = page.getByRole('dialog')
  await expect(sheet).toBeVisible()
  await expect(sheet.getByRole('tab', { name: 'Billing' })).toHaveCount(0)
  await expect(sheet.getByText('Bill this company')).toHaveCount(0)
})

test('sales sees no portal switches on a client company’s people', async ({
  page,
}) => {
  await page.goto('/companies')
  const clientRow = page
    .locator('tbody tr')
    .filter({ has: page.locator('[data-slot="badge"]', { hasText: 'Client' }) })
    .first()
  test.skip((await clientRow.count()) === 0, 'no client company to open')
  await clientRow.click()
  const sheet = page.getByRole('dialog')
  await expect(sheet).toBeVisible()
  await expect(
    sheet.getByRole('switch', { name: /^Portal access for / })
  ).toHaveCount(0)
  await expect(sheet.getByText('Portal', { exact: true })).toHaveCount(0)
})

/** The first client company on the list, opened (People is on Details). */
async function openClientPeople(page: Page) {
  await page.goto('/companies')
  const clientRow = page
    .locator('tbody tr')
    .filter({ has: page.locator('[data-slot="badge"]', { hasText: 'Client' }) })
    .first()
  if ((await clientRow.count()) === 0) return null
  const name = (
    (await clientRow.locator('span.font-medium').first().textContent()) ?? ''
  ).trim()
  await clientRow.click()
  const sheet = page.getByRole('dialog')
  await expect(sheet).toBeVisible()
  return { sheet, name }
}

// R4: Sales builds the directory, client companies included, but a client's
// primary contact (its invoice recipient) is admin-only.
test('sales can’t change a client’s primary contact', async ({ page }) => {
  const opened = await openClientPeople(page)
  test.skip(!opened, 'no client company to open')
  const { sheet } = opened!
  // Adding people is open to Sales here.
  await expect(
    sheet.getByRole('button', { name: 'Add person' }).first()
  ).toBeEnabled()
  const stars = sheet.getByRole('button', {
    name: /^(Make .+ the primary contact|Remove .+ as primary contact)$/,
  })
  test.skip((await stars.count()) === 0, 'the client has no people')
  await expect(stars.first()).toBeDisabled()
})

// R4: Sales adds someone to a client company from its People list; and a
// Sales save that asks for portal access (replayed with the field added) is
// refused by the server. Cleans up: removes them again and archives them.
test('sales adds a person to a client company, never with portal access', async ({
  page,
}) => {
  test.skip(!process.env.E2E_WRITES, 'set E2E_WRITES=1 on a throwaway database')
  const stamp = Date.now()
  const personName = `E2E sales join ${stamp}`

  // A throwaway person (no sign-in).
  await page.goto('/people?contact=new')
  const created = page.getByRole('dialog')
  await created.getByPlaceholder('John Doe').fill(personName)
  await created.getByRole('button', { name: 'Create person' }).click()
  await expect(created).toBeHidden()

  let companyName: string | null = null
  try {
    const opened = await openClientPeople(page)
    test.skip(!opened, 'no client company to open')
    const { sheet } = opened!
    companyName = opened!.name

    await sheet.getByRole('button', { name: 'Add person' }).first().click()
    await page.keyboard.type(personName)
    await page
      .getByRole('option')
      .filter({ hasText: personName })
      .first()
      .click()
    await expect(sheet.getByText('Joins on save')).toBeVisible()

    const saveRequest = page.waitForRequest(
      request =>
        request.method() === 'POST' &&
        Boolean(request.headers()['next-action']) &&
        (request.postData() ?? '').includes('addContactIds')
    )
    await sheet.getByRole('button', { name: 'Save changes' }).click()
    const captured = await saveRequest
    await expect(sheet).toBeHidden()

    // Joined, and no portal switch for Sales.
    const reopened = await openClientPeople(page)
    await expect(reopened!.sheet.getByText(personName)).toBeVisible()
    await expect(
      reopened!.sheet.getByRole('switch', { name: /^Portal access for / })
    ).toHaveCount(0)
    await page.keyboard.press('Escape')

    // The same save, replayed with portal access for them: refused.
    const args = JSON.parse(captured.postData() ?? '[]')
    const contactId: string = args[0].addContactIds[0]
    args[0].portalAccessContactIds = [contactId]
    const response = await page.request.post(captured.url(), {
      headers: {
        'next-action': captured.headers()['next-action'],
        'content-type':
          captured.headers()['content-type'] ?? 'text/plain;charset=UTF-8',
        accept: 'text/x-component',
      },
      data: JSON.stringify(args),
    })
    expect(await response.text()).toContain(
      'Only an admin can change billing or portal access.'
    )
  } finally {
    // Remove them from the company again, then archive them.
    if (companyName) {
      const opened = await openClientPeople(page)
      const sheet = opened!.sheet
      const remove = sheet.getByRole('button', {
        name: `Remove ${personName} from this company`,
      })
      if (await remove.count()) {
        await remove.click()
        await sheet.getByRole('button', { name: 'Save changes' }).click()
        await expect(sheet).toBeHidden()
      }
    }
    await page.goto(`/people?q=${encodeURIComponent(personName)}`)
    await page
      .locator('tbody tr')
      .filter({ hasText: personName })
      .first()
      .click()
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Archive person' })
      .click()
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Archive' })
      .click()
    await expect(page.getByRole('dialog')).toBeHidden()
  }
})

// The rest of the Sales write rules (lead saves leaving people with a sign-in
// unedited, archiving/restoring them, moving them between companies) are
// server-side refusals the Sales UI never offers, so they aren't reachable
// from here.
test('sales can’t rename the staff company', async ({ page }) => {
  // A refused save writes nothing, but a regression would rename it.
  test.skip(!process.env.E2E_WRITES, 'set E2E_WRITES=1 on a throwaway database')
  const staffName = process.env.E2E_STAFF_COMPANY ?? 'Place To Stand'
  await page.goto(`/companies?q=${encodeURIComponent(staffName)}`)
  await expectHealthy(page)
  const row = page.locator('tbody tr').filter({ hasText: staffName }).first()
  test.skip((await row.count()) === 0, 'no staff company to open')
  await row.getByRole('cell', { name: staffName, exact: true }).click()
  const sheet = page.getByRole('dialog')
  await expect(sheet).toBeVisible()
  await sheet.getByLabel('Name').fill(`${staffName} (renamed)`)
  await sheet.getByRole('button', { name: 'Save changes' }).click()
  await expect(
    page.getByText(`Only an admin can change ${staffName}.`)
  ).toBeVisible()
})

/** The timeline entry holding `marker`, with its actions button. */
function leadUpdateEntry(target: Page, marker: string) {
  return target
    .getByRole('dialog')
    .locator('div')
    .filter({ hasText: marker })
    .filter({ has: target.getByRole('button', { name: /^Actions for / }) })
    .last()
}

// R14: only the author or an admin can edit or archive a lead update. An
// admin logs an update on a lead (and archives it again afterwards); Sales
// sees its actions turned off, and the edit action itself refuses them.
test('sales can’t edit or archive someone else’s lead update', async ({
  page,
  browser,
}) => {
  test.skip(!process.env.E2E_WRITES, 'set E2E_WRITES=1 on a throwaway database')
  // Two browsers, a log, an edit, a replay and a clean-up.
  test.setTimeout(150_000)
  const marker = `e2e update ${Date.now()}`
  const notAuthor = 'Only the author or an admin can change this update.'

  const adminContext = await browser.newContext({
    storageState: path.join(__dirname, '../.auth/admin.json'),
  })
  const admin = await adminContext.newPage()
  let leadUrl: string | null = null
  try {
    await admin.goto('/leads')
    const card = admin.locator('[aria-roledescription="sortable"]').first()
    test.skip((await card.count()) === 0, 'no lead on the board')
    await card.click()
    await expect(admin).toHaveURL(/[?&]lead=[0-9a-f-]{36}/)
    const leadId = new URL(admin.url()).searchParams.get('lead')!
    leadUrl = `/leads?lead=${leadId}`

    // Admin logs the update.
    await admin.getByRole('button', { name: 'Add update' }).click()
    const logDialog = admin
      .getByRole('dialog')
      .filter({ has: admin.getByText('Log update', { exact: true }) })
      // It opens over the lead sheet: the top one.
      .last()
    await admin.locator('#lead-update-body .ProseMirror').click()
    await admin.keyboard.type(marker)
    await logDialog.getByRole('button', { name: 'Log', exact: true }).click()
    await expect(logDialog).toBeHidden()

    // Admin saves it once, unchanged, to capture the edit action's request.
    const adminEntry = leadUpdateEntry(admin, marker)
    await expect(adminEntry).toBeVisible()
    await adminEntry.getByRole('button', { name: /^Actions for / }).click()
    await admin.getByRole('menuitem', { name: 'Edit' }).click()
    const editDialog = admin
      .getByRole('dialog')
      .filter({ has: admin.getByText('Edit update', { exact: true }) })
      // It opens over the lead sheet: the top one.
      .last()
    const editRequest = admin.waitForRequest(
      request =>
        request.method() === 'POST' &&
        Boolean(request.headers()['next-action']) &&
        (request.postData() ?? '').includes(leadId)
    )
    await editDialog.getByRole('button', { name: 'Save', exact: true }).click()
    const captured = await editRequest
    await expect(editDialog).toBeHidden()

    // Sales: the update's actions are off.
    await page.goto(leadUrl)
    const salesEntry = leadUpdateEntry(page, marker)
    await expect(salesEntry).toBeVisible()
    await expect(
      salesEntry.getByRole('button', { name: /^Actions for / })
    ).toBeDisabled()

    // Calling the edit action directly as Sales is refused.
    const response = await page.request.post(leadUrl, {
      headers: {
        'next-action': captured.headers()['next-action'],
        'content-type':
          captured.headers()['content-type'] ?? 'text/plain;charset=UTF-8',
        accept: 'text/x-component',
      },
      data: captured.postData() ?? '',
    })
    expect(await response.text()).toContain(notAuthor)
  } finally {
    // Admin archives the update again.
    if (leadUrl) {
      await admin.goto(leadUrl)
      const leftover = leadUpdateEntry(admin, marker)
      // Updates load after the sheet opens; it may never have been logged.
      await admin
        .getByText(marker)
        .first()
        .waitFor({ timeout: 10_000 })
        .catch(() => {})
      if (await leftover.count()) {
        await leftover.getByRole('button', { name: /^Actions for / }).click()
        await admin.getByRole('menuitem', { name: 'Archive' }).click()
        await admin.getByRole('button', { name: 'Archive update' }).click()
        await expect(leftover).toHaveCount(0)
      }
    }
    await adminContext.close()
  }
})
