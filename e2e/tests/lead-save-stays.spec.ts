import { expect, test, type Page } from '@playwright/test'

/**
 * Saving a lead never loads the whole page again, wherever its sheet sits.
 * Changes data (a lead's notes); run only with E2E_WRITES=1 on a throwaway
 * database.
 */
test.skip(!process.env.E2E_WRITES, 'set E2E_WRITES=1 on a throwaway database')

async function saveTopLead(page: Page, url: string) {
  await page.goto(url)
  await page.waitForLoadState('networkidle')
  const sheet = page.getByRole('dialog').last()
  const field = sheet.getByRole('textbox').first()
  await field.fill(`${await field.inputValue()} ·`)
  await page.evaluate(() => {
    ;(window as unknown as { samePage?: boolean }).samePage = true
  })
  await sheet.getByRole('button', { name: 'Save and close' }).click()
  await expect(page.getByText('Lead saved').first()).toBeVisible()
  await page.waitForLoadState('networkidle')
  expect(
    await page.evaluate(
      () => (window as unknown as { samePage?: boolean }).samePage
    )
  ).toBe(true)
}

async function leadAndCompanyIds(page: Page) {
  await page.goto('/leads?assignee=all')
  await page.locator('[aria-roledescription="sortable"]').first().click()
  await expect(page).toHaveURL(/[?&]lead=[0-9a-f-]{36}/)
  const lead = new URL(page.url()).searchParams.get('lead')!
  await page.keyboard.press('Escape')
  await page.goto('/companies?q=Company%20050')
  await page
    .locator('tbody tr td:not([data-slot=table-select-cell])')
    .first()
    .click()
  await expect(page).toHaveURL(/[?&]company=[0-9a-f-]{36}/)
  const company = new URL(page.url()).searchParams.get('company')!
  return { lead, company }
}

test('a lead saved from a link, over Home, or over a company stays put', async ({
  page,
}) => {
  const { lead, company } = await leadAndCompanyIds(page)
  await saveTopLead(page, `/leads?lead=${lead}`)
  await saveTopLead(page, `/my/home?lead=${lead}`)
  await saveTopLead(page, `/companies?company=${company}&lead=${lead}`)
})
