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

/**
 * Holds every server action (the leads board saves through them): the
 * nth save waits `delays[n]` ms (the last entry after that), or fails
 * outright where the entry is 'fail'.
 */
async function slowSaves(page: Page, delays: (number | 'fail')[]) {
  let count = 0
  await page.route('**/leads**', async route => {
    if (!route.request().headers()['next-action']) return route.continue()
    const delay = delays[Math.min(count++, delays.length - 1)]!
    if (delay === 'fail') return route.abort()
    await new Promise(resolve => setTimeout(resolve, delay))
    await route.continue()
  })
}

const column = (page: Page, index: number) =>
  page.locator('[data-board-column]').nth(index)

/** The leads board, the first column holding `count` leads, their names. */
async function openLeads(page: Page, count: number) {
  await page.goto('/leads')
  await page.waitForLoadState('networkidle')
  await expectHealthy(page)
  const columns = page.locator('[data-board-column]')
  let from = -1
  for (let index = 0; index < (await columns.count()) - 1; index++) {
    const cards = column(page, index).locator('[data-board-card]')
    if ((await cards.count()) >= count) {
      from = index
      break
    }
  }
  test.skip(from < 0, `no column with ${count} leads`)
  const cards = column(page, from).locator('[data-board-card]')
  const names: string[] = []
  for (let index = 0; index < count; index++) {
    names.push((await cards.nth(index).innerText()).split('\n')[0]!)
  }
  const there = (name: string, index: number) =>
    column(page, index).locator('[data-board-card]', { hasText: name })
  return { from, names, there }
}

async function dragTo(page: Page, card: Locator, target: Locator) {
  const from = (await card.boundingBox())!
  const to = (await target.boundingBox())!
  await page.mouse.move(from.x + 10, from.y + 6)
  await page.mouse.down()
  await page.mouse.move(from.x + 30, from.y + 30, { steps: 5 })
  await page.mouse.move(to.x + to.width / 2, to.y + 120, { steps: 15 })
  await page.mouse.up()
  // A person's next grab comes a beat later; one in the same instant
  // lands while the card is still settling and dnd-kit ignores it.
  await page.waitForTimeout(250)
}

test('leads board: a second drag works while the first is still saving', async ({
  page,
}) => {
  await slowSaves(page, [SAVE_DELAY_MS])
  const { from, names, there } = await openLeads(page, 2)
  const [first, second] = names

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

test('leads board: a save that answers mid-burst keeps later moves', async ({
  page,
}) => {
  // The first save answers between the second and third drags.
  await slowSaves(page, [800, 3000, 300])
  const { from, names, there } = await openLeads(page, 3)
  const [a, b, c] = names

  await dragTo(page, there(a, from), column(page, from + 1))
  await dragTo(page, there(b, from), column(page, from + 1))
  await page.waitForTimeout(1200)
  await dragTo(page, there(c, from), column(page, from + 1))
  // At once, while the second save is still out: nothing jumped back.
  for (const name of [a, b, c]) {
    await expect(there(name, from + 1)).toHaveCount(1, { timeout: 500 })
  }
  await page.waitForTimeout(5000)
  for (const name of [a, b, c]) {
    await expect(there(name, from + 1)).toHaveCount(1)
  }

  await page.unrouteAll({ behavior: 'ignoreErrors' })
  for (const name of [a, b, c]) {
    await dragTo(page, there(name, from + 1), column(page, from))
    await expect(there(name, from)).toHaveCount(1)
  }
  await page.waitForLoadState('networkidle')
})

test('leads board: a failed save puts back only its own lead', async ({
  page,
}) => {
  await slowSaves(page, [1500, 'fail', 3000])
  // The second save fails; the first and third land.
  const { from, names, there } = await openLeads(page, 3)
  const [a, b, c] = names

  await dragTo(page, there(a, from), column(page, from + 1))
  await dragTo(page, there(b, from), column(page, from + 1))
  await dragTo(page, there(c, from), column(page, from + 1))
  await expect(there(b, from)).toHaveCount(1, { timeout: 8000 })
  // At once, while the third save is still out: only b went back.
  await expect(there(c, from + 1)).toHaveCount(1, { timeout: 500 })
  await page.waitForTimeout(4000)
  await expect(there(a, from + 1)).toHaveCount(1)
  await expect(there(c, from + 1)).toHaveCount(1)
  await expect(there(b, from)).toHaveCount(1)

  await page.unrouteAll({ behavior: 'ignoreErrors' })
  for (const name of [a, c]) {
    await dragTo(page, there(name, from + 1), column(page, from))
    await expect(there(name, from)).toHaveCount(1)
  }
  await page.waitForLoadState('networkidle')
})
