import { expect, test } from '@playwright/test'

import { expectHealthy } from './helpers'

const DOT = '[data-slot="whats-new-dot"]'

// What's new lists CHANGELOG.md. A browser that hasn't opened it sees a dot
// on the user menu; opening the dialog clears it, for good.
test('What’s new: the dot leads to the list and goes once it is opened', async ({
  page,
}) => {
  await page.goto('/my/home')
  await page.evaluate(() =>
    window.localStorage.removeItem('pts:whats-new-seen')
  )
  await page.reload()

  const trigger = page.locator(`button:has(${DOT})`).first()
  await expect(trigger).toBeVisible()
  await trigger.click()

  const item = page.getByRole('menuitem', { name: 'What’s new' })
  await expect(item.locator(DOT)).toBeVisible()
  await item.click()

  const dialog = page.getByRole('dialog', { name: 'What’s new' })
  await expect(dialog).toBeVisible()
  await expect(
    dialog.getByRole('heading', {
      name: /^Week of [A-Z][a-z]+ \d{1,2}, \d{4}$/,
    })
  ).not.toHaveCount(0)
  await expect(dialog.getByRole('listitem').first()).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(page.locator(DOT)).toHaveCount(0)

  await page.reload()
  await page.getByRole('main').waitFor()
  await expect(page.locator(DOT)).toHaveCount(0)
  await expectHealthy(page)
})

test('What’s new opens from ⌘K', async ({ page }) => {
  await page.goto('/my/home')
  await page.keyboard.press('ControlOrMeta+k')
  const palette = page.getByRole('dialog')
  await palette.getByRole('combobox').fill('what')
  await palette.getByRole('option', { name: 'What’s new' }).click()
  await expect(page.getByRole('dialog', { name: 'What’s new' })).toBeVisible()
})
