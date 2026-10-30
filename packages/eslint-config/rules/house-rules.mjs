/**
 * The design system's house rules, part 1 (rules 1, 4, 10, 11, 12; part 2
 * is house-rules-copy.mjs) (docs/design-system/README.md, "House rules
 * (verified in code)") as lint rules. Each message quotes the rule it enforces
 * and says what to write instead.
 */
import {
  BUTTONISH,
  README,
  attrValue,
  findAttr,
  jsxName,
  staticStrings,
} from './utils.mjs'

/** Rule 1: Base UI, not Radix. */
export const noRadix = {
  meta: {
    type: 'problem',
    docs: { description: 'House rule 1: every primitive is @base-ui/react' },
    schema: [],
    messages: {
      import: `House rule 1 (${README}): "Every primitive is @base-ui/react. Radix is gone." Import the @pts/ui wrapper (built on @base-ui/react) instead of {{source}}.`,
      state: `House rule 1 (${README}): "Don't write data-[state=…]." Style against Base UI's attributes: data-active (tabs), data-checked / data-unchecked (switch, checkbox), data-highlighted / data-open / data-closed (popups).`,
    },
  },
  create(context) {
    function checkSource(node) {
      const source = node.source && String(node.source.value)
      if (source && /^(@radix-ui\/|radix-ui$)/.test(source)) {
        context.report({ node, messageId: 'import', data: { source } })
      }
    }
    function checkString(node, value) {
      if (/data-\[state=/.test(value))
        context.report({ node, messageId: 'state' })
    }
    return {
      ImportDeclaration: checkSource,
      ExportNamedDeclaration: checkSource,
      ExportAllDeclaration: checkSource,
      Literal(node) {
        if (typeof node.value === 'string') checkString(node, node.value)
      },
      TemplateElement(node) {
        checkString(node, node.value.raw)
      },
    }
  },
}

/** Rule 4: popups align left by default. */
export const noAlignStart = {
  meta: {
    type: 'suggestion',
    docs: {
      description: "House rule 4: never pass align='start' at a call site",
    },
    schema: [],
    messages: {
      start: `House rule 4 (${README}): "The wrappers default to align='start'. Never pass align='start' at a call site." Delete the prop; pass an explicit align only to deviate (e.g. 'end').`,
    },
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        const name = jsxName(node.name)
        if (!/(Content|Positioner)$/.test(name)) return
        const attr = findAttr(node, 'align')
        if (!attr) return
        const value = attrValue(attr)
        if (value && value.type === 'Literal' && value.value === 'start') {
          context.report({ node: attr, messageId: 'start' })
        }
      },
    }
  },
}

/** Rule 10: dates go through @pts/ui/dates. */
export const datesThroughUi = {
  meta: {
    type: 'problem',
    docs: { description: 'House rule 10: dates go through @pts/ui/dates' },
    schema: [],
    messages: {
      banned: `House rule 10 (${README}): "Dates go through @pts/ui/dates … Never toLocaleDateString, a bare Intl.DateTimeFormat, or date-fns format() in the UI." {{what}} formats in the ambient timezone (hydration errors, off-by-one dates). Use formatCalendarDate / formatRelativeTime, or add a helper to packages/ui/src/dates.ts.`,
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        const callee = node.callee
        if (
          callee.type === 'MemberExpression' &&
          !callee.computed &&
          ['toLocaleDateString', 'toLocaleTimeString'].includes(
            callee.property.name
          )
        ) {
          context.report({
            node,
            messageId: 'banned',
            data: { what: callee.property.name },
          })
        }
      },
      'NewExpression, CallExpression'(node) {
        const callee = node.callee
        if (
          callee.type === 'MemberExpression' &&
          callee.object.type === 'Identifier' &&
          callee.object.name === 'Intl' &&
          callee.property.name === 'DateTimeFormat'
        ) {
          context.report({
            node,
            messageId: 'banned',
            data: { what: 'Intl.DateTimeFormat' },
          })
        }
      },
      ImportDeclaration(node) {
        const source = String(node.source.value)
        if (source === 'date-fns/format') {
          context.report({
            node,
            messageId: 'banned',
            data: { what: "date-fns's format()" },
          })
        }
        if (source !== 'date-fns' && source !== 'date-fns-tz') return
        for (const spec of node.specifiers) {
          if (
            spec.type === 'ImportSpecifier' &&
            ['format', 'formatInTimeZone', 'lightFormat'].includes(
              spec.imported.name
            )
          ) {
            context.report({
              node: spec,
              messageId: 'banned',
              data: { what: `date-fns's ${spec.imported.name}()` },
            })
          }
        }
      },
    }
  },
}

/** Rule 11: tooltips, never title=. */
export const noTitleTooltip = {
  meta: {
    type: 'problem',
    docs: {
      description: 'House rule 11: never title= as a tooltip on a button',
    },
    schema: [],
    messages: {
      title: `House rule 11 (${README}): "Icon-only row actions use RowActionButton … Never title= as a tooltip." Use RowActionButton (label = tooltip + accessible name) or wrap the button in a Tooltip; use aria-label for the name.`,
    },
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        if (!BUTTONISH.test(jsxName(node.name))) return
        const attr = findAttr(node, 'title')
        if (attr) context.report({ node: attr, messageId: 'title' })
      },
    }
  },
}

const SIZE_OVERRIDE = /(?:^|\s)(?:[\w-]+:)*!?(h-(?:\d|\[|px\b)|text-\[[^\]]*\])/

/** Rule 12: pick a size, don't override it. */
export const noSizeOverride = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'House rule 12: no h-* / text-[…] overrides on Button and Avatar',
    },
    schema: [],
    messages: {
      size: `House rule 12 (${README}): "Pick a size, don't override it … No h-* or text-[9px] overrides." Drop "{{token}}" from this {{element}} and pass size (Button: xs, sm, default, lg, icon, icon-sm, icon-lg; Avatar: xs–lg).`,
    },
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        const element = jsxName(node.name)
        if (!/^(Button|Avatar)$/.test(element)) return
        const attr = findAttr(node, 'className')
        if (!attr) return
        for (const { node: str, value } of staticStrings(attrValue(attr))) {
          const match = value.match(SIZE_OVERRIDE)
          if (match) {
            context.report({
              node: str,
              messageId: 'size',
              data: { token: match[1], element },
            })
          }
        }
      },
    }
  },
}
