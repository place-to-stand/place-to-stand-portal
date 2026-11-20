import assert from 'node:assert/strict'
import { test } from 'node:test'

import { sanitizeRichTextHtmlCore as clean } from './sanitize-core'

test('alignment survives on paragraphs and headings, other styles go', () => {
  assert.equal(
    clean(
      '<p style="text-align: center; color: red">a</p><h2 style="text-align:right">b</h2><p style="position: fixed">c</p>'
    ),
    '<p style="text-align:center">a</p><h2 style="text-align:right">b</h2><p>c</p>'
  )
})

test('highlights keep their palette colour', () => {
  assert.equal(
    clean(
      '<mark data-color="var(--tt-color-highlight-yellow)" style="background-color: var(--tt-color-highlight-yellow); color: inherit">hi</mark>'
    ),
    '<mark data-color="var(--tt-color-highlight-yellow)" style="background-color:var(--tt-color-highlight-yellow);color:inherit">hi</mark>'
  )
})

test('a highlight with an unsafe colour keeps its text and loses the colour', () => {
  assert.equal(
    clean(
      '<mark style="background-color: url(javascript:alert(1))">a</mark><mark data-color="red;x:y">b</mark>'
    ),
    '<mark>a</mark><mark>b</mark>'
  )
})

test('superscript and subscript survive', () => {
  assert.equal(
    clean('<p>x<sup>2</sup>H<sub>2</sub>O</p>'),
    '<p>x<sup>2</sup>H<sub>2</sub>O</p>'
  )
})

test('checklists survive with their ticks', () => {
  assert.equal(
    clean(
      '<ul data-type="taskList"><li data-checked="true" data-type="taskItem"><label><input type="checkbox" checked="checked"><span></span></label><div><p>done</p></div></li><li data-checked="false" data-type="taskItem"><label><input type="checkbox"><span></span></label><div><p>todo</p></div></li></ul>'
    ),
    '<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked="checked" /><span></span></label><div><p>done</p></div></li><li data-type="taskItem" data-checked="false"><label><input type="checkbox" /><span></span></label><div><p>todo</p></div></li></ul>'
  )
})

test('only checkbox inputs are kept, and divs lose their attributes', () => {
  assert.equal(
    clean(
      '<input type="text" value="x"><input type="image" src=x onerror=alert(1)><div onclick="x" class="y">d</div>'
    ),
    '<div>d</div>'
  )
})

test('other data attributes and types are dropped', () => {
  assert.equal(
    clean(
      '<ul data-type="evil"><li data-type="x" data-checked="maybe"><p>a</p></li></ul>'
    ),
    '<ul><li><p>a</p></li></ul>'
  )
})

test('nested lists survive', () => {
  const html = '<ul><li><p>a</p><ul><li><p>b</p></li></ul></li></ul>'
  assert.equal(clean(html), html)
})

test('links keep a safe href only', () => {
  assert.equal(
    clean(
      '<a href="javascript:alert(1)">l</a><a href="example.com" style="color:red">ok</a>'
    ),
    '<span>l</span><a href="https://example.com" target="_blank" rel="noreferrer noopener">ok</a>'
  )
})
