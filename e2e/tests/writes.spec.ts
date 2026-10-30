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
    .filter({ hasNot: page.locator('[data-slot="badge"]', { hasText: 'Client' }) })
    .first()
  await row.click()
  const sheet = page.getByRole('dialog')
  await sheet.getByRole('tab', { name: 'Billing' }).click()
  await expect(page).toHaveURL(/tab=billing/)
  return sheet
}

async function setBilling(page: Page, on: boolean) {
  const sheet = page.getByRole('dialog')
  const toggle = sheet.getByRole('switch', { name: 'Bill this company' })
  if ((await toggle.getAttribute('aria-checked')) !== String(on)) await toggle.click()
  await sheet.getByRole('button', { name: 'Save changes' }).click()
  await expect(sheet).toBeHidden()
}

test('billing: make a client, stop billing, restart, and back', async ({ page }) => {
  const sheet = await openFirstNonClientCompany(page)
  const url = page.url()
  await setBilling(page, true)

  await page.goto(url)
  await expect(page.getByRole('dialog').getByRole('switch', { name: 'Bill this company' })).toHaveAttribute('aria-checked', 'true')
  await setBilling(page, false)

  await page.goto(url)
  await expect(page.getByRole('dialog').getByText('Billing stopped')).toBeVisible()
  await setBilling(page, true)

  await page.goto(url)
  await expect(page.getByRole('dialog').getByRole('switch', { name: 'Bill this company' })).toHaveAttribute('aria-checked', 'true')
  // Leave it as a former client (stopping is the only way back in the app).
  await setBilling(page, false)
})

test('lead: a person who isn’t at the company gets a warning with the fix', async ({ page }) => {
  await page.goto('/leads?lead=new')
  const sheet = page.getByRole('dialog')
  const records = page.getByRole('option').filter({ hasNotText: /^Create/ })
  await sheet.getByRole('combobox', { name: 'Person' }).click()
  await records.first().click()
  for (let attempt = 1; attempt <= 3; attempt++) {
    await sheet.getByRole('combobox', { name: 'Company' }).click()
    await records.nth(attempt * 3).click()
    if (await sheet.getByRole('alert').filter({ hasText: 'isn’t at' }).or(sheet.getByRole('alert').filter({ hasText: "isn't at" })).count()) break
  }
  const alert = sheet.getByRole('alert').filter({ hasText: /isn.t at/ })
  await expect(alert).toBeVisible()
  await expect(alert.getByRole('button', { name: /^Add to / })).toBeVisible()
  await alert.getByRole('button', { name: /^Add to / }).click()
  await expect(sheet.getByRole('alert').filter({ hasText: 'when you save' })).toBeVisible()
  // Close without saving.
  await page.keyboard.press('Escape')
})
