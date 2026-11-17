/**
 * `pts/restricted-syntax`: ESLint's `no-restricted-syntax`, which Oxlint
 * doesn't have. Takes the same options, `{ selector, message }` objects, and
 * reports every node a selector matches with that selector's message. The
 * selectors (house rules 4 and 11, the API route guard) live in next.mjs.
 */
export const restrictedSyntax = {
  meta: {
    type: 'problem',
    docs: { description: 'Ban the syntax a selector matches' },
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          selector: { type: 'string' },
          message: { type: 'string' },
        },
        required: ['selector'],
        additionalProperties: false,
      },
    },
  },
  create(context) {
    const visitor = {}
    for (const { selector, message } of context.options) {
      const report = node =>
        context.report({
          node,
          message: message ?? `Using '${node.type}' is not allowed.`,
        })
      // Two entries may share a selector: report each.
      const previous = visitor[selector]
      visitor[selector] = previous
        ? node => {
            previous(node)
            report(node)
          }
        : report
    }
    return visitor
  },
}
