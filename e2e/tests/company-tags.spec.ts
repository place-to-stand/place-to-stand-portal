import { expect, test } from '@playwright/test'

import { archiveFromSheetMenu } from './helpers'

/**
 * Company tags: typed on the sheet (Enter or a comma adds one, an existing
 * tag is reused in any case), saved with the sheet, shown in the list and
 * filterable there. Runs only with E2E_WRITES=1, against a throwaway
 * database: it makes a company and archives it again.
 */
test.skip(!process.env.E2E_WRITES, 'set E2E_WRITES=1 on a throwaway database')

test('tags save with the sheet and filter the list', async ({ page }) => {
  const stamp = Date.now()
  const name = `E2E Tags ${stamp}`
  const tagA = `Salon ${stamp}`
  const tagB = `Spa ${stamp}`

  await page.goto('/companies?company=new')
  const sheet = page.getByRole('dialog')
  await sheet.getByLabel('Name').fill(name)

  // Enter creates the first, a comma the second.
  await sheet.getByLabel('Tags').click()
  const search = page.getByPlaceholder('Find or create a tag…')
  await search.fill(tagA)
  await page.keyboard.press('Enter')
  await search.fill(`${tagB},`)
  await expect(search).toHaveValue('')
  await page.keyboard.press('Escape')

  const picked = sheet.getByRole('list', { name: 'Tags' })
  await expect(picked.getByText(tagA)).toBeVisible()
  await expect(picked.getByText(tagB)).toBeVisible()

  // Typing an existing name in another case reuses it, not a second tag.
  await sheet.getByLabel('Tags').click()
  await search.fill(tagA.toLowerCase())
  await expect(page.getByRole('option', { name: /^Create/ })).toHaveCount(0)
  await page.keyboard.press('Escape')

  await sheet.getByRole('button', { name: 'Create and close' }).click()
  await expect(sheet).toBeHidden()

  // The list shows them, and the tag filter finds the company.
  await page.goto(`/companies?tags=${encodeURIComponent(tagB)}`)
  const row = page.locator('tbody tr', { hasText: name })
  await expect(row).toHaveCount(1)
  await expect(row.getByText(tagA)).toBeVisible()

  // Take one off and save: it no longer matches.
  await row.getByText(name).click()
  await expect(sheet.getByRole('list', { name: 'Tags' })).toBeVisible()
  await sheet.getByRole('button', { name: `Remove tag ${tagB}` }).click()
  await sheet.getByRole('button', { name: 'Save and close' }).click()
  await expect(sheet).toBeHidden()
  await page.reload()
  await expect(page.locator('tbody tr', { hasText: name })).toHaveCount(0)

  // Clean up.
  await page.goto(`/companies?q=${encodeURIComponent(name)}`)
  await page.getByText(name).click()
  await archiveFromSheetMenu(sheet)
  await page
    .getByRole('button', { name: 'Archive company', exact: true })
    .click()
})
