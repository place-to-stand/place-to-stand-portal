/**
 * Rules for disable comments, so stale or unexplained ones can't pile up.
 * They replace @eslint-community/eslint-plugin-eslint-comments, whose rules
 * crash under Oxlint, and keep its behaviour:
 *
 * - `pts/require-description`: every directive comment says why,
 *   `// eslint-disable-next-line rule -- reason`.
 * - `pts/no-unlimited-disable`: a disable names the rules it turns off.
 * - `pts/disable-enable-pair`: a block disable is closed again by an enable
 *   (`allowWholeFile`: unless it sits above the file's first line of code).
 *
 * Oxlint reads both `eslint-*` and `oxlint-*` directives, so both count.
 */

const DIRECTIVE =
  /^(eslint-disable-next-line|eslint-disable-line|eslint-disable|eslint-enable|oxlint-disable-next-line|oxlint-disable-line|oxlint-disable|oxlint-enable|eslint-env|eslint|exported|globals?)(?:\s|$)/u

/** A directive comment's kind, rule list and description, or null. */
function parseDirective(comment) {
  const text = comment.value.trim()
  const match = DIRECTIVE.exec(text)
  if (!match) return null
  const kind = match[1]
  // Only the line forms (and block disable/enable) may be `//` comments.
  if (
    comment.type === 'Line' &&
    !/^(eslint|oxlint)-(disable|enable)/u.test(kind)
  ) {
    return null
  }
  const rest = text.slice(kind.length)
  const split = /\s-{2,}\s/u.exec(rest)
  const value = (split ? rest.slice(0, split.index) : rest).trim()
  const description = split
    ? rest.slice(split.index + split[0].length).trim()
    : ''
  return {
    kind: kind.replace(/^oxlint-/u, 'eslint-'),
    rules: value
      .split(',')
      .map(rule => rule.trim())
      .filter(Boolean),
    description,
  }
}

function directives(context) {
  return context.sourceCode
    .getAllComments()
    .map(comment => ({ comment, directive: parseDirective(comment) }))
    .filter(({ directive }) => directive)
}

const report = (context, comment, messageId, data) =>
  context.report({ loc: comment.loc, messageId, data })

export const requireDescription = {
  meta: {
    type: 'suggestion',
    docs: { description: 'Every directive comment says why' },
    schema: [],
    messages: {
      missingDescription:
        'Unexpected undescribed directive comment. Include descriptions to explain why the comment is necessary.',
    },
  },
  create(context) {
    for (const { comment, directive } of directives(context)) {
      if (!directive.description) {
        report(context, comment, 'missingDescription')
      }
    }
    return {}
  },
}

export const noUnlimitedDisable = {
  meta: {
    type: 'suggestion',
    docs: { description: 'A disable comment names the rules it turns off' },
    schema: [],
    messages: {
      unexpected:
        "Unexpected unlimited '{{kind}}' comment. Specify some rule names to disable.",
    },
  },
  create(context) {
    for (const { comment, directive } of directives(context)) {
      if (
        directive.kind.startsWith('eslint-disable') &&
        directive.rules.length === 0
      ) {
        report(context, comment, 'unexpected', { kind: directive.kind })
      }
    }
    return {}
  },
}

export const disableEnablePair = {
  meta: {
    type: 'suggestion',
    docs: { description: 'A block disable comment is closed again' },
    schema: [
      {
        type: 'object',
        properties: { allowWholeFile: { type: 'boolean' } },
        additionalProperties: false,
      },
    ],
    messages: {
      missingPair: "Requires 'eslint-enable' directive.",
      missingRulePair: "Requires 'eslint-enable' directive for '{{ruleId}}'.",
    },
  },
  create(context) {
    const allowWholeFile = context.options[0]?.allowWholeFile ?? false
    const firstToken = context.sourceCode.ast.body[0]
    if (allowWholeFile && !firstToken) return {}
    const firstStart = firstToken?.range[0] ?? Infinity

    /** Open block disables: { comment, ruleId (null = every rule) }. */
    let open = []
    for (const { comment, directive } of directives(context)) {
      if (directive.kind === 'eslint-disable') {
        const ids = directive.rules.length ? directive.rules : [null]
        for (const ruleId of ids) open.push({ comment, ruleId })
      } else if (directive.kind === 'eslint-enable') {
        if (directive.rules.length === 0) open = []
        else {
          const closing = new Set(directive.rules)
          open = open.filter(
            area => area.ruleId === null || !closing.has(area.ruleId)
          )
        }
      }
    }
    for (const { comment, ruleId } of open) {
      if (allowWholeFile && comment.range[0] <= firstStart) continue
      report(context, comment, ruleId ? 'missingRulePair' : 'missingPair', {
        ruleId,
      })
    }
    return {}
  },
}
