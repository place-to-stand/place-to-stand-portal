import { expect, test } from '@playwright/test'

// The Companies list's type filter: Client (as the list's badge), Former
// client and Not a client. Read-only.
test('the company type filter offers client, former and never-billed', async ({
  page,
}) => {
  await page.goto('/companies')
  await page.getByRole('combobox', { name: 'All companies' }).click()
  const options = page.getByRole('option')
  await expect(options).toHaveText(['Client', 'Former client', 'Not a client'])

  // A highlighted badge option keeps the badge's own colours.
  const clientOption = options.first()
  await clientOption.hover()
  const optionIcon = clientOption.locator('[data-slot=badge] svg')
  const optionColor = await optionIcon.evaluate(e => getComputedStyle(e).color)
  const mutedColor = await clientOption.evaluate(e => {
    const probe = document.createElement('span')
    probe.className = 'text-muted-foreground'
    e.appendChild(probe)
    const color = getComputedStyle(probe).color
    probe.remove()
    return color
  })
  expect(optionColor).not.toBe(mutedColor)

  // Not a client: no row carries the Client badge.
  await page.getByRole('option', { name: 'Not a client' }).click()
  await expect(page).toHaveURL(/type=none/)
  const rows = page.locator('tbody tr')
  await expect(rows.first()).toBeVisible()
  await expect(
    page.locator('tbody [data-slot=badge]', { hasText: 'Client' })
  ).toHaveCount(0)
})
