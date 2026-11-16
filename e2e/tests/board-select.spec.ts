import { expect, test, type Locator, type Page } from '@playwright/test'

import { expectHealthy } from './helpers'

/**
 * Selecting cards on the task and lead boards: Shift picks a range down one
 * column, ⌘ (Ctrl off a Mac) adds or drops one card, a plain click still
 * opens the card, and Escape clears. Read-only: nothing is saved.
 *
 *   E2E_BOARD_PATH  a project board with three or more cards in one column,
 *                   e.g. /projects/acme/site/tasks (found on /projects
 *                   when unset)
 */

const bar = (page: Page) => page.getByRole('toolbar', { name: /Bulk actions/ })
const selected = (page: Page) =>
  page.locator('[data-board-card][data-selected]')

/**
 * A card's top-left padding: the middle of a card can be a link (a lead's
 * email), which takes the click for itself.
 */
const CORNER = { x: 10, y: 6 }

/**
 * A Ctrl-click as the page sees it. Sent as an event, since macOS turns a
 * real Ctrl-click into a right click before the page gets it.
 */
async function ctrlClick(card: Locator) {
  await card.dispatchEvent('click', { ctrlKey: true, bubbles: true })
}

/** Pretend to be a Mac or a Windows PC before the app reads the platform. */
async function onPlatform(page: Page, platform: 'MacIntel' | 'Win32') {
  await page.addInitScript(value => {
    Object.defineProperty(Navigator.prototype, 'platform', {
      get: () => value,
    })
  }, platform)
}

/** The first column with at least `count` cards, and those cards. */
async function columnWith(page: Page, count: number) {
  const columns = page.locator('[data-board-column]')
  await expect(columns.first()).toBeVisible()
  for (let index = 0; index < (await columns.count()); index++) {
    const cards = columns.nth(index).locator('[data-board-card]')
    if ((await cards.count()) >= count) return cards
  }
  return null
}

/** A second column's first card, for a range across columns. */
async function cardInAnotherColumn(page: Page, card: Locator) {
  const own = await card.evaluate(node =>
    node.closest('[data-board-column]')?.getAttribute('data-board-column')
  )
  const other = page
    .locator(`[data-board-column]:not([data-board-column="${own}"])`)
    .locator('[data-board-card]')
  return (await other.count()) ? other.first() : null
}

async function openBoard(page: Page) {
  let path = process.env.E2E_BOARD_PATH
  if (!path) {
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
    path = `${href!.split(/[?#]/)[0].split('/').slice(0, 4).join('/')}/tasks`
  }
  await page.goto(path)
  await page.waitForLoadState('networkidle')
  await expectHealthy(page)
}

async function openLeads(page: Page) {
  await page.goto('/leads')
  await page.waitForLoadState('networkidle')
  await expectHealthy(page)
}

