import { expect, test } from '@playwright/test'

import { LIST_PAGES, expectHealthy } from './helpers'

for (const path of [...LIST_PAGES, '/design', '/my/home', '/leads']) {
  test(`${path} fits a phone (no sideways scroll)`, async ({ page }) => {
    await page.goto(path)
    await page.waitForLoadState('networkidle')
    await expectHealthy(page)
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth
    )
    expect(overflow).toBeLessThanOrEqual(1)
  })
}
