import { expect, test } from '@playwright/test'

// A searchable combobox opens with its selected option in view and
// highlighted; after that, scrolling and hovering are left alone, so an
// option scrolled to can be clicked. Uses the /design specimen (no data).
test('a combobox opens on its selection, and a scrolled-to option can be picked', async ({
  page,
}) => {
  await page.goto('/design?tab=components')
  const trigger = page.locator('button[aria-label="Person"]').first()
  await trigger.scrollIntoViewIfNeeded()
  await expect(trigger).toContainText('Radia Perlman')
  await trigger.click()

  const list = page.locator('[cmdk-list]')
  const highlighted = list.locator('[cmdk-item][data-selected="true"]')
  await expect(highlighted).toContainText('Radia Perlman')
  await expect(highlighted).toBeInViewport()

  // Scroll to the top, hover the first option: no snap back, and it picks.
  const box = (await list.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.wheel(0, -5000)
  const first = list.locator('[cmdk-item]').first()
  await first.hover()
  await expect(first).toHaveAttribute('data-selected', 'true')
  await expect(first).toBeInViewport()
  await first.click()
  await expect(trigger).toContainText('Ada Lovelace')

  // Reopening centres the new choice; typing returns to the top match.
  await trigger.click()
  await expect(list.locator('[cmdk-item][data-selected="true"]')).toContainText(
    'Ada Lovelace'
  )
  await page.keyboard.type('grace')
  await expect(list.locator('[cmdk-item][data-selected="true"]')).toContainText(
    'Grace Hopper'
  )
})
