/**
 * The design system's house rules, part 2: copy and form behaviour (rules 6,
 * 14, 15, the ellipsis and list filters). Part 1 is house-rules.mjs.
 */
import {
  BUTTONISH,
  README,
  attrValue,
  findAttr,
  jsxName,
  names,
  staticStrings,
} from './utils.mjs'

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
