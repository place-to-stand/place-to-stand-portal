#!/usr/bin/env node
/**
 * Keeps the retired entity words out of UI copy (run by `npm run lint`).
 * The rules are docs/design-system/README.md, "Content fundamentals":
 *
 * - Internal portal: the person record is a **person**, never a "contact"
 *   ("People", "Add person"). "Contact" stays only as a verb or a
 *   non-entity noun: "contact support", the website's contact form (and its
 *   submissions), a company's primary contact.
 * - Client portal: they are **companies**, not clients; nobody has a
 *   "user", an "account" or a "login", and "sign-in" is not a noun there
 *   (say "sign in", the verb, or name what is meant).
 * - Everywhere: no "Partners" heading in a picker (they're Staff), and no
 *   "Delete forever": nothing is hard-deleted, only archived.
 *
 * Only UI strings are read: JSX text, and string literals that read like
 * prose (a space, or a capitalised word). Code never matches: imports,
 * directives, object keys, comparisons, `case` labels, literal types,
 * tagged templates (sql``), className / cn() arguments, attribute values
 * like href, key, id or type, and paths (`/api/contacts`, `contact-form`).
 * Machine-facing text (lib/mcp, lib/cli: agents read `contact`) and the
 * query layer are skipped.
 *
 * A deliberate use (the website's contact form, a list of the retired words)
 * carries `copy-check: allow — <reason>` in a comment on its line or the
 * line above.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = fileURLToPath(new URL('..', import.meta.url))
const SKIP =
  /node_modules|\.next|\/dist\/|tiptap|\/scripts\/|\.test\.|\.d\.ts$|\/lib\/(?:queries|db|mcp|cli)\/|\/app\/api\/cli\//
const ALLOW = /copy-check: allow\s*(?:—|--)\s*\S/

const INTERNAL = [
  'apps/internal/app',
  'apps/internal/components',
  'apps/internal/lib',
  'apps/internal/hooks',
]
const CLIENT = ['apps/client/app', 'apps/client/components', 'apps/client/lib']

/** [pattern, message, allowed context] */
const INTERNAL_RULES = [
  [
    /\b[Cc]ontacts?\b/,
    '"contact" as the person record: say person / people ("Add person")',
    // Verb or non-entity noun.
    /\bprimary contacts?\b|\bcontact (?:support|us|form|submissions?|details|info(?:rmation)?)\b|\bto contact\b|\bcontact (?:an?|the|them|him|her|us|you|someone|your)\b|\bsince (?:last )?contact\b|\bcontact and audit\b|\bcontacts?-\w/i,
  ],
]
const CLIENT_RULES = [
  [
    /\b[Ss]ign-ins?\b/,
    '"sign-in" as a noun: say "sign in" (the verb) or name what is meant',
  ],
  [
    /\b[Uu]sers?\b/,
    '"user": name the person ("you", "your team", the person\'s name)',
  ],
  [
    /\b[Aa]ccounts?\b/,
    '"account": say what is meant (your email, your company)',
    /\b(?:Google|GitHub|Microsoft) accounts?\b|\baccount manager\b/,
  ],
  [/\b[Ll]ogins?\b|\b[Ll]og in\b/, '"login": say "sign in"'],
  [
    /\b[Cc]lients?\b/,
    '"client": in the client portal they are companies',
    /\bclient portal\b/i,
  ],
]
const EVERYWHERE_RULES = [
  [/\bPartners\b/, '"Partners": pickers call the team Staff'],
  [
    /\b[Dd]elete forever\b/,
    '"Delete forever": nothing is hard-deleted; only archive and restore',
  ],
]

const CODE_ATTRS = new Set([
  'className',
  'href',
  'src',
  'key',
  'id',
  'name',
  'type',
  'variant',
  'size',
  'role',
  'htmlFor',
  'value',
  'defaultValue',
  'align',
  'side',
  'method',
  'action',
  'target',
  'rel',
  'autoComplete',
  'inputMode',
  'as',
  'form',
  'mode',
  'entity',
  'param',
  'tab',
])
const CLASS_CALLS = new Set(['cn', 'clsx', 'cva', 'twMerge', 'classNames'])

function* files(dir) {
  let names
  try {
    names = readdirSync(dir)
  } catch {
    return
  }
  for (const name of names) {
    const path = join(dir, name)
    if (SKIP.test(path)) continue
    if (statSync(path).isDirectory()) yield* files(path)
    else if (/\.(ts|tsx)$/.test(path)) yield path
  }
}

