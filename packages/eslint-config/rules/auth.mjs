/**
 * Role checks (apps/internal). Each message names the rule it enforces and
 * says what to write instead. See CLAUDE.md, "Authentication & Permissions".
 */

const SIGNED_IN = new Set(['user', 'actor', 'viewer', 'currentUser', 'me'])
const SIGNED_IN_ROLE = new Set(['actorRole', 'viewerRole', 'userRole'])
const ROLES = new Set(['ADMIN', 'SALES', 'CLIENT'])

function isViewerRole(node) {
  if (node.type === 'ChainExpression') node = node.expression
  if (node.type === 'Identifier') return SIGNED_IN_ROLE.has(node.name)
  return (
    node.type === 'MemberExpression' &&
    !node.computed &&
    node.property.name === 'role' &&
    node.object.type === 'Identifier' &&
    SIGNED_IN.has(node.object.name)
  )
}

const isRoleLiteral = node =>
  node.type === 'Literal' &&
  typeof node.value === 'string' &&
  ROLES.has(node.value)

/**
 * What the signed-in user may do is a capability (lib/auth/capabilities.ts),
 * so Settings → Roles & permissions shows it and a new role needs no hunt.
 * Comparing someone else's role (a person in a list) is data, and allowed.
 */
export const noRoleLiteral = {
  meta: {
    type: 'problem',
    docs: { description: "Check the viewer's capability, not their role" },
    schema: [],
    messages: {
      literal:
        "Don't compare the signed-in user's role to '{{role}}': ask what they may do with roleCan(user.role, '<capability>') or assertCan(user, '<capability>') from @/lib/auth (add a capability in lib/auth/capabilities.ts if none fits).",
    },
  },
  create(context) {
    const file = context.filename.split('\\').join('/')
    if (/\/lib\/auth\//.test(file)) return {}
    return {
      BinaryExpression(node) {
        if (!['===', '!==', '==', '!='].includes(node.operator)) return
        const pairs = [
          [node.left, node.right],
          [node.right, node.left],
        ]
        for (const [side, other] of pairs) {
          if (isViewerRole(side) && isRoleLiteral(other)) {
            context.report({
              node,
              messageId: 'literal',
              data: { role: other.value },
            })
            return
          }
        }
      },
    }
  },
}
