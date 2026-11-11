/** Shared helpers for the house-rule lint rules. */
import { matchesGlob, relative, sep } from 'node:path'

/** The JSX element name as written: `Button`, `Select.Trigger` → `Select.Trigger`. */
export function jsxName(nameNode) {
  if (!nameNode) return ''
  if (nameNode.type === 'JSXIdentifier') return nameNode.name
  if (nameNode.type === 'JSXMemberExpression') {
    return `${jsxName(nameNode.object)}.${jsxName(nameNode.property)}`
  }
  if (nameNode.type === 'JSXNamespacedName') {
    return `${nameNode.namespace.name}:${nameNode.name.name}`
  }
  return ''
}

/** Every static string inside a node: literals and template-literal chunks. */
export function staticStrings(node, out = []) {
  if (!node || typeof node !== 'object') return out
  if (node.type === 'Literal' && typeof node.value === 'string') {
    out.push({ node, value: node.value })
    return out
  }
  if (node.type === 'TemplateElement') {
    out.push({ node, value: node.value.cooked ?? node.value.raw })
    return out
  }
  if (node.type === 'JSXText') {
    out.push({ node, value: node.value })
    return out
  }
  for (const key of Object.keys(node)) {
    if (key === 'parent' || key === 'loc' || key === 'range') continue
    const child = node[key]
    if (Array.isArray(child)) child.forEach(c => staticStrings(c, out))
    else if (child && typeof child.type === 'string') staticStrings(child, out)
  }
  return out
}

/** The value node of a JSX attribute (string literal or expression). */
export function attrValue(attr) {
  if (!attr.value) return null
  if (attr.value.type === 'JSXExpressionContainer') return attr.value.expression
  return attr.value
}

/** Named JSX attribute on an opening element. */
export function findAttr(opening, name) {
  return opening.attributes.find(
    a => a.type === 'JSXAttribute' && a.name && a.name.name === name
  )
}

/** Every identifier and non-computed property name inside a node. */
export function names(node, out = new Set()) {
  if (!node || typeof node !== 'object') return out
  if (node.type === 'Identifier') out.add(node.name)
  for (const key of Object.keys(node)) {
    if (key === 'parent' || key === 'loc' || key === 'range') continue
    const child = node[key]
    if (Array.isArray(child)) child.forEach(c => names(c, out))
    else if (child && typeof child.type === 'string') names(child, out)
  }
  return out
}

/** True when the file starts with a `'use client'` / `'use server'` directive. */
export function hasDirective(program, directive) {
  for (const stmt of program.body) {
    if (stmt.type !== 'ExpressionStatement' || !stmt.directive) break
    if (stmt.directive === directive) return true
  }
  return false
}

export const README = 'docs/design-system/README.md'

/** Elements that are buttons: native, ours, and icon/action buttons. */
export const BUTTONISH =
  /^(button|Button|RowActionButton|\w*IconButton|\w*ActionButton)$/

/** Every static string under a node, as `{ node, value }` (raw template text). */
export function rawStrings(node, out = []) {
  if (!node || typeof node !== 'object') return out
  if (node.type === 'Literal' && typeof node.value === 'string') {
    out.push({ node, value: node.value })
    return out
  }
  if (node.type === 'TemplateElement') {
    out.push({ node, value: node.value.raw })
    return out
  }
  for (const key of Object.keys(node)) {
    if (key === 'parent' || key === 'loc' || key === 'range') continue
    const child = node[key]
    if (Array.isArray(child)) child.forEach(c => rawStrings(c, out))
    else if (child && typeof child.type === 'string') rawStrings(child, out)
  }
  return out
}

/**
 * A rule made of several checks takes `{ exceptions: { <check>: [globs] } }`:
 * the files where that one check is off, relative to the `root` option (the
 * app's directory, like a flat config's `files`; where eslint runs when it
 * is unset). Returns a test for a check name.
 */
export function checkIsOn(context) {
  const { exceptions = {}, root = context.cwd } = context.options[0] ?? {}
  const file = relative(root, context.filename).split(sep).join('/')
  const off = new Set(
    Object.entries(exceptions)
      .filter(([, globs]) => globs.some(glob => matchesGlob(file, glob)))
      .map(([check]) => check)
  )
  return check => !off.has(check)
}

/** The `exceptions` option schema shared by the multi-check rules. */
export const EXCEPTIONS_SCHEMA = {
  type: 'object',
  additionalProperties: { type: 'array', items: { type: 'string' } },
}
