# Board (kanban drag and drop)

The project task board, My Tasks and the lead board drag cards the same way, through one hook and one overlay.

**Code:** `useKanbanDrag` (`apps/internal/lib/dnd/use-kanban-drag.ts`) for drag state and drop targets, `BoardDragOverlay` and `BOARD_CARD_GHOST_CLASS` (`apps/internal/components/board/board-drag.tsx`) for what the person sees. Pure move logic is in `lib/dnd/kanban-draft.ts`, ranks in `lib/dnd/kanban.ts`.

- **The card moves while it is dragged.** Carrying a card into another column moves it there at once, so that column opens a gap the card's exact height and its cards slide aside; the column it left closes up. No placeholder pops in. (guard: review)
- **The dragged card's own slot is the drop target:** a dashed outline the card's height (`BOARD_CARD_GHOST_CLASS`). Where the outline is, the card lands. (guard: review)
- **The preview never changes size.** dnd-kit sizes the overlay to the card that was picked up; previews fill it (`w-full`), never a fixed width. On drop the preview glides into its slot (180ms). (guard: review)
- **The column the card is in** gets the `ring-primary` ring while dragging. (guard: review)
- A new board uses `useKanbanDrag` and `BoardDragOverlay`; it renders `itemsFor(column)` and saves in `onDrop`, which gets the final column and index in the rendered list. (guard: review)
