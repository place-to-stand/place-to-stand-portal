import { expect, test, type Page } from '@playwright/test'

/**
 * Tests that change data. They run only with E2E_WRITES=1, against a
 * throwaway database (a rehearsal copy), and put back what they change.
 */
test.skip(!process.env.E2E_WRITES, 'set E2E_WRITES=1 on a throwaway database')

async function openFirstNonClientCompany(page: Page) {
  await page.goto('/companies')
  const row = page
    .locator('tbody tr')
    .filter({
      hasNot: page.locator('[data-slot="badge"]', { hasText: 'Client' }),
    })
    .first()
  await row.locator('td').first().click()
  const sheet = page.getByRole('dialog')
  // Not a client: the Client column's Bill this company switch is off.
  await expect(
    sheet.getByRole('switch', { name: 'Bill this company' })
  ).toHaveAttribute('aria-checked', 'false')
  return sheet
}

async function setBilling(page: Page, on: boolean) {
  const sheet = page.getByRole('dialog')
  await expect(
    sheet.getByRole('heading', { name: 'Client', exact: true })
  ).toBeVisible()
  const toggle = sheet.getByRole('switch', { name: 'Bill this company' })
  if ((await toggle.getAttribute('aria-checked')) !== String(on))
    await toggle.click()
  await sheet.getByRole('button', { name: 'Save changes' }).click()
  await expect(sheet).toBeHidden()
}

test('billing: make a client, stop billing, restart, and back', async ({
  page,
}) => {
  const sheet = await openFirstNonClientCompany(page)
  const url = page.url()
  await setBilling(page, true)

  await page.goto(url)
  await expect(
    page.getByRole('dialog').getByRole('switch', { name: 'Bill this company' })
  ).toHaveAttribute('aria-checked', 'true')
  await setBilling(page, false)

  // Stopping defaults to billing through the end of this month, so it is
  // still a client with the stop scheduled; Keep billing cancels the stop.
  await page.goto(url)
  const ending = page.getByRole('dialog')
  await expect(ending.getByText(/^Billing stops after /)).toBeVisible()
  await ending.getByRole('button', { name: 'Keep billing' }).click()
  await setBilling(page, true)

  await page.goto(url)
  await expect(
    page.getByRole('dialog').getByText(/^Billing stops after /)
  ).toHaveCount(0)

  await page.goto(url)
  await expect(
    page.getByRole('dialog').getByRole('switch', { name: 'Bill this company' })
  ).toHaveAttribute('aria-checked', 'true')
  // Leave it as a former client (stopping is the only way back in the app).
  await setBilling(page, false)
})

test('lead: a person not at the company gets one caution saying Save adds them', async ({
  page,
}) => {
  await page.goto('/leads?lead=new')
  const sheet = page.getByRole('dialog')
  const records = page.getByRole('option').filter({ hasNotText: /^Create/ })
  await sheet.getByRole('combobox', { name: 'Person' }).click()
  await records.first().click()
  const caution = sheet
    .getByRole('alert')
    .filter({ hasText: /isn.t at .+ yet/ })
  for (let attempt = 1; attempt <= 3; attempt++) {
    await sheet.getByRole('combobox', { name: 'Company' }).click()
    await records.nth(attempt * 3).click()
    if (await caution.count()) break
  }
  await expect(caution).toBeVisible()
  await expect(caution).toContainText('when you save')
  // One alert, no button: Save does it.
  await expect(caution.getByRole('button')).toHaveCount(0)
  // Close without saving.
  await page.keyboard.press('Escape')
})