for (const board of [
  { name: 'project board', open: openBoard, word: 'task' },
  { name: 'leads board', open: openLeads, word: 'lead' },
]) {
  test.describe(board.name, () => {
    test('⌘-click adds and drops one card without opening it', async ({
      page,
    }) => {
      await onPlatform(page, 'MacIntel')
      await board.open(page)
      const cards = await columnWith(page, 2)
      test.skip(!cards, 'no column with two cards')

      const url = page.url()
      await cards!.nth(0).click({ modifiers: ['Meta'], position: CORNER })
      await expect(cards!.nth(0)).toHaveAttribute('data-selected', 'true')
      await expect(bar(page)).toContainText(`1 ${board.word} selected`)
      expect(page.url()).toBe(url)
      await expect(page.getByRole('dialog')).toHaveCount(0)

      await cards!.nth(1).click({ modifiers: ['Meta'], position: CORNER })
      await expect(bar(page)).toContainText(`2 ${board.word}s selected`)

      // ⌘ again drops it.
      await cards!.nth(0).click({ modifiers: ['Meta'], position: CORNER })
      await expect(cards!.nth(0)).not.toHaveAttribute('data-selected')
      await expect(bar(page)).toContainText(`1 ${board.word} selected`)
      await cards!.nth(1).click({ modifiers: ['Meta'], position: CORNER })
      await expect(bar(page)).toHaveCount(0)
    })

    test('Shift-click picks a range down one column, and back off', async ({
      page,
    }) => {
      await board.open(page)
      const cards = await columnWith(page, 3)
      test.skip(!cards, 'no column with three cards')

      await cards!.nth(0).click({ modifiers: ['Shift'], position: CORNER })
      await cards!.nth(2).click({ modifiers: ['Shift'], position: CORNER })
      await expect(selected(page)).toHaveCount(3)
      await expect(bar(page)).toContainText(`3 ${board.word}s selected`)
      // Shift on a selected card takes the range back off.
      await cards!.nth(0).click({ modifiers: ['Shift'], position: CORNER })
      await expect(selected(page)).toHaveCount(0)
      await expect(bar(page)).toHaveCount(0)

      // Shift-click doesn't select the cards' text.
      const text = await page.evaluate(() => String(window.getSelection()))
      expect(text).toBe('')
    })

    test('Shift-click into another column picks just that card', async ({
      page,
    }) => {
      await board.open(page)
      const cards = await columnWith(page, 1)
      test.skip(!cards, 'no cards')
      const other = await cardInAnotherColumn(page, cards!.first())
      test.skip(!other, 'only one column has cards')

      await cards!.first().click({ modifiers: ['Shift'], position: CORNER })
      await other!.click({ modifiers: ['Shift'], position: CORNER })
      await expect(selected(page)).toHaveCount(2)
    })

    test('Escape clears, but first closes a menu over the board', async ({
      page,
    }) => {
      await board.open(page)
      const cards = await columnWith(page, 2)
      test.skip(!cards, 'no column with two cards')

      await cards!.nth(0).click({ modifiers: ['Shift'], position: CORNER })
      await cards!.nth(1).click({ modifiers: ['Shift'], position: CORNER })
      await expect(selected(page)).toHaveCount(2)

      await bar(page)
        .getByRole('button', { name: /Set assignee/ })
        .click()
      await expect(page.getByRole('menu')).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(page.getByRole('menu')).toHaveCount(0)
      await expect(selected(page)).toHaveCount(2)

      await page.keyboard.press('Escape')
      await expect(selected(page)).toHaveCount(0)
      await expect(bar(page)).toHaveCount(0)
    })

    test('a plain click still opens the card', async ({ page }) => {
      await board.open(page)
      const cards = await columnWith(page, 1)
      test.skip(!cards, 'no cards')

      await cards!.first().click({ position: CORNER })
      await expect(page.getByRole('dialog')).toBeVisible()
      await expect(page).toHaveURL(
        new RegExp(`[?&]${board.word}=[0-9a-f-]{36}`)
      )
      await expect(selected(page)).toHaveCount(0)
    })

    test('the right-click menu has no Select item', async ({ page }) => {
      await board.open(page)
      const cards = await columnWith(page, 1)
      test.skip(!cards, 'no cards')

      await cards!.first().click({ button: 'right', position: CORNER })
      const menu = page.getByRole('menu')
      await expect(menu.getByRole('menuitem', { name: 'Edit' })).toBeVisible()
      await expect(menu.getByRole('menuitem', { name: /^Select/ })).toHaveCount(
        0
      )
      await page.keyboard.press('Escape')
    })
  })
}

test('on Windows, Ctrl-click adds a card', async ({ page }) => {
  await onPlatform(page, 'Win32')
  await openBoard(page)
  const cards = await columnWith(page, 1)
  test.skip(!cards, 'no cards')

  const url = page.url()
  await ctrlClick(cards!.first())
  await expect(selected(page)).toHaveCount(1)
  expect(page.url()).toBe(url)
})

test('on a Mac, Ctrl-click never selects (it is a right click there)', async ({
  page,
}) => {
  await onPlatform(page, 'MacIntel')
  await openBoard(page)
  const cards = await columnWith(page, 1)
  test.skip(!cards, 'no cards')

  await ctrlClick(cards!.first())
  await expect(selected(page)).toHaveCount(0)
})

