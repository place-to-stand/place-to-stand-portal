/**
 * `pts/copy`: how text people read is written, one rule. Each check quotes
 * the design-system rule it enforces and says what to write instead.
 *
 *   toast      House rule 14: no "Failed to", "successfully", "!" or an
 *              "Error" title in a toast
 *   ellipsis   Content fundamentals: placeholders end with "…" (fixable)
 *   optional   input.md: <FormLabel optional>, never a hand-written "(optional)"
 *   details    sheet.md: no generic "Details" section heading
 *   words      Content fundamentals: the retired entity words ("contact",
 *              "account", client-portal "user" / "client", "Partners",
 *              "Delete forever"); on when the `portal` option is set
 *   figures    Content fundamentals: hours, money and percentages only
 *              through @pts/ui/numbers, never glued on by hand
 *
 * Options: `portal` ('internal' or 'client': which word list applies),
 * `exceptions` (the files where one check is off) and `root`, the directory
 * the exception globs are relative to (the app's, so eslint can run from
 * the repo root). A deliberate use (the
 * website's contact form, a CSS width) takes an eslint-disable comment that
 * says why.
 */
import { WORDS, isCode, looksLikeProse, retiredWord } from './copy-words.mjs'
import {
  EXCEPTIONS_SCHEMA,
  README,
  attrValue,
  checkIsOn,
  jsxName,
  staticStrings,
} from './utils.mjs'

// ── figures ─────────────────────────────────────────────────────────────

const LOCAL_FORMATTER =
  /^(?:formatHours|formatCurrency|formatMoney|formatUsd|formatDollars|formatPercent|formatRate|formatTaxRate)$/
/** The expression under `x?.y`, `x as T` and `x!`. */
const unwrap = node =>
  node &&
  /^(?:ChainExpression|TSAsExpression|TSSatisfiesExpression|TSNonNullExpression)$/.test(
    node.type
  )
    ? unwrap(node.expression)
    : node
const keyName = key =>
  key?.name ?? (typeof key?.value === 'string' ? key.value : '')
const isToFixed = raw => {
  const node = unwrap(raw)
  return (
    node?.type === 'CallExpression' &&
    node.callee.type === 'MemberExpression' &&
    node.callee.property.name === 'toFixed'
  )
}

/** What a template's text right after an expression glues onto it, or null. */
function gluedAfter(expression, text, previousText) {
  if (/^(?:h\b(?![-\w])| hrs?\b)/.test(text)) return 'an hours suffix'
  if (isToFixed(expression) && /^\s?(?:h|hrs?|hours?)\b/.test(text))
    return 'an hours suffix'
  // `%${q}%` is a SQL LIKE pattern, not a percent.
  if (/^%/.test(text) && !/%$/.test(previousText)) return 'a percent sign'
  if (isToFixed(expression) && /^\s%/.test(text)) return 'a percent sign'
  return null
}

// ── the rule ────────────────────────────────────────────────────────────

const isToast = callee =>
  (callee.type === 'Identifier' && callee.name === 'toast') ||
  (callee.type === 'MemberExpression' &&
    callee.object.type === 'Identifier' &&
    callee.object.name === 'toast')

