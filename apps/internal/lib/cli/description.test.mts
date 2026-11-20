import assert from 'node:assert/strict'
import { test } from 'node:test'

import { toRichTextHtml } from './description'

test('flat bullets stay one list', () => {
  assert.equal(
    toRichTextHtml('- one\n- two'),
    '<ul><li><p>one</p></li><li><p>two</p></li></ul>'
  )
})

test('an indented bullet nests under the one above', () => {
  assert.equal(
    toRichTextHtml('- one\n  - one a\n  - one b\n- two'),
    '<ul><li><p>one</p><ul><li><p>one a</p></li><li><p>one b</p></li></ul></li><li><p>two</p></li></ul>'
  )
})

test('three levels, then back out two at once', () => {
  assert.equal(
    toRichTextHtml('- a\n  - b\n    - c\n- d'),
    '<ul><li><p>a</p><ul><li><p>b</p><ul><li><p>c</p></li></ul></li></ul></li><li><p>d</p></li></ul>'
  )
})

test('tabs nest too', () => {
  assert.equal(
    toRichTextHtml('- a\n\t- b'),
    '<ul><li><p>a</p><ul><li><p>b</p></li></ul></li></ul>'
  )
})

test('numbered items can hold bullets', () => {
  assert.equal(
    toRichTextHtml('1. Step\n   - detail\n2. Next'),
    '<ol><li><p>Step</p><ul><li><p>detail</p></li></ul></li><li><p>Next</p></li></ol>'
  )
})

test('a nested list can switch kind beside its sibling', () => {
  assert.equal(
    toRichTextHtml('- a\n  - b\n  1. c'),
    '<ul><li><p>a</p><ul><li><p>b</p></li></ul><ol><li><p>c</p></li></ol></li></ul>'
  )
})

test('top-level kind change still starts a new list', () => {
  assert.equal(
    toRichTextHtml('- a\n1. b'),
    '<ul><li><p>a</p></li></ul><ol><li><p>b</p></li></ol>'
  )
})

test('an indented first item is the top level', () => {
  assert.equal(
    toRichTextHtml('  - a\n  - b'),
    '<ul><li><p>a</p></li><li><p>b</p></li></ul>'
  )
})

test('text and blank lines end the list', () => {
  assert.equal(
    toRichTextHtml('Intro\n- a\n  - b\n\nAfter'),
    '<p>Intro</p><ul><li><p>a</p><ul><li><p>b</p></li></ul></li></ul><p>After</p>'
  )
})

test('inline markdown works in nested items', () => {
  assert.equal(
    toRichTextHtml('- a\n  - **bold** `x`'),
    '<ul><li><p>a</p><ul><li><p><strong>bold</strong> <code>x</code></p></li></ul></li></ul>'
  )
})

test('HTML passes through untouched', () => {
  const html = '<ul><li><p>a</p><ul><li><p>b</p></li></ul></li></ul>'
  assert.equal(toRichTextHtml(html), html)
})

test('nesting stops at eight levels instead of overflowing', () => {
  const lines = Array.from({ length: 5000 }, (_, i) => `${' '.repeat(i)}- x`)
  const html = toRichTextHtml(lines.join('\n'))
  assert.equal(html.match(/<ul>/g)?.length, 8)
  assert.equal(html.match(/<li>/g)?.length, 5000)
})

test('blank lines between items keep one list and its nesting', () => {
  assert.equal(
    toRichTextHtml('- a\n\n  - b\n\n- c'),
    '<ul><li><p>a</p><ul><li><p>b</p></li></ul></li><li><p>c</p></li></ul>'
  )
  assert.equal(
    toRichTextHtml('1. a\n\n2. b'),
    '<ol><li><p>a</p></li><li><p>b</p></li></ol>'
  )
})
