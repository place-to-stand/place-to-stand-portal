import { execFileSync } from 'node:child_process'

import { expect, test, type Page } from '@playwright/test'

import { expectHealthy, waitForList } from './helpers'

/**
 * Bulk archive, restore and acknowledge against a throwaway database:
 * each test puts back what it archives. Run only with E2E_WRITES=1.
 */
test.skip(!process.env.E2E_WRITES, 'set E2E_WRITES=1 on a throwaway database')
test.describe.configure({ mode: 'serial' })

const bar = (page: Page) => page.getByRole('toolbar', { name: /Bulk actions/ })

async function open(page: Page, path: string) {
  await page.goto(path)
  await waitForList(page)
  await expectHealthy(page)
}

async function tick(page: Page, names: string[]) {
  for (const name of names) {
    await page
      .locator('tbody tr', { hasText: name })
      .first()
      .locator('td[data-slot=table-select-cell]')
      .click()
  }
  await expect(bar(page)).toContainText(`${names.length} `)
}

async function confirmArchive(page: Page) {
  await bar(page).getByRole('button', { name: 'Archive' }).click()
  const dialog = page.getByRole('alertdialog')
  await dialog.getByRole('button', { name: /^Archive/ }).click()
  await expect(dialog).toHaveCount(0)
}

async function expectToast(page: Page, text: string | RegExp) {
  await expect(
    page.locator('div[aria-live=polite]', {
      hasText: text,
    })
  ).not.toHaveCount(0)
}

async function expectRows(page: Page, names: string[], count: number) {
  for (const name of names) {
    await expect(page.locator('tbody tr', { hasText: name })).toHaveCount(count)
  }
}

/** Archive the named rows from `list`, then restore them from `archive`. */
async function roundTrip(
  page: Page,
  list: string,
  archive: string,
  names: string[],
  plural: string
) {
  await open(page, list)
  await tick(page, names)
  await confirmArchive(page)
  await expectToast(page, `${names.length} ${plural} archived`)
  await expect(bar(page)).toHaveCount(0)
  await expectRows(page, names, 0)

  await open(page, archive)
  await tick(page, names)
  await bar(page).getByRole('button', { name: 'Restore' }).click()
  await expectToast(page, `${names.length} ${plural} restored`)
  await expectRows(page, names, 0)

  await open(page, list)
  await expectRows(page, names, 1)
}

test('companies: archive and restore', async ({ page }) => {
  await roundTrip(
    page,
    '/companies?q=Company%2005',
    '/companies/archive?q=Company%2005',
    ['Company 051', 'Company 052', 'Company 053'],
    'companies'
  )
})

test('companies: a client is refused, the rest go through', async ({
  page,
}) => {
  await open(page, '/companies?q=Company%2001')
  await tick(page, ['Company 010', 'Company 011'])
  await confirmArchive(page)
  await expectToast(page, '1 company archived, 1 not')
  await expectToast(page, /Company 010/)
  await expectRows(page, ['Company 010'], 1)
  await expectRows(page, ['Company 011'], 0)

  await open(page, '/companies/archive?q=Company%20011')
  await tick(page, ['Company 011'])
  await bar(page).getByRole('button', { name: 'Restore' }).click()
  await expectToast(page, '1 company restored')
})

test('people: select every matching row, archive, restore', async ({
  page,
}) => {
  await open(page, '/people?q=Person')
  await page.getByRole('checkbox', { name: /^Select all/ }).click()
  await bar(page)
    .getByRole('button', { name: /Select all 120 people/ })
    .click()
  await expect(bar(page)).toContainText('All 120 people selected')
  await confirmArchive(page)
  await expectToast(page, '120 people archived')
  await expect(page.locator('td[data-slot=table-select-cell]')).toHaveCount(0)

  await open(page, '/people/archive?q=Person')
  await page.getByRole('checkbox', { name: /^Select all/ }).click()
  await bar(page)
    .getByRole('button', { name: /Select all 120 people/ })
    .click()
  await bar(page).getByRole('button', { name: 'Restore' }).click()
  await expectToast(page, '120 people restored')

  await open(page, '/people?q=Person%20001')
  await expectRows(page, ['Person 001'], 1)
})

test('projects: archive and restore across tables', async ({ page }) => {
  await roundTrip(
    page,
    '/projects',
    '/projects/archive',
    ['Project 01', 'Internal tools'],
    'projects'
  )
})

test('hour blocks, invoices and time logs: archive and restore', async ({
  page,
}) => {
  for (const [list, plural] of [
    ['/hour-blocks', 'hour blocks'],
    ['/invoices', 'invoices'],
    ['/time-logs', 'time logs'],
  ] as const) {
    await open(page, list)
    const rows = page.locator('tbody tr:has(td[data-slot=table-select-cell])')
    const before = await rows.count()
    await rows.nth(0).locator('td[data-slot=table-select-cell]').click()
    await rows.nth(1).locator('td[data-slot=table-select-cell]').click()
    await confirmArchive(page)
    await expectToast(page, `2 ${plural} archived`)

    await open(page, `${list}/archive`)
    await page.getByRole('checkbox', { name: /^Select all/ }).click()
    await bar(page).getByRole('button', { name: 'Restore' }).click()
    await expectToast(page, `2 ${plural} restored`)

    await open(page, list)
    await expect(rows).toHaveCount(before)
  }
})

test('submissions: a row changed since it was shown is not acknowledged', async ({
  page,
}) => {
  await open(page, '/submissions?q=Sender%20001')
  await tick(page, ['Sender 001'])
  // A visitor comes back to the form after the page loaded.
  execFileSync('psql', [
    process.env.E2E_DATABASE_URL ??
      'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
    '-c',
    "update form_submissions set last_activity_at = now() where contact_name = 'Sender 001'",
  ])
  await bar(page).getByRole('button', { name: 'Acknowledge' }).click()
  await expectToast(page, /Unable to acknowledge/)
  await expectToast(page, /changed since you viewed it/)
})

test('submissions: acknowledge every unread row', async ({ page }) => {
  await open(page, '/submissions?unacknowledged=1')
  const unread = await page
    .locator('tbody tr:has(td[data-slot=table-select-cell])')
    .count()
  expect(unread).toBeGreaterThan(0)
  await page.getByRole('checkbox', { name: /^Select all/ }).click()
  const all = bar(page).getByRole('button', { name: /^Select all \d+/ })
  if (await all.count()) await all.click()
  await bar(page).getByRole('button', { name: 'Acknowledge' }).click()
  await expectToast(page, /submissions? acknowledged/)
  await open(page, '/submissions?unacknowledged=1')
  await expect(page.locator('td[data-slot=table-select-cell]')).toHaveCount(0)
})

test('a failed call shows a toast and keeps the page', async ({ page }) => {
  await open(page, '/companies?q=Company%2005')
  await tick(page, ['Company 051', 'Company 052'])
  // The server action never answers (a timeout, a lost connection).
  await page.route('**/*', route =>
    route.request().method() === 'POST' &&
    route.request().headers()['next-action']
      ? route.abort('failed')
      : route.continue()
  )
  await confirmArchive(page)
  await expectToast(page, /Unable to archive/)
  await expectHealthy(page)
  await page.unroute('**/*')
  await open(page, '/companies?q=Company%2005')
  await expectRows(page, ['Company 051', 'Company 052'], 1)
})
