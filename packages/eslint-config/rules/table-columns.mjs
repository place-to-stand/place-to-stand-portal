/**
 * table.md: in a fixed-layout table, short columns hold a fixed width and
 * text columns take the slack.
 *
 * With `table-layout: fixed`, a table wider than its sized columns spreads
 * the extra over every column (the select box and Actions included) unless
 * one column has no width. So each `<Table layout='fixed'>` needs at least
 * one unsized head, and a short column (Actions, Status, a date, hours,
 * money, a switch, an icon-only head) may not take a % width.
 *
 * Heads are read from the table's `<TableHeader>`: `TableHead` and
 * `SortableTableHead` elements, heads inside `.map()`, and helper calls such
 * as `sortHead('name', 'Company', '')`, whose string arguments stand in for
 * the class and label. Class names are followed through local constants and
 * objects (`widths.status`, `COLUMN_CLASSES[mode].company`).
 */

import { attrValue, findAttr, jsxName } from './utils.mjs'

const TABLE_MD = 'docs/design-system/components/table.md'

/** Any width utility, responsive or not: w-24, xl:w-[12%], w-[38%]. */
const WIDTH = /(?:^|\s)(?:[\w-]+:)*w-(?:\d+(?:\.\d+)?|px|\[[^\]]+\])(?=\s|$)/
const PERCENT = /(?:^|\s)(?:[\w-]+:)*w-\[\d+(?:\.\d+)?%\]/

/** Heads whose content has a known size. */
const SHORT =
  /^(actions?|status|active|hours?|date|issued|created( on)?|archived|received|total|unit price|rate.*|min qty|tasks)$/i

const HEAD = /^(TableHead|SortableTableHead)$/

function unwrap(node) {
  while (
    node &&
    (node.type === 'TSAsExpression' ||
      node.type === 'TSSatisfiesExpression' ||
      node.type === 'TSNonNullExpression')
  ) {
    node = node.expression
  }
  return node
}

function propertyValue(object, key) {
  const prop = object.properties.find(
    p =>
      p.type === 'Property' &&
      ((p.key.type === 'Identifier' && p.key.name === key) ||
        (p.key.type === 'Literal' && p.key.value === key))
  )
  return prop ? prop.value : null
}