test('the bulk bar offers assignee, due date and archive for tasks', async ({
  page,
}) => {
  await openBoard(page)
  const cards = await columnWith(page, 1)
  test.skip(!cards, 'no cards')

  await cards!.first().click({ modifiers: ['Shift'], position: CORNER })
  for (const name of [/Set assignee/, /Set due date/, /^Archive/]) {
    await expect(bar(page).getByRole('button', { name })).toBeVisible()
  }

  // The assignee menu lists people (or says it can't), never hangs.
  await bar(page)
    .getByRole('button', { name: /Set assignee/ })
    .click()
  const menu = page.getByRole('menu')
  await expect(menu.getByText('Loading people…')).toHaveCount(0)
  await expect(
    menu.getByRole('menuitem', { name: 'Clear assignee' })
  ).toBeVisible()
  await page.keyboard.press('Escape')

  // The due date menu has quick picks, a calendar and Clear.
  await bar(page)
    .getByRole('button', { name: /Set due date/ })
    .click()
  await expect(menu.getByRole('menuitem', { name: 'Today' })).toBeVisible()
  await expect(menu.getByRole('grid')).toBeVisible()
  await expect(
    menu.getByRole('menuitem', { name: 'Clear due date' })
  ).toBeVisible()
  await page.keyboard.press('Escape')
})

test('the lead bulk bar has no due date', async ({ page }) => {
  await openLeads(page)
  const cards = await columnWith(page, 1)
  test.skip(!cards, 'no leads')

  await cards!.first().click({ modifiers: ['Shift'], position: CORNER })
  await expect(
    bar(page).getByRole('button', { name: /Set assignee/ })
  ).toBeVisible()
  await expect(
    bar(page).getByRole('button', { name: /Set due date/ })
  ).toHaveCount(0)
})

test('My Tasks for everyone: cards select and keep their full menu', async ({
  page,
}) => {
  await page.goto('/my/tasks/board?assignee=all')
  await page.waitForLoadState('networkidle')
  await expectHealthy(page)
  const cards = await columnWith(page, 1)
  test.skip(!cards, 'no tasks on anyone')

  await cards!.first().click({ modifiers: ['Shift'], position: CORNER })
  await expect(bar(page)).toContainText('1 task selected')
  await page.keyboard.press('Escape')

  // Every edit, reordering too (it saves the viewer's own order).
  await cards!.first().click({ button: 'right', position: CORNER })
  const menu = page.getByRole('menu')
  await expect(
    menu.getByRole('menuitem', { name: /Set assignee/ })
  ).toBeVisible()
  await expect(menu.getByRole('menuitem', { name: /Archive/ })).toBeVisible()
  await page.keyboard.press('Escape')
})

test('a card focused by closing its sheet still shows it is selected', async ({
  page,
}) => {
  await openBoard(page)
  const cards = await columnWith(page, 1)
  test.skip(!cards, 'no cards')
  const card = cards!.first()

  await card.click({ position: CORNER })
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await card.click({ modifiers: ['Shift'], position: CORNER })
  await expect(card).toHaveAttribute('data-selected', 'true')
  // The selected border, not the focus ring's grey, and no browser outline.
  const primary = await page.evaluate(() => {
    const probe = document.createElement('div')
    probe.className = 'border border-primary'
    document.body.append(probe)
    const color = getComputedStyle(probe).borderTopColor
    probe.remove()
    return color
  })
  // Polled: the card's border colour eases in over a moment.
  await expect
    .poll(() => card.evaluate(node => getComputedStyle(node).borderTopColor))
    .toBe(primary)
  expect(await card.evaluate(node => getComputedStyle(node).outlineStyle)).toBe(
    'none'
  )
})

for (const board of [
  { name: 'project board', open: openBoard },
  { name: 'leads board', open: openLeads },
]) {
  test(`${board.name}: dragging a selected card carries the others, as a stack`, async ({
    page,
  }) => {
    await board.open(page)
    const cards = await columnWith(page, 3)
    test.skip(!cards, 'no column with three cards')

    await cards!.nth(0).click({ modifiers: ['Shift'], position: CORNER })
    await cards!.nth(2).click({ modifiers: ['Shift'], position: CORNER })
    await expect(selected(page)).toHaveCount(3)

    // Pick up the middle card; the other two leave the column while it moves.
    const box = (await cards!.nth(1).boundingBox())!
    await page.mouse.move(box.x + 10, box.y + 6)
    await page.mouse.down()
    await page.mouse.move(box.x + 30, box.y + 40, { steps: 5 })
    await expect(page.locator('[data-drag-count="3"]')).toBeVisible()

    // Escape puts everything back without saving.
    await page.keyboard.press('Escape')
    await page.mouse.up()
    await expect(selected(page)).toHaveCount(3)
  })
}
