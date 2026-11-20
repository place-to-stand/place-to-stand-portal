import assert from 'node:assert/strict'
import { test } from 'node:test'

import { isMarkdownPaste, markdownToHtml } from './markdown'

test('Markdown blocks are recognised', () => {
  for (const text of [
    '# Title',
    '- one\n- two',
    '* one',
    '1. first',
    '> quoted',
    '```\ncode\n```',
    'Intro\n\n  - nested',
    '- [ ] todo',
  ]) {
    assert.equal(isMarkdownPaste(text, null), true, text)
  }
})

test('Markdown inline marks are recognised', () => {
  for (const text of [
    'a **bold** word',
    'see [docs](https://x.y)',
    'run `npm i`',
    '~~gone~~',
  ]) {
    assert.equal(isMarkdownPaste(text, null), true, text)
  }
})

test('plain text keeps the normal paste', () => {
  for (const text of [
    'Just a sentence.',
    'https://example.com/a_b_c',
    '2 * 3 * 4 = 24',
    'snake_case_name',
    '#hashtag',
    'Line one\nLine two',
    '',
  ]) {
    assert.equal(isMarkdownPaste(text, null), false, text)
  }
})

test('formatted HTML from the source wins', () => {
  assert.equal(isMarkdownPaste('- a', '<ul><li>a</li></ul>'), false)
  assert.equal(isMarkdownPaste('**a**', '<p><strong>a</strong></p>'), false)
})

test("a code editor's coloured spans still convert", () => {
  assert.equal(
    isMarkdownPaste(
      '# Title\n- item',
      '<div style="color:#ccc"><div><span style="color:#569cd6"># Title</span></div></div>'
    ),
    true
  )
})

test('converts lists, nesting, headings and marks', () => {
  assert.equal(
    markdownToHtml(
      '## Plan\n\n- **one**\n  - one a\n- [link](https://x.y)'
    ).replace(/\n/g, ''),
    '<h2>Plan</h2><ul><li><strong>one</strong><ul><li>one a</li></ul></li><li><a href="https://x.y">link</a></li></ul>'
  )
})

test('raw HTML in the text is escaped', () => {
  assert.equal(
    markdownToHtml('- <img src=x onerror=alert(1)>').replace(/\n/g, ''),
    '<ul><li>&lt;img src=x onerror=alert(1)&gt;</li></ul>'
  )
})

test('task lists come out as checkboxes', () => {
  assert.match(
    markdownToHtml('- [x] done\n- [ ] todo'),
    /<input type="checkbox" disabled="" checked="" \/>/
  )
})