export const fixedTableColumns = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Fixed-layout tables: one text column grows, short columns are fixed',
    },
    schema: [],
    messages: {
      growing: `${TABLE_MD}: a fixed-layout table needs one column with no width, so the slack goes to text instead of spreading over the select box and Actions. Remove the width from the main text column.`,
      percent: `${TABLE_MD}: "{{label}}" holds content of a known size, so give it a fixed width (w-24, w-32, …), not a %.`,
    },
  },
  create(context) {
    const declarations = new Map()
    const tables = []

    /** ObjectExpressions a node may stand for. */
    const objects = (node, depth = 0) => {
      node = unwrap(node)
      if (!node || depth > 4) return []
      if (node.type === 'ObjectExpression') return [node]
      if (node.type === 'Identifier') {
        return objects(declarations.get(node.name), depth + 1)
      }
      if (node.type === 'MemberExpression') {
        const parents = objects(node.object, depth + 1)
        if (node.computed) {
          return parents.flatMap(o =>
            o.properties.flatMap(p =>
              p.type === 'Property' ? objects(p.value, depth + 1) : []
            )
          )
        }
        return parents.flatMap(o =>
          objects(propertyValue(o, node.property.name), depth + 1)
        )
      }
      return []
    }

    /** Every class string a node can produce. */
    const strings = (node, out = [], depth = 0) => {
      node = unwrap(node)
      if (!node || depth > 6) return out
      switch (node.type) {
        case 'Literal':
          if (typeof node.value === 'string') out.push(node.value)
          break
        case 'TemplateLiteral':
          node.quasis.forEach(q => out.push(q.value.cooked ?? q.value.raw))
          node.expressions.forEach(e => strings(e, out, depth + 1))
          break
        case 'Identifier':
          strings(declarations.get(node.name), out, depth + 1)
          break
        case 'MemberExpression':
          if (node.computed) break
          for (const o of objects(node.object)) {
            strings(propertyValue(o, node.property.name), out, depth + 1)
          }
          break
        case 'CallExpression':
          node.arguments.forEach(a => strings(a, out, depth + 1))
          break
        case 'ConditionalExpression':
          strings(node.consequent, out, depth + 1)
          strings(node.alternate, out, depth + 1)
          break
        case 'LogicalExpression':
          strings(node.left, out, depth + 1)
          strings(node.right, out, depth + 1)
          break
        case 'ArrayExpression':
          node.elements.forEach(e => strings(e, out, depth + 1))
          break
      }
      return out
    }

    const jsxText = node => {
      const out = []
      const visit = n => {
        if (!n || typeof n !== 'object') return
        if (n.type === 'JSXText') out.push(n.value)
        for (const key of Object.keys(n)) {
          if (key === 'parent') continue
          const child = n[key]
          if (Array.isArray(child)) child.forEach(visit)
          else if (child && typeof child.type === 'string') visit(child)
        }
      }
      visit(node)
      return out.join(' ').replace(/\s+/g, ' ').trim()
    }

    /** Head elements and helper calls under a header row. */
    const collect = (node, heads) => {
      node = unwrap(node)
      if (!node || typeof node !== 'object') return
      if (node.type === 'JSXElement') {
        const name = jsxName(node.openingElement.name)
        if (name === 'SelectAllHead') return
        if (HEAD.test(name)) {
          const attr = findAttr(node.openingElement, 'className')
          heads.push({
            node,
            classes: attr ? strings(attrValue(attr)).join(' ') : '',
            labels: [jsxText(node)],
          })
          return
        }
        node.children.forEach(c => collect(c, heads))
        return
      }
      if (node.type === 'JSXFragment') {
        node.children.forEach(c => collect(c, heads))
        return
      }
      if (node.type === 'JSXExpressionContainer') {
        collect(node.expression, heads)
        return
      }
      if (node.type === 'ConditionalExpression') {
        collect(node.consequent, heads)
        collect(node.alternate, heads)
        return
      }
      if (node.type === 'LogicalExpression') {
        collect(node.right, heads)
        return
      }
      if (node.type === 'CallExpression') {
        const callee = node.callee
        const isMap =
          callee.type === 'MemberExpression' &&
          !callee.computed &&
          callee.property.name === 'map'
        if (isMap) {
          const fn = node.arguments[0]
          if (fn && fn.body) collect(fn.body, heads)
          return
        }
        // A helper such as sortHead(field, label, className).
        const args = node.arguments.flatMap(a => strings(a))
        heads.push({ node, classes: args.join(' '), labels: args })
        return
      }
      if (node.type === 'BlockStatement') {
        for (const s of node.body) {
          if (s.type === 'ReturnStatement') collect(s.argument, heads)
        }
      }
    }

    const findHeader = node => {
      let found = null
      const visit = n => {
        if (found || !n || typeof n !== 'object') return
        if (
          n.type === 'JSXElement' &&
          jsxName(n.openingElement.name) === 'TableHeader'
        ) {
          found = n
          return
        }
        for (const key of Object.keys(n)) {
          if (key === 'parent') continue
          const child = n[key]
          if (Array.isArray(child)) child.forEach(visit)
          else if (child && typeof child.type === 'string') visit(child)
        }
      }
      node.children.forEach(visit)
      return found
    }

    return {
      VariableDeclarator(node) {
        if (node.id.type === 'Identifier' && node.init) {
          declarations.set(node.id.name, node.init)
        }
      },
      JSXElement(node) {
        if (jsxName(node.openingElement.name) === 'Table') tables.push(node)
      },
      // Constants may be declared below the table, so check at the end.
      'Program:exit'() {
        tables.forEach(check)
      },
    }

    function check(node) {
      const layout = findAttr(node.openingElement, 'layout')
      const value = layout && strings(attrValue(layout))
      if (!value || !value.includes('fixed')) return
      const header = findHeader(node)
      if (!header) return
      const heads = []
      header.children.forEach(c => collect(c, heads))
      if (heads.length === 0) return

      if (heads.every(h => WIDTH.test(h.classes))) {
        context.report({ node: node.openingElement, messageId: 'growing' })
      }
      for (const head of heads) {
        if (!PERCENT.test(head.classes)) continue
        const label = head.labels.map(l => l.trim()).find(l => SHORT.test(l))
        const iconOnly = head.labels.every(l => l.trim() === '')
        if (label !== undefined || iconOnly) {
          context.report({
            node: head.node,
            messageId: 'percent',
            data: { label: label ?? 'an icon-only head' },
          })
        }
      }
    }
  },
}
