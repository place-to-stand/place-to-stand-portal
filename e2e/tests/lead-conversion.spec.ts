import { expect, test, type Page } from '@playwright/test'

import { expectHealthy } from './helpers'

/**
 * R10: a Won lead moved back to an earlier stage keeps its conversion (the
 * link to the company it made a client). Changes data, then puts the lead
 * back to Closed won; run only with E2E_WRITES=1 on a throwaway database.
 */
test.skip(!process.env.E2E_WRITES, 'set E2E_WRITES=1 on a throwaway database')

const MADE_A_CLIENT = 'Made a client'

async function setStatus(page: Page, leadUrl: string, label: string) {
  await page.goto(leadUrl)
  const sheet = page.getByRole('dialog')
  await expect(sheet).toBeVisible()
  await sheet.getByRole('combobox', { name: 'Status' }).click()
  await page.getByRole('option', { name: label }).click()
  await sheet.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('Lead saved').first()).toBeVisible()
}

test('lead: a converted Won lead moved back keeps its conversion', async ({
  page,
}) => {
  await page.goto('/leads')
  await expectHealthy(page)

  // A Won lead that made its company a client. The fixture is whatever the
  // database already has; making one from scratch means billing a company.
  const convertedCards = page
    .locator('[aria-roledescription="sortable"]')
    .filter({ has: page.getByRole('img', { name: MADE_A_CLIENT }) })
  let leadUrl: string | null = null
  const count = await convertedCards.count()
  for (let index = 0; index < Math.min(count, 10); index++) {
    await page.goto('/leads')
    await convertedCards.nth(index).click()
    const sheet = page.getByRole('dialog')
    await expect(sheet).toBeVisible()
    const status = sheet.getByRole('combobox', { name: 'Status' })
    if ((await status.innerText()).includes('Closed won')) {
      await expect(page).toHaveURL(/[?&]lead=[0-9a-f-]{36}/)
      leadUrl = page.url()
      break
    }
  }
  test.skip(!leadUrl, 'no converted Closed won lead on the board')
  const url = leadUrl!

  try {
    await setStatus(page, url, 'Active opportunities')

    await page.goto(url)
    const sheet = page.getByRole('dialog')
    await expect(sheet.getByRole('combobox', { name: 'Status' })).toContainText(
      'Active opportunities'
    )
    // The conversion and its company are still there.
    await expect(sheet.getByText('Converted', { exact: true })).toBeVisible()
    await expect(
      sheet.getByText('The converted client is no longer available.')
    ).toHaveCount(0)
    // No second "Bill this company": it is already converted.
    await expect(sheet.getByText('Bill this company')).toHaveCount(0)
    await page.keyboard.press('Escape')

    // The card keeps its mark on the board too.
    const leadId = new URL(url).searchParams.get('lead')!
    await page.goto('/leads')
    await expect(
      page
        .locator('[aria-roledescription="sortable"]')
        .filter({ has: page.getByRole('img', { name: MADE_A_CLIENT }) })
    ).not.toHaveCount(0)
    await page.goto(`/leads?lead=${leadId}`)
    await expect(
      page.getByRole('dialog').getByText('Converted', { exact: true })
    ).toBeVisible()
  } finally {
    // Put it back to Won (saving Won opens the company's Billing tab next).
    await setStatus(page, url, 'Closed won')
  }
})
