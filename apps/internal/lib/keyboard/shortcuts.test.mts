// Run: npx tsx --test apps/internal/lib/keyboard/shortcuts.test.mts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { formatShortcut } from './format.ts'
import { matchesShortcut } from './match.ts'
import { SHORTCUTS, shortcutsByGroup } from './shortcuts.ts'

const press = (key: string, mods: Partial<Record<string, boolean>> = {}) => ({
  key,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  ...mods,
})

test('mod means ⌘ or Ctrl', () => {
  assert.ok(matchesShortcut(press('s', { metaKey: true }), SHORTCUTS.save))
  assert.ok(matchesShortcut(press('s', { ctrlKey: true }), SHORTCUTS.save))
  assert.ok(!matchesShortcut(press('s'), SHORTCUTS.save))
})

test('Shift tells undo from redo', () => {
  const undo = press('z', { metaKey: true })
  const redo = press('Z', { metaKey: true, shiftKey: true })
  assert.ok(matchesShortcut(undo, SHORTCUTS.undo))
  assert.ok(!matchesShortcut(redo, SHORTCUTS.undo))
  assert.ok(matchesShortcut(redo, SHORTCUTS.redo))
  assert.ok(!matchesShortcut(undo, SHORTCUTS.redo))
})

test('ctrl+y redoes, ⌘Y does not', () => {
  assert.ok(matchesShortcut(press('y', { ctrlKey: true }), SHORTCUTS.redo))
  assert.ok(!matchesShortcut(press('y', { metaKey: true }), SHORTCUTS.redo))
})

test('? needs Shift on the keyboard but not in the registry', () => {
  assert.ok(
    matchesShortcut(press('?', { shiftKey: true }), SHORTCUTS.showShortcuts)
  )
  assert.ok(
    !matchesShortcut(press('?', { metaKey: true }), SHORTCUTS.showShortcuts)
  )
})

test('brackets cycle projects', () => {
  assert.ok(
    matchesShortcut(press('[', { metaKey: true }), SHORTCUTS.previousProject)
  )
  assert.ok(
    matchesShortcut(press(']', { ctrlKey: true }), SHORTCUTS.nextProject)
  )
})

test('labels follow the platform', () => {
  assert.equal(formatShortcut('mod+shift+z', true), '⇧⌘Z')
  assert.equal(formatShortcut('mod+alt+1', true), '⌥⌘1')
  assert.equal(formatShortcut('mod+shift+z', false), 'Ctrl+Shift+Z')
  assert.equal(formatShortcut('mod+,', true), '⌘,')
  assert.equal(formatShortcut('escape', false), 'Esc')
})

test('every shortcut is listed, and none twice in one group', () => {
  const sections = shortcutsByGroup()
  const listed = sections.flatMap(section => section.shortcuts)
  assert.equal(listed.length, Object.keys(SHORTCUTS).length)
  for (const section of sections) {
    const keys = section.shortcuts.map(shortcut => shortcut.keys)
    assert.equal(new Set(keys).size, keys.length, section.group)
  }
})

test('AltGr symbols still match (German [ is AltGr+8)', () => {
  assert.ok(
    matchesShortcut(
      press('[', { ctrlKey: true, altKey: true }),
      SHORTCUTS.previousProject
    )
  )
  assert.ok(
    !matchesShortcut(
      press('s', { metaKey: true, altKey: true }),
      SHORTCUTS.save
    )
  )
})

test('named keys read as words', () => {
  assert.equal(formatShortcut('shift+tab', false), 'Shift+Tab')
  assert.equal(formatShortcut('option+delete', true), '⌥⌦')
})

test('Enter sends, Shift+Enter does not', () => {
  assert.ok(matchesShortcut(press('Enter'), SHORTCUTS.sendPlanningMessage))
  assert.ok(
    !matchesShortcut(
      press('Enter', { shiftKey: true }),
      SHORTCUTS.sendPlanningMessage
    )
  )
})
