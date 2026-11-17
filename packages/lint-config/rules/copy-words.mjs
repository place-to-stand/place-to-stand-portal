/**
 * pts/copy's word check (rules/copy.mjs): the retired entity words, and how
 * to tell UI copy from code. The rules are docs/design-system/README.md,
 * "Content fundamentals":
 *
 * - Internal portal: the person record is a person, never a "contact", and
 *   nobody has an "account" (they have a sign-in). "Contact" stays as a verb
 *   or a non-entity noun: "contact support", the website's contact form,
 *   a company's primary contact.
 * - Client portal: they are companies, not clients; nobody has a "user", an
 *   "account" or a "login", and "sign-in" is not a noun there.
 * - Everywhere: no "Partners" heading in a picker (they're Staff), and no
 *   "Delete forever": nothing is hard-deleted, only archived.
 *
 * Only UI strings are read: JSX text, and string literals that read like
 * prose (a space, or a capitalised word). Code never matches: imports,
 * directives, object keys, comparisons, `case` labels, literal types,
 * tagged templates (sql``), className / cn() arguments, attribute values
 * like href, key, id or type, and paths (`/api/contacts`, `contact-form`).
 */
import { jsxName } from './utils.mjs'

/** Third-party accounts and money words are fine in both portals. */
const ACCOUNT_ALLOWED =
  /\b(?:Google|GitHub|Microsoft|Vercel|Supabase|Mercury|Stripe|bank|Resend|service|email) accounts?\b|\baccount (?:manager|number|balance)\b|\b(?:into|for|on) account\b|\btake into account\b|\baccounts? receivable\b/i

/** [pattern, message, allowed context] */
const INTERNAL_WORDS = [
  [
    /\b[Cc]ontacts?\b/,
    '"contact" as the person record: say person / people ("Add person")',
    // Verb or non-entity noun.
    /\bprimary contacts?\b|\bcontact (?:support|us|form|submissions?|details|info(?:rmation)?)\b|\bto contact\b|\bcontact (?:an?|the|them|him|her|us|you|someone|your)\b|\bsince (?:last )?contact\b|\bcontact and audit\b|\bcontacts?-\w/i,
  ],
  [
    /\b(?:[Uu]ser|[Aa]n|[Yy]our|[Tt]heir|[Hh]is|[Hh]er) accounts?\b/,
    '"account" for a sign-in: say sign-in (third-party accounts are fine)',
    ACCOUNT_ALLOWED,
  ],
]
const CLIENT_WORDS = [
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
    ACCOUNT_ALLOWED,
  ],
  [/\b[Ll]ogins?\b|\b[Ll]og in\b/, '"login": say "sign in"'],
  [
    /\b[Cc]lients?\b/,
    '"client": in the client portal they are companies',
    /\bclient portal\b/i,
  ],
]
const EVERYWHERE_WORDS = [
  [/\bPartners\b/, '"Partners": pickers call the team Staff'],
  [
    /\b[Dd]elete forever\b/,
    '"Delete forever": nothing is hard-deleted; only archive and restore',
  ],
]
export const WORDS = {
  internal: [...INTERNAL_WORDS, ...EVERYWHERE_WORDS],
  client: [...CLIENT_WORDS, ...EVERYWHERE_WORDS],
}

/** Attributes whose values are code, not copy. */
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
const CODE_CALLS =
  /^(?:console\.\w+|logger\.\w+|redirect|router\.\w+|fetch|revalidatePath|revalidateTag|sql\.raw)$/

export function looksLikeProse(text) {
  return (
    /[A-Za-z]/.test(text) &&
    (/\s/.test(text.trim()) || /^[A-Z][a-z]/.test(text.trim()))
  )
}

/** Is this string (a Literal or a TemplateLiteral) code, not copy? */
export function isCode(node, sourceCode) {
  const parent = node.parent
  if (!parent) return true
  switch (parent.type) {
    case 'ImportDeclaration':
    case 'ExportNamedDeclaration':
    case 'ExportAllDeclaration':
    case 'ImportExpression':
    case 'TSLiteralType':
    case 'TSExternalModuleReference':
    case 'SwitchCase':
    case 'ExpressionStatement': // 'use client'
    case 'TaggedTemplateExpression': // sql``
      return true
    case 'Property':
      if (parent.key === node) return true
      break
    case 'MemberExpression':
      if (parent.computed && parent.property === node) return true
      break
    case 'BinaryExpression':
      if (['===', '!==', '==', '!='].includes(parent.operator)) return true
      break
  }
  // className='…', href='…', cn('…'), searchParams.get('contact'), …
  for (let p = parent; p; p = p.parent) {
    if (p.type === 'JSXAttribute') {
      const attr = jsxName(p.name)
      return CODE_ATTRS.has(attr) || attr.startsWith('data-')
    }
    if (p.type === 'CallExpression') {
      const callee = sourceCode.getText(p.callee)
      if (CLASS_CALLS.has(callee)) return true
      if (/\b(?:get|set|has|delete|append)$/.test(callee)) return true
      if (CODE_CALLS.test(callee)) return true
      break
    }
    if (p.type === 'JSXElement' || /Statement$|Declaration$/.test(p.type)) break
  }
  return false
}

/** The first retired word in `value`, or null. */
export function retiredWord(value, words) {
  const prose = value.replace(/\S*[/_]\S*|`[^`]*`/g, ' ')
  for (const [pattern, message, allowed] of words) {
    const masked = allowed
      ? prose.replace(new RegExp(allowed.source, `${allowed.flags}g`), '')
      : prose
    if (pattern.test(masked)) return message
  }
  return null
}
