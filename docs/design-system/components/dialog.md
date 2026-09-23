# Dialog

A centered modal for confirmations and short focused tasks, on Base UI Dialog. From `@pts/ui/dialog`, with `AlertDialog` and `ConfirmDialog` built on the same look.

**Look:** `bg-background border rounded-lg p-6 shadow-lg`, `sm:max-w-lg`, `gap-4`; backdrop `bg-black/70`; fade + zoom from 95% in 200ms. `DialogTitle` `text-lg leading-none font-semibold`; `DialogDescription` text-sm muted; `DialogFooter` stacks on mobile, `sm:flex-row sm:justify-end gap-2`.

**Use** for confirming destructive or irreversible actions ("Archive this client?") and small one-step forms. **Use a Sheet** for creating or editing an entity.

**Copy:** title is a question or verb phrase; description says what happens and whether it can be undone; the confirm button repeats the verb and object ("Archive client"), `destructive` variant.
