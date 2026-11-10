import path from 'node:path'

import { expect, test, type Browser, type Locator } from '@playwright/test'

/**
 * Two people on one record: the admin and the sales account open the same
 * company sheet. Each sees the other, a save by one shows on the other's
 * sheet, and the second Save asks before overwriting. Runs only with
 * E2E_WRITES=1, against a throwaway database: it edits the first company's
 * website and puts it back.
 */
test.skip(!process.env.E2E_WRITES, 'set E2E_WRITES=1 on a throwaway database')

const AUTH = path.join(__dirname, '../.auth')

async function openAs(browser: Browser, role: 'admin' | 'sales', url: string) {
  const context = await browser.newContext({
    storageState: path.join(AUTH, `${role}.json`),
  })
  const page = await context.newPage()
  await page.goto(url)
  const sheet = page.getByRole('dialog')
  await expect(sheet).toBeVisible()
  return { context, page, sheet }
}

const website = (sheet: Locator) =>
  sheet.getByRole('textbox', { name: /^Website/ })

const saveAndStay = (sheet: Locator) =>
  sheet.getByRole('button', { name: /^Save and keep open/ }).click()

test('a second save over a teammate asks first', async ({ browser, page }) => {
  // Any company works; the first row of the list (past its select box).
  await page.goto('/companies')
  await page.getByRole('rowgroup').nth(1).getByRole('cell').nth(1).click()
  await expect(page).toHaveURL(/company=/)
  const url = page.url()
  const original = await website(page.getByRole('dialog')).inputValue()
  // Fresh values each run: a run that failed midway must not leave the
  // record holding one of them, or the next admin save changes nothing.
  const run = Date.now()
  const salesSite = `sales-${run}.example`
  const adminSite = `admin-${run}.example`

  const admin = await openAs(browser, 'admin', url)
  const sales = await openAs(browser, 'sales', url)
  try {
    // Each sees the other, then sees them editing.
    await expect(admin.sheet.getByText(/has this company open/)).toBeVisible()
    await website(sales.sheet).fill(salesSite)
    await expect(admin.sheet.getByText(/is editing this company/)).toBeVisible()

    // The admin saves first; the sales sheet keeps its edits.
    await website(admin.sheet).fill(adminSite)
    await saveAndStay(admin.sheet)
    await expect(
      admin.sheet.getByRole('button', { name: 'Save and keep open' })
    ).toHaveText('Saved')
    await expect(website(sales.sheet)).toHaveValue(salesSite)

    // Sales saves anyway: nothing is written until they choose.
    await saveAndStay(sales.sheet)
    const dialog = sales.page.getByRole('alertdialog')
    await expect(dialog).toContainText('Your changes weren’t saved')
    await expect(dialog).toContainText('Website')
    await dialog.getByRole('button', { name: 'Overwrite with mine' }).click()
    await expect(dialog).toBeHidden()

    // The admin's untouched sheet follows the overwrite on its own.
    await expect(website(admin.sheet)).toHaveValue(`https://${salesSite}`)

    // A save straight after, with no one else in between, just saves.
    await website(sales.sheet).fill(original)
    await saveAndStay(sales.sheet)
    await expect(dialog).toBeHidden()
    await expect(website(admin.sheet)).toHaveValue(original)
  } finally {
    await admin.context.close()
    await sales.context.close()
  }
})
