import { expect, test, type Locator, type Page } from '@playwright/test'

import { expectHealthy } from './helpers'

/**
 * A slow network: the next drag must not wait for the last one to save.
 * The leads board used to lock every card until a move's save came back,
 * so a second drag in that time did nothing and had to be repeated. Moves
 * two leads into the next column and back. Run only with E2E_WRITES=1.
 */
test.skip(!process.env.E2E_WRITES, 'set E2E_WRITES=1 on a throwaway database')

const SAVE_DELAY_MS = 2500

/** Holds every server action (the leads board saves through them). */
async function slowSaves(page: Page) {
  await page.route('**/leads**', async route => {
    if (route.request().headers()['next-action']) {
      await new Promise(resolve => setTimeout(resolve, SAVE_DELAY_MS))
    }
    await route.continue()
  })
}

const column = (page: Page, index: number) =>
  page.locator('[data-board-column]').nth(index)

async function dragTo(page: Page, card: Locator, target: Locator) {
  const from = (await card.boundingBox())!
  const to = (await target.boundingBox())!
  await page.mouse.move(from.x + 10, from.y + 6)
  await page.mouse.down()
  await page.mouse.move(from.x + 30, from.y + 30, { steps: 5 })
  await page.mouse.move(to.x + to.width / 2, to.y + 120, { steps: 15 })
  await page.mouse.up()
}

test('leads board: a second drag works while the first is still saving', async ({
  page,
}) => {
  await slowSaves(page)
  await page.goto('/leads')
  await page.waitForLoadState('networkidle')
  await expectHealthy(page)

  // The first column holding two leads, and the column after it.
  const columns = page.locator('[data-board-column]')
  let from = -1
  for (let index = 0; index < (await columns.count()) - 1; index++) {
    if ((await column(page, index).locator('[data-board-card]').count()) >= 2)
      from = index
    if (from >= 0) break
  }
  test.skip(from < 0, 'no column with two leads')

  const cards = column(page, from).locator('[data-board-card]')
  const first = (await cards.nth(0).innerText()).split('\n')[0]!
  const second = (await cards.nth(1).innerText()).split('\n')[0]!
  const there = (name: string, index: number) =>
    column(page, index).locator('[data-board-card]', { hasText: name })

  const started = Date.now()
  await dragTo(page, there(first, from), column(page, from + 1))
  await expect(there(first, from + 1)).toHaveCount(1)
  await dragTo(page, there(second, from), column(page, from + 1))
  // Both moved before the first save could have answered.
  await expect(there(second, from + 1)).toHaveCount(1)
  expect(Date.now() - started).toBeLessThan(SAVE_DELAY_MS)

  // And they stay put once both saves land.
  await page.waitForTimeout(SAVE_DELAY_MS * 2 + 1000)
  await expect(there(first, from + 1)).toHaveCount(1)
  await expect(there(second, from + 1)).toHaveCount(1)

  // Put them back.
  await page.unrouteAll({ behavior: 'ignoreErrors' })
  await dragTo(page, there(first, from + 1), column(page, from))
  await dragTo(page, there(second, from + 1), column(page, from))
  await expect(there(first, from)).toHaveCount(1)
  await expect(there(second, from)).toHaveCount(1)
  await page.waitForLoadState('networkidle')
})
