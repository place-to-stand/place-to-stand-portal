# ContextMenu

The right-click menu, shadcn/ui's Context Menu (base-nova, on Base UI). From `@pts/ui/context-menu`. It opens at the pointer on a right click, or on a long press on touch.

**Look:** the same surface and items as `DropdownMenu`: `bg-popover border rounded-md p-1 shadow-popover`, 16px muted icons, `variant="destructive"` items in `destructive`.

## RecordContextMenu

`components/table/record-context-menu.tsx`: the one right-click menu on every record row and board card. It renders the row or card itself as the trigger (`render`), so no wrapper lands between a table body and its rows.

**Items, in order:** Edit (opens the record, as a click on the row does) · Duplicate (only for `DUPLICABLE_SHEET_ENTITIES`: tasks, leads, invoices, hour blocks) · separator · Archive, or Restore on an archive list. When archive or restore can't run, the item is disabled and the reason shows under it.

**Rules**

- Every record row and board card answers a right click with `RecordContextMenu`; lists pass the handlers their row buttons already use, so the menu never runs a second version of an action. (guard: review)
- Duplicate opens the record's create sheet filled in from it (`?<entity>=copy-<uuid>`, `useSheetParams().duplicate`). Saving creates a new record and never touches the source. Workflow position resets: a copied task starts in the first column and a copied lead at the first stage. (guard: review)
- Companies, people, submissions and projects have no Duplicate: a second "Acme" is a mistake, submissions come from the website, and a project's tasks wouldn't come with it. (guard: review)
- Draggable cards pass `draggable`, so on touch a held finger drags and only a right click opens the menu. (guard: review)
- Board cards with no archive flow of their own use `useRecordArchive` (`components/table/use-record-archive.tsx`): the shared `ArchiveConfirmDialog`, the action, toasts and a refresh. (guard: review)
