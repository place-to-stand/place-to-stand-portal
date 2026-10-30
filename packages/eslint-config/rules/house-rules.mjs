/**
 * The design system's house rules (docs/design-system/README.md, "House rules
 * (verified in code)") as lint rules. Each message quotes the rule it enforces
 * and says what to write instead.
 */
import { attrValue, findAttr, jsxName, names, staticStrings } from './utils.mjs'

const README = 'docs/design-system/README.md'

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

const BUTTONISH =
  /^(button|Button|RowActionButton|\w*IconButton|\w*ActionButton)$/

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

/** Rule 14: toast copy. */
export const toastCopy = {
  meta: {
    type: 'suggestion',
    docs: { description: 'House rule 14: toast copy' },
    schema: [],
    messages: {
      failed: `House rule 14 (${README}): failure toasts read "Unable to <verb> <noun>" with the reason in the description. No "Failed to…". Write "Unable to …".`,
      successfully: `House rule 14 (${README}): success is short and past tense ("Invoice sent", "Company saved"). No "…successfully": drop the word.`,
      bang: `House rule 14 (${README}): no exclamation marks in toasts. End with a full stop or nothing.`,
      error: `House rule 14 (${README}): no "Error" toast title. Write "Unable to <verb> <noun>" and put the reason in the description.`,
    },
  },
  create(context) {
    function check(valueNode, key) {
      for (const { node, value } of staticStrings(valueNode)) {
        if (/\bfailed to\b/i.test(value))
          context.report({ node, messageId: 'failed' })
        if (/\bsuccessfully\b/i.test(value))
          context.report({ node, messageId: 'successfully' })
        if (/!(\s|$)/.test(value)) context.report({ node, messageId: 'bang' })
        if (key === 'title' && /^\s*error\s*$/i.test(value)) {
          context.report({ node, messageId: 'error' })
        }
      }
    }
    return {
      CallExpression(node) {
        const callee = node.callee
        const isToast =
          (callee.type === 'Identifier' && callee.name === 'toast') ||
          (callee.type === 'MemberExpression' &&
            callee.object.type === 'Identifier' &&
            callee.object.name === 'toast')
        if (!isToast) return
        for (const arg of node.arguments) {
          if (arg.type === 'ObjectExpression') {
            for (const prop of arg.properties) {
              if (prop.type !== 'Property' || prop.key.type !== 'Identifier')
                continue
              if (
                prop.key.name === 'title' ||
                prop.key.name === 'description'
              ) {
                check(prop.value, prop.key.name)
              }
            }
          } else {
            check(arg, 'title')
          }
        }
      },
    }
  },
}

/** Rule 15: a responsive grid declares its phone column. */
export const gridPhoneColumn = {
  meta: {
    type: 'problem',
    docs: {
      description: 'House rule 15: a responsive grid declares grid-cols-1',
    },
    schema: [],
    messages: {
      grid: `House rule 15 (${README}): "A responsive grid declares its phone column. Write grid grid-cols-1 lg:grid-cols-2, never a bare grid lg:grid-cols-2" (the implicit column grows to its widest child and pushes the page sideways on a phone). Add grid-cols-1.`,
    },
  },
  create(context) {
    function check(node, value) {
      const tokens = value.split(/\s+/)
      if (!tokens.includes('grid')) return
      const responsive = tokens.some(t =>
        /^(?:sm|md|lg|xl|2xl|@[\w/-]*):grid-cols-/.test(t)
      )
      const base = tokens.some(t => /^grid-cols-/.test(t))
      if (responsive && !base) context.report({ node, messageId: 'grid' })
    }
    return {
      Literal(node) {
        if (typeof node.value === 'string') check(node, node.value)
      },
      TemplateElement(node) {
        check(node, node.value.raw)
      },
    }
  },
}

const DIRTY_NAMES = [
  'isDirty',
  'hasChanges',
  'hasUnsavedChanges',
  'dirty',
  'isPristine',
]

/** Rule 6: Save is always enabled. */
export const saveNotGatedOnDirty = {
  meta: {
    type: 'problem',
    docs: { description: 'House rule 6: never gate Save on isDirty' },
    schema: [],
    messages: {
      dirty: `House rule 6 (${README}): "Sheet and dialog Save is always enabled. Never gate Save on isDirty or has-changes." Disable it only while saving or when a real validation precondition fails. (An inline editor outside a sheet may: say so in an eslint-disable comment.)`,
    },
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        if (!BUTTONISH.test(jsxName(node.name))) return
        const attr = findAttr(node, 'disabled')
        if (!attr) return
        // Only a Save: a submit button or one labelled "Save…". (Other
        // actions may wait for a save, e.g. sending an invoice, rule 8.)
        const type = findAttr(node, 'type')
        const isSubmit = type && attrValue(type)?.value === 'submit'
        const label = staticStrings(node.parent)
          .map(s => s.value)
          .join(' ')
        if (!isSubmit && !/\bSav(e|ing)\b/.test(label)) return
        const used = names(attrValue(attr))
        if (DIRTY_NAMES.some(n => used.has(n)))
          context.report({ node: attr, messageId: 'dirty' })
      },
    }
  },
}

/** Copy: a real ellipsis in placeholders. */
export const ellipsisCharacter = {
  meta: {
    type: 'suggestion',
    docs: { description: 'Placeholders use the ellipsis character' },
    schema: [],
    fixable: 'code',
    messages: {
      dots: `Copy (${README}, Content fundamentals): placeholders end with the ellipsis character "…", not three dots ("Search people…").`,
    },
  },
  create(context) {
    function check(valueNode) {
      for (const { node, value } of staticStrings(valueNode)) {
        if (!value.includes('...')) continue
        context.report({
          node,
          messageId: 'dots',
          fix:
            node.type === 'Literal'
              ? fixer =>
                  fixer.replaceText(node, node.raw.replaceAll('...', '…'))
              : null,
        })
      }
    }
    return {
      JSXAttribute(node) {
        if (node.name && node.name.name === 'placeholder')
          check(attrValue(node))
      },
      Property(node) {
        if (node.key.type === 'Identifier' && node.key.name === 'placeholder')
          check(node.value)
      },
    }
  },
}

const FILTER_CONTAINERS = /^(FilterBar|FilterSheet\w*|TableToolbar\w*)$/

/** List filters are FilterSelect (a searchable combobox), never a plain Select. */
export const filterSelect = {
  meta: {
    type: 'problem',
    docs: { description: 'Every list filter is FilterSelect' },
    schema: [],
    messages: {
      select: `List filters (${README}, Surfaces → FilterBar): "Every list filter is FilterSelect … a single-choice filter is a searchable combobox, however short its list … Never a plain Select in a filter bar." Use FilterSelect from components/table-toolbar/filter-select.tsx.`,
    },
  },
  create(context) {
    const filename = context.filename
    const filterFile =
      /filter/i.test(filename.split('/').pop() ?? '') &&
      !/filter-select\.tsx$/.test(filename)
    return {
      ImportDeclaration(node) {
        if (!filterFile) return
        if (
          /(^@pts\/ui\/select$|\/components\/ui\/select$)/.test(
            String(node.source.value)
          )
        ) {
          context.report({ node, messageId: 'select' })
        }
      },
      JSXOpeningElement(node) {
        if (jsxName(node.name) !== 'Select') return
        let parent = node.parent && node.parent.parent
        while (parent) {
          if (
            parent.type === 'JSXElement' &&
            FILTER_CONTAINERS.test(jsxName(parent.openingElement.name))
          ) {
            context.report({ node, messageId: 'select' })
            return
          }
          parent = parent.parent
        }
      },
    }
  },
}