function looksLikeProse(text) {
  return (
    /[A-Za-z]/.test(text) &&
    (/\s/.test(text.trim()) || /^[A-Z][a-z]/.test(text.trim()))
  )
}

/** Is this literal code (an identifier-like value), not copy? */
function isCode(node) {
  const parent = node.parent
  if (!parent) return true
  if (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent))
    return true
  if (ts.isExternalModuleReference(parent) || ts.isImportTypeNode?.(parent))
    return true
  if (ts.isLiteralTypeNode(parent)) return true
  if (ts.isPropertyAssignment(parent) && parent.name === node) return true
  if (ts.isElementAccessExpression(parent)) return true
  if (ts.isCaseClause(parent)) return true
  if (ts.isExpressionStatement(parent)) return true // 'use client'
  if (ts.isTaggedTemplateExpression(parent)) return true // sql``
  if (
    ts.isTemplateExpression(parent) &&
    ts.isTaggedTemplateExpression(parent.parent)
  ) {
    return true
  }
  if (ts.isCallExpression(parent) && parent.expression.getText() === 'sql.raw')
    return true
  if (
    ts.isBinaryExpression(parent) &&
    /=/.test(ts.tokenToString(parent.operatorToken.kind) ?? '')
  ) {
    const op = parent.operatorToken.kind
    if (
      op === ts.SyntaxKind.EqualsEqualsEqualsToken ||
      op === ts.SyntaxKind.ExclamationEqualsEqualsToken ||
      op === ts.SyntaxKind.EqualsEqualsToken ||
      op === ts.SyntaxKind.ExclamationEqualsToken
    ) {
      return true
    }
  }
  // className='…', href='…', …
  for (let p = parent; p; p = p.parent) {
    if (ts.isJsxAttribute(p)) {
      const attr = p.name.getText()
      return CODE_ATTRS.has(attr) || attr.startsWith('data-')
    }
    if (ts.isCallExpression(p)) {
      const callee = p.expression.getText()
      if (CLASS_CALLS.has(callee)) return true
      if (/\b(?:get|set|has|delete|append)$/.test(callee)) return true // searchParams.get('contact')
      if (
        /^(?:console\.\w+|logger\.\w+|redirect|router\.\w+|fetch|revalidatePath|revalidateTag)$/.test(
          callee
        )
      ) {
        return true
      }
      break
    }
    if (ts.isJsxElement(p) || ts.isStatement(p)) break
  }
  return false
}

function copyStrings(file, text) {
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  )
  const out = []
  const visit = node => {
    if (ts.isJsxText(node)) {
      const value = node.getText().replace(/\s+/g, ' ').trim()
      if (value) out.push({ node, value })
    } else if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)
    ) {
      const value = node.text
      const target =
        ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)
          ? node
          : node.parent
      if (looksLikeProse(value) && !isCode(target)) out.push({ node, value })
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return out.map(({ node, value }) => ({
    value,
    line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
  }))
}

function check(dirs, rules, errors) {
  for (const dir of dirs) {
    for (const file of files(join(root, dir))) {
      const text = readFileSync(file, 'utf8')
      const lines = text.split('\n')
      for (const { value, line } of copyStrings(file, text)) {
        if (
          ALLOW.test(lines[line - 1] ?? '') ||
          ALLOW.test(lines[line - 2] ?? '')
        )
          continue
        const prose = value.replace(/\S*[/_]\S*|`[^`]*`/g, ' ')
        for (const [pattern, message, allowed] of rules) {
          const flags = allowed
            ? allowed.flags.includes('g')
              ? allowed.flags
              : allowed.flags + 'g'
            : ''
          const masked = allowed
            ? prose.replace(new RegExp(allowed.source, flags), '')
            : prose
          if (pattern.test(masked)) {
            errors.push(
              `${file.slice(root.length)}:${line}: ${message}: "${value.slice(0, 80)}"`
            )
          }
        }
      }
    }
  }
}

const errors = []
check(INTERNAL, [...INTERNAL_RULES, ...EVERYWHERE_RULES], errors)
check(CLIENT, [...CLIENT_RULES, ...EVERYWHERE_RULES], errors)

if (errors.length) {
  console.error(
    'Copy check failed: retired entity words in UI copy (docs/design-system/README.md, Content fundamentals).'
  )
  for (const error of errors) console.error(`  - ${error}`)
  process.exit(1)
}
console.log(
  'Copy: person not contact, companies in the client portal, no Partners or Delete forever'
)