export const copy = {
  meta: {
    type: 'suggestion',
    docs: { description: 'Text people read follows the design system' },
    fixable: 'code',
    schema: [
      {
        type: 'object',
        properties: {
          portal: { enum: ['internal', 'client'] },
          exceptions: EXCEPTIONS_SCHEMA,
          root: { type: 'string' },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      'toast-failed': `House rule 14 (${README}): failure toasts read "Unable to <verb> <noun>" with the reason in the description. No "Failed to…". Write "Unable to …".`,
      'toast-successfully': `House rule 14 (${README}): success is short and past tense ("Invoice sent", "Company saved"). No "…successfully": drop the word.`,
      'toast-bang': `House rule 14 (${README}): no exclamation marks in toasts. End with a full stop or nothing.`,
      'toast-error': `House rule 14 (${README}): no "Error" toast title. Write "Unable to <verb> <noun>" and put the reason in the description.`,
      ellipsis: `Copy (${README}, Content fundamentals): placeholders end with the ellipsis character "…", not three dots ("Search people…").`,
      optional:
        'docs/design-system/components/input.md: "Mark optional fields with `<FormLabel optional>`" (or `<OptionalMarker />` beside a plain Label). Don\'t write "(optional)" by hand.',
      details:
        'components/sheet.md: no generic "Details" heading; name the section for what it holds.',
      words: `Copy (${README}, Content fundamentals): {{message}}. A deliberate use (the website's contact form) takes an eslint-disable comment saying why.`,
      figures: `Content fundamentals (${README}): hours, money and percentages are formatted only by @pts/ui/numbers (formatHours → "1.5h", formatCurrency → "$1,234.00", formatPercent → "8.25%"). This {{what}}. Need a variant (no cents, a sign)? Add an option to packages/ui/src/numbers.ts.`,
    },
  },
  create(context) {
    const { portal } = context.options[0] ?? {}
    const on = checkIsOn(context)
    const sourceCode = context.sourceCode
    const words = portal && on('words') ? WORDS[portal] : null
    const figures = on('figures')

    function checkWords(node, value, target) {
      if (!words || !looksLikeProse(value)) return
      if (target && isCode(target, sourceCode)) return
      const message = retiredWord(value, words)
      if (message)
        context.report({ node, messageId: 'words', data: { message } })
    }
    const figure = (node, what) =>
      context.report({ node, messageId: 'figures', data: { what } })

    function checkToast(valueNode, key) {
      for (const { node, value } of staticStrings(valueNode)) {
        const report = messageId => context.report({ node, messageId })
        if (/\bfailed to\b/i.test(value)) report('toast-failed')
        if (/\bsuccessfully\b/i.test(value)) report('toast-successfully')
        if (/!(\s|$)/.test(value)) report('toast-bang')
        if (key === 'title' && /^\s*error\s*$/i.test(value))
          report('toast-error')
      }
    }

    function checkEllipsis(valueNode) {
      for (const { node, value } of staticStrings(valueNode)) {
        if (!value.includes('...')) continue
        context.report({
          node,
          messageId: 'ellipsis',
          fix:
            node.type === 'Literal'
              ? fixer =>
                  fixer.replaceText(node, node.raw.replaceAll('...', '…'))
              : null,
        })
      }
    }

    const checkOptional = (node, value) => {
      if (on('optional') && /\(optional\)/i.test(value))
        context.report({ node, messageId: 'optional' })
    }

    return {
      Literal(node) {
        if (typeof node.value !== 'string') return
        checkWords(node, node.value, node)
        const parent = node.parent
        if (parent.type === 'JSXExpressionContainer')
          checkOptional(node, node.value)
        if (parent.type === 'JSXAttribute' && jsxName(parent.name) === 'label')
          checkOptional(node, node.value)
      },
      TemplateLiteral(node) {
        for (const quasi of node.quasis) {
          checkWords(quasi, quasi.value.cooked ?? quasi.value.raw, node)
        }
        if (!figures) return
        node.expressions.forEach((expression, i) => {
          const before = node.quasis[i].value.raw
          const after = node.quasis[i + 1].value.raw
          if (/\$$/.test(before)) figure(expression, 'glues on a dollar sign')
          const glued = gluedAfter(expression, after, before)
          if (glued) figure(expression, `glues on ${glued}`)
        })
      },
      JSXText(node) {
        const value = node.value.replace(/\s+/g, ' ').trim()
        if (value) checkWords(node, value, null)
        checkOptional(node, node.value)
        if (!figures) return
        const siblings = node.parent.children ?? []
        const index = siblings.indexOf(node)
        const previous = siblings[index - 1]
        const next = siblings[index + 1]
        if (
          previous?.type === 'JSXExpressionContainer' &&
          previous.expression.type !== 'JSXEmptyExpression'
        ) {
          const glued = gluedAfter(previous.expression, node.value, '')
          if (glued) figure(node, `glues on ${glued}`)
        }
        if (
          next?.type === 'JSXExpressionContainer' &&
          /(?:^|[\s>(])\$$/.test(node.value)
        ) {
          figure(node, 'glues on a dollar sign')
        }
      },
      JSXAttribute(node) {
        if (on('ellipsis') && jsxName(node.name) === 'placeholder')
          checkEllipsis(attrValue(node))
      },
      JSXOpeningElement(node) {
        if (!on('details') || jsxName(node.name) !== 'SheetSection') return
        const title = node.attributes.find(
          a => a.type === 'JSXAttribute' && jsxName(a.name) === 'title'
        )
        const value = title && attrValue(title)
        if (value?.type === 'Literal' && value.value === 'Details')
          context.report({ node, messageId: 'details' })
      },
      Property(node) {
        const key = node.computed ? null : keyName(node.key)
        if (on('ellipsis') && key === 'placeholder') checkEllipsis(node.value)
        if (
          figures &&
          key === 'currency' &&
          unwrap(node.value)?.type === 'Literal' &&
          unwrap(node.value).value === 'USD'
        ) {
          figure(node, "sets currency: 'USD' by hand")
        }
      },
      CallExpression(node) {
        const callee = node.callee
        if (on('toast') && isToast(callee)) {
          for (const arg of node.arguments) {
            if (arg.type !== 'ObjectExpression') {
              checkToast(arg, 'title')
              continue
            }
            for (const prop of arg.properties) {
              if (prop.type !== 'Property' || prop.key.type !== 'Identifier')
                continue
              if (['title', 'description'].includes(prop.key.name))
                checkToast(prop.value, prop.key.name)
            }
          }
        }
        if (
          figures &&
          callee.type === 'MemberExpression' &&
          callee.property.name === 'toLocaleString' &&
          node.arguments.some(
            arg =>
              arg.type === 'ObjectExpression' &&
              arg.properties.some(p =>
                /^(?:currency|\w*FractionDigits)$/.test(keyName(p.key))
              )
          )
        ) {
          figure(node, 'calls toLocaleString with number options')
        }
      },
      BinaryExpression(node) {
        // n.toFixed(1) + '%'
        if (
          figures &&
          node.operator === '+' &&
          isToFixed(node.left) &&
          node.right.type === 'Literal' &&
          /^\s?(?:%|h\b|hrs?\b|hours?\b)/.test(String(node.right.value))
        ) {
          figure(node, 'glues a unit onto toFixed()')
        }
      },
      'FunctionDeclaration, VariableDeclarator'(node) {
        if (figures && LOCAL_FORMATTER.test(node.id?.name ?? ''))
          figure(node.id, `defines its own ${node.id.name}`)
      },
    }
  },
}
