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
  await page.locator('tbody tr').first().click()
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
  await sheet.getByRole('tab', { name: 'People' }).click()
  await expect(
    sheet.getByRole('switch', { name: /^Portal access for / })
  ).toHaveCount(0)
  await expect(sheet.getByText('Portal', { exact: true })).toHaveCount(0)
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
    const logDialog = admin.getByRole('dialog', { name: 'Log update' })
    await logDialog.locator('.ProseMirror').click()
    await admin.keyboard.type(marker)
    await logDialog.getByRole('button', { name: 'Log', exact: true }).click()
    await expect(logDialog).toBeHidden()

    // Admin saves it once, unchanged, to capture the edit action's request.
    const adminEntry = leadUpdateEntry(admin, marker)
    await expect(adminEntry).toBeVisible()
    await adminEntry.getByRole('button', { name: /^Actions for / }).click()
    await admin.getByRole('menuitem', { name: 'Edit' }).click()
    const editDialog = admin.getByRole('dialog', { name: 'Edit update' })
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
