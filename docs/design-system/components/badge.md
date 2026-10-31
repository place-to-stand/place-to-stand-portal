# Badge

A small pill of status or label text. From `@pts/ui/badge`: one size for every badge in both apps, `rounded-full border px-2 py-0.5 text-xs font-semibold uppercase tracking-wide`: all caps, semibold, slightly spaced.

**Two looks, and only two:**
- **Status** (a state that changes: lead stage, project and task status, invoice state, billing type, deployment state): `variant='outline'` plus a soft tinted fill from `BADGE_TINTS` (`@pts/ui/badge-tints`) or the domain's status token (`getLeadStatusToken`, `getProjectStatusToken`, `getTaskStatusToken`, `invoiceStatusTint`). Use the domain components where they exist: `LeadStatusBadge`, `InvoiceStatusBadge`, `ProjectStatusBadge` (`components/projects/project-status-badge.tsx`), and `ProjectStatusCell` to change a project's status in place.
- **Label** (what something is: Client, a sign-in role such as Admin, Sales, Client): `variant='outline'` with no fill. An entity state carries its entity icon and border, label in the entity colour too (`ClientBadge`: the briefcase, `ENTITY_ACCENTS.client.cardStatic`, label, icon and outline all money green). Roles carry no icon: a sign-in is part of the person and has no icon of its own.

`secondary` is a quiet neutral chip (a count, "Default"); `destructive` is for a failure state.

**Rules (checked by `scripts/check-badges.mjs` in `npm run lint`):** never change a badge's case, letter spacing, weight, text size, height, vertical padding or radius at a call site; the component sets them. Colour and layout (`gap`, margins, `shrink-0`) are fine. Write the label in sentence case ("New opportunities", "Closed won"); the component shows it in caps.

**Consumer provides:** one to three words; optional 12px icon (`[&>svg]:size-3`, `gap-1`).

**Don't:** use a badge as a button, invent new coloured variants, or rely on colour alone for status. Count bubbles on the sidebar and the notifications bell are counters, not badges.
