/**
 * House rules that say "use the component": a Save is never gated on
 * isDirty (rule 6), archive confirmations are ArchiveConfirmDialog, list
 * filters are FilterSelect (docs/design-system/README.md). Each message quotes
 * its rule and says what to write instead.
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

/** Archive confirms all read the same way. */
export const archiveConfirm = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Archive confirmations use ArchiveConfirmDialog',
    },
    schema: [],
    messages: {
      archive: `Archive confirmations use ArchiveConfirmDialog (@/components/sheets/archive-confirm-dialog), so every archive asks the same way. Pass entity, name, list and, for extra consequences, extra.`,
    },
  },
  create(context) {
    const file = context.filename ?? context.getFilename()
    if (/archive-confirm-dialog\.tsx$|\/design\//.test(file)) return {}
    return {
      JSXOpeningElement(node) {
        if (jsxName(node.name) !== 'ConfirmDialog') return
        const title = findAttr(node, 'title')
        if (!title) return
        const texts = staticStrings(attrValue(title))
        if (texts.some(({ value }) => /^\s*Archive\b/.test(value))) {
          context.report({ node, messageId: 'archive' })
        }
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
