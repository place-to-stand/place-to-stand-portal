import { expect, test, type Locator, type Page } from '@playwright/test'

import { expectHealthy } from './helpers'

const WON_NEEDS_COMPANY = "Add the lead's company before marking it Won."

async function sheetWidth(sheet: Locator) {
  const box = await sheet.boundingBox()
  expect(box).not.toBeNull()
  return Math.round(box!.width)
}

async function openCreateSheet(page: Page) {
  await page.goto('/leads?lead=new')
  const sheet = page.getByRole('dialog')
  await expect(sheet.getByText('Create lead').first()).toBeVisible()
  return sheet
}

// Create and edit are one sheet: the same split layout, with the tasks and
// updates column waiting for the lead to exist on create.
test('lead: the create sheet uses the edit sheet’s split layout', async ({
  page,
}) => {
  const sheet = await openCreateSheet(page)
  await expectHealthy(page)
  await expect(
    sheet.getByText('Add tasks after you save the lead.')
  ).toBeVisible()
  await expect(
    sheet.getByText('Add updates after you save the lead.')
  ).toBeVisible()
  // Conversion needs a Won lead, so it isn't there yet.
  await expect(sheet.getByText('Convert to client')).toHaveCount(0)
  const createWidth = await sheetWidth(sheet)

  // An existing lead, if the board has one, opens at the same width.
  await page.goto('/leads')
  const card = page.locator('[aria-roledescription="sortable"]').first()
  if (!(await card.count())) return
  await card.click()
  const editSheet = page.getByRole('dialog')
  // The edit sheet is titled with the lead's name (its contact), as on the card.
  const title = editSheet.locator('h2').first()
  await expect(title).toBeVisible()
  expect(await card.innerText()).toContain(await title.innerText())
  expect(await sheetWidth(editSheet)).toBe(createWidth)
})

// Decision 7: a lead needs a company before it can be Won.
test('lead: a lead without a company can’t be saved as Won', async ({
  page,
}) => {
  test.skip(!process.env.E2E_WRITES, 'set E2E_WRITES=1 on a throwaway database')
  const sheet = await openCreateSheet(page)

  await sheet.getByRole('combobox', { name: 'Person' }).click()
  await page
    .getByRole('option')
    .filter({ hasNotText: /^Create/ })
    .first()
    .click()
  await expect(sheet.getByRole('combobox', { name: 'Company' })).toBeVisible()
  // Picking a person fills in their company: clear it, so the lead has none.
  const clearCompany = sheet.getByRole('button', { name: /^Clear company$/i })
  if (await clearCompany.count()) await clearCompany.click()

  await sheet.getByRole('combobox', { name: 'Status' }).click()
  await page.getByRole('option', { name: 'Closed won' }).click()

  let saveRequests = 0
  page.on('request', request => {
    if (request.method() === 'POST' && request.headers()['next-action'])
      saveRequests++
  })
  await sheet.getByRole('button', { name: 'Create lead' }).click()

  await expect(sheet.getByText(WON_NEEDS_COMPANY)).toBeVisible()
  // Refused before anything is written: the sheet stays open, no save sent.
  await expect(sheet).toBeVisible()
  expect(saveRequests).toBe(0)

  await page.keyboard.press('Escape')
})
