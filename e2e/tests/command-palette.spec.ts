import { expect, test } from '@playwright/test'

import { expectHealthy } from './helpers'

type Company = { id: string; name: string; isClient: boolean }

// Decision 8: ⌘K lists Companies (not Clients), with a Client badge on the
// ones you bill. Names come from the database, so nothing is hard-coded.
test('⌘K shows a Companies group with a Client badge on clients', async ({ page }) => {
  await page.goto('/my/home')
  const found: Company[] = []
  for (const q of ['co', 'in', 'an', 'er']) {
    const res = await page.request.get(`/api/command-palette/search?q=${q}`)
    const body = (await res.json()) as { data?: { companies: Company[] } }
    found.push(...(body.data?.companies ?? []))
  }
  const client = found.find(c => c.isClient)
  test.skip(!client, 'No client company matched the sample searches.')

  await page.keyboard.press('ControlOrMeta+k')
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('combobox').fill(client!.name.slice(0, 20))
  const group = dialog.locator('[cmdk-group]', { hasText: 'Companies' })
  await expect(group).toBeVisible()
  await expect(dialog.locator('[cmdk-group-heading]', { hasText: /^Clients$/ })).toHaveCount(0)
  const item = group.locator('[cmdk-item]', { hasText: client!.name }).first()
  await expect(item).toContainText('Client')

  await item.click()
  await expect(page).toHaveURL(new RegExp(`company=${client!.id}`))
  await expectHealthy(page)
})
