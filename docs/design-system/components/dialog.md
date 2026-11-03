# Dialog

A centered modal for confirmations and short focused tasks, on Base UI Dialog. From `@pts/ui/dialog`, with `AlertDialog` and `ConfirmDialog` built on the same look.

**Look:** `bg-background border rounded-lg p-6 shadow-lg`, `sm:max-w-lg`, `gap-4`; backdrop `bg-black/70`; fade + zoom from 95% in 200ms. `DialogTitle` `text-lg leading-none font-semibold`; `DialogDescription` text-sm muted; `DialogFooter` stacks on mobile, `sm:flex-row sm:justify-end gap-2`.

**Use** for confirming destructive or irreversible actions ("Archive this client?") and small one-step forms, including over a sheet (link a repo, email an invoice, log time). **Use a Sheet** for creating or editing an entity; a related record opens as its own sheet on top.

**Copy:** title is a question or verb phrase; description says what happens and whether it can be undone; the confirm button repeats the verb and object ("Archive client"), `destructive` variant.

**Confirm:** every "Are you sure?" is `ConfirmDialog` from `@pts/ui/confirm-dialog`; extra body (the monthly close summary) goes in its `children`, below the description. A raw `AlertDialog` is only for the `/design` specimen. (guard: review)

**Archive:** confirm an archive with `ArchiveConfirmDialog` (`components/sheets/archive-confirm-dialog.tsx`), never a hand-written `ConfirmDialog`: title "Archive <entity>?", body "Archiving <name> hides it from <list>. Its history stays.", plus an optional `extra` sentence for other consequences; confirm button "Archive <entity>" ("Archiving…" while pending). Every archive uses it, companies included (their portal-access consequence goes in `extra`). (guard: eslint `pts/archive-confirm`)
