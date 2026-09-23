# EmptyState

The one "nothing here yet" placeholder, for list sections, sheet sections, boards and client-portal pages. From `@pts/ui/empty-state`.

**Look:** a dashed, rounded box: `text-muted-foreground rounded-lg border border-dashed px-4 py-6 text-center text-sm`.

**Props:** `message` (one plain sentence), optional `action` (a Button or link shown under it), or `onClick` to make the whole box a call to action (with `label` when the message isn't the action's name).

**Rules:** one sentence, no title, no illustration or icon, no pep ("No invoices yet."). When filters hide everything, say so ("No projects match the current filters.").
