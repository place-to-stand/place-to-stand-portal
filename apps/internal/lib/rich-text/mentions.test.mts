import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  addedMentionIds,
  excerptAround,
  extractMentionIds,
  mentionLabel,
} from './mentions.ts'
import { sanitizeRichTextHtmlCore } from './sanitize-core.ts'

const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'
const mention = (id: string, label = 'Ada') =>
  `<span data-type="mention" data-id="${id}" data-label="${label}">@${label}</span>`

test('finds each mentioned person once, in order', () => {
  assert.deepEqual(
    extractMentionIds(
      `<p>${mention(B)} and ${mention(A)} and ${mention(B)}</p>`
    ),
    [B, A]
  )
})

test('ignores spans that are not mentions and ids that are not uuids', () => {
  assert.deepEqual(
    extractMentionIds(
      `<p><span data-id="${A}">x</span><span data-type="mention" data-id="nope">y</span></p>`
    ),
    []
  )
  assert.deepEqual(extractMentionIds(null), [])
})

test('reads attributes in any order and quote style', () => {
  assert.deepEqual(
    extractMentionIds(
      `<span data-id='${A.toUpperCase()}' class=x data-type=mention>@A</span>`
    ),
    [A]
  )
})

test('an edit only adds the newly mentioned', () => {
  assert.deepEqual(addedMentionIds(`${mention(A)}${mention(B)}`, mention(A)), [
    B,
  ])
  assert.deepEqual(
    addedMentionIds(mention(A), `${mention(A)}${mention(B)}`),
    []
  )
})

test('the server cleaner keeps a mention and drops anything else on it', () => {
  const html = sanitizeRichTextHtmlCore(
    `<p><span data-type="mention" data-id="${A}" data-label="Ada" class="x" onclick="alert(1)" style="color:red">@Ada</span></p>`
  )
  assert.equal(
    html,
    `<p><span data-type="mention" data-id="${A}" data-label="Ada">@Ada</span></p>`
  )
  assert.deepEqual(extractMentionIds(html), [A])
})

test('the server cleaner strips a mention with a bad id to plain text', () => {
  assert.equal(
    sanitizeRichTextHtmlCore(
      '<p><span data-type="mention" data-id="1 OR 1">@x</span></p>'
    ),
    '<p><span>@x</span></p>'
  )
})

test('mentionLabel reads the name of one person’s mention', () => {
  const id = '11111111-1111-4111-8111-111111111111'
  const html = `<p>Hi <span data-type="mention" data-id="${id.toUpperCase()}" data-label="Dana Reyes">@Dana Reyes</span></p>`
  assert.equal(mentionLabel(html, id), 'Dana Reyes')
  assert.equal(mentionLabel(html, '22222222-2222-4222-8222-222222222222'), null)
})

test('excerptAround keeps short text whole and centres on the mention', () => {
  assert.equal(excerptAround('  short   text ', '@Dana'), 'short text')
  const long = `${'word '.repeat(60)}ping @Dana about the invoice ${'tail '.repeat(40)}`
  const excerpt = excerptAround(long, '@Dana')
  assert.ok(excerpt.includes('@Dana about the invoice'))
  assert.ok(excerpt.startsWith('…') && excerpt.endsWith('…'))
  assert.equal(Array.from(excerpt).length, 140)
  const head = excerptAround(long, null)
  assert.ok(!head.startsWith('…') && head.endsWith('…'))
  assert.equal(Array.from(head).length, 140)
})
