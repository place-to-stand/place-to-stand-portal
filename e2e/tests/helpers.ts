import { expect, type Page } from '@playwright/test'

/** Every list page this PR touches, with its heading. */
export const LIST_PAGES = [
  '/companies',
  '/companies/archive',
  '/people',
  '/people/archive',
  '/projects',
  '/projects/archive',
  '/time-logs',
  '/hour-blocks',
  '/hour-blocks/archive',
  '/invoices',
  '/invoices/archive',
  '/leads/archive',
  '/submissions',
]

/** Routes kept only for old bookmarks: the app must never link to them. */
export const REDIRECT_ONLY = [
  /^\/clients(\/|$|\?)/,
  /^\/contacts(\/|$|\?)/,
  /^\/settings\/users(\/|$|\?)/,
  /[?&]client=/,
  /[?&]user=/,
]

export async function expectHealthy(page: Page) {
  await expect(page.locator('body')).not.toContainText('Application error')
  await expect(page.locator('body')).not.toContainText(
    'Unhandled Runtime Error'
  )
  await expect(page.locator('nextjs-portal [data-nextjs-dialog]')).toHaveCount(
    0
  )
}

/** Waits for the page's list (or its empty state) to render. */
export async function waitForList(page: Page) {
  await page.waitForLoadState('networkidle')
}

export async function inAppHrefs(page: Page) {
  return page.$$eval('a[href]', anchors =>
    anchors
      .map(a => a.getAttribute('href') ?? '')
      .filter(href => href.startsWith('/') || href.startsWith('?'))
  )
}

/** Heights of body rows, leaving out empty-state rows. */
export async function rowHeights(page: Page) {
  return page.$$eval('tbody tr', rows =>
    rows
      .filter(row => !row.querySelector('td[colspan].p-4'))
      .map((row, index, all) => ({
        height: Math.round(row.getBoundingClientRect().height),
        last: index === all.length - 1,
        group: Boolean(row.querySelector('td[colspan]')),
      }))
  )
}
