import { expect, test, type Locator, type Page } from '@playwright/test'

import { expectHealthy } from './helpers'

/**
 * Mark as done on task boards: from a card's right-click menu, and from the
 * bulk bar for selected cards. Each moves the cards to the top of Done at
 * once, as a drag would, and the move saves. Each test drags the cards
 * back. Run only with E2E_WRITES=1.
 */
test.skip(!process.env.E2E_WRITES, 'set E2E_WRITES=1 on a throwaway database')
// Wide enough to show all four columns: a drag back from Done needs both ends
// on screen.
test.use({ viewport: { width: 1600, height: 1000 } })

const CORNER = { x: 10, y: 6 }
const column = (page: Page, id: string) =>
  page.locator(`[data-board-column="${id}"]`)
const cardIn = (page: Page, id: string, name: string) =>
  column(page, id).locator('[data-board-card]', { hasText: name })
const bar = (page: Page) => page.getByRole('toolbar', { name: /Bulk actions/ })

async function openMyTasks(page: Page, count: number) {
  await page.goto('/my/tasks/board')
  await page.waitForLoadState('networkidle')
  await expectHealthy(page)
  const cards = column(page, 'ON_DECK').locator('[data-board-card]')
  test.skip((await cards.count()) < count, `need ${count} tasks On deck`)
  const names: string[] = []
  for (let index = 0; index < count; index++) {
    names.push((await cards.nth(index).locator('h3').innerText()).trim())
  }
  return names
}

async function dragTo(page: Page, card: Locator, target: Locator) {
  const from = (await card.boundingBox())!
  const to = (await target.boundingBox())!
  await page.mouse.move(from.x + 10, from.y + 6)
  await page.mouse.down()
  await page.mouse.move(from.x + 30, from.y + 30, { steps: 5 })
  await page.mouse.move(to.x + to.width / 2, to.y + 120, { steps: 15 })
  await page.mouse.up()
  await page.waitForTimeout(250)
}

async function putBack(page: Page, names: string[]) {
  for (const name of names) {
    await dragTo(page, cardIn(page, 'DONE', name), column(page, 'ON_DECK'))
    await expect(cardIn(page, 'ON_DECK', name)).toHaveCount(1)
  }
  await page.waitForLoadState('networkidle')
}

test('the card menu marks a task done, at the top of Done', async ({
  page,
}) => {
  const [name] = await openMyTasks(page, 1)
  const card = cardIn(page, 'ON_DECK', name!)
  await card.click({ button: 'right', position: CORNER })
  const saved = page.waitForResponse(
    response =>
      response.url().includes('/reorder') &&
      response.request().method() !== 'GET'
  )
  // My Tasks refreshes its data after the save; Firefox aborts a reload
  // that overlaps that refresh, so the reload waits for it.
  const refreshed = page.waitForResponse(
    response => response.request().headers()['rsc'] === '1'
  )
  await page.getByRole('menuitem', { name: 'Mark as done' }).click()

  const done = column(page, 'DONE').locator('[data-board-card]')
  await expect(done.first()).toContainText(name!)
  await expect(page.getByText('Marked as done')).toBeVisible()

  // It saved: a reload still shows it done.
  expect((await saved).ok()).toBe(true)
  await refreshed
  await page.reload()
  await expect(cardIn(page, 'DONE', name!)).toHaveCount(1)

  // A done card's menu offers it disabled.
  await cardIn(page, 'DONE', name!).click({ button: 'right', position: CORNER })
  await expect(
    page.getByRole('menuitem', { name: 'Mark as done' })
  ).toBeDisabled()
  await page.keyboard.press('Escape')

  await putBack(page, [name!])
})

test('on a selected card, the menu marks every selected task', async ({
  page,
}) => {
  const names = await openMyTasks(page, 2)
  await cardIn(page, 'ON_DECK', names[0]!).click({
    modifiers: ['Shift'],
    position: CORNER,
  })
  await cardIn(page, 'ON_DECK', names[1]!).click({
    modifiers: ['Shift'],
    position: CORNER,
  })
  await cardIn(page, 'ON_DECK', names[1]!).click({
    button: 'right',
    position: CORNER,
  })
  await page.getByRole('menuitem', { name: 'Mark as done' }).click()
  for (const name of names) {
    await expect(cardIn(page, 'DONE', name)).toHaveCount(1)
  }
  await expect(page.getByText('Marked 2 tasks as done')).toBeVisible()
  await page.keyboard.press('Escape')
  await putBack(page, names)
})

test('the bulk bar marks the selected tasks done', async ({ page }) => {
  const names = await openMyTasks(page, 2)
  await cardIn(page, 'ON_DECK', names[0]!).click({
    modifiers: ['Shift'],
    position: CORNER,
  })
  await cardIn(page, 'ON_DECK', names[1]!).click({
    modifiers: ['Shift'],
    position: CORNER,
  })
  await bar(page).getByRole('button', { name: 'Mark as done' }).click()
  for (const name of names) {
    await expect(cardIn(page, 'DONE', name)).toHaveCount(1)
  }
  // Every selected task is done now: nothing left to mark.
  await expect(
    bar(page).getByRole('button', { name: 'Mark as done' })
  ).toBeDisabled()
  await page.keyboard.press('Escape')
  await putBack(page, names)
})

test('the project board marks a task done too', async ({ page }) => {
  await page.goto('/projects')
  await page.waitForLoadState('networkidle')
  const href = await page
    .locator('a[href^="/projects/"]')
    .evaluateAll(anchors =>
      anchors
        .map(a => a.getAttribute('href') ?? '')
        .find(href => /^\/projects\/[^/?#]+\/[^/?#]+/.test(href))
    )
  test.skip(!href, 'no project to open')
  await page.goto(
    `${href!.split(/[?#]/)[0]!.split('/').slice(0, 4).join('/')}/tasks`
  )
  await page.waitForLoadState('networkidle')
  await expectHealthy(page)
  const card = column(page, 'ON_DECK').locator('[data-board-card]').first()
  test.skip(!(await card.count()), 'no task On deck')
  const name = (await card.locator('h3').innerText()).trim()

  await card.click({ button: 'right', position: CORNER })
  const saved = page.waitForResponse(
    response =>
      response.url().includes('/reorder') &&
      response.request().method() !== 'GET'
  )
  await page.getByRole('menuitem', { name: 'Mark as done' }).click()
  await expect(
    column(page, 'DONE').locator('[data-board-card]').first()
  ).toContainText(name)
  expect((await saved).ok()).toBe(true)
  await page.reload()
  await expect(cardIn(page, 'DONE', name)).toHaveCount(1)
  await putBack(page, [name])
})
