# EntityList

`apps/internal/components/sheets/entity-list.tsx`

A sheet's list of related records: a section heading with the + on its right, then one preview card per record 8px below, or a dashed empty state that does what the + does. Every related list uses it: People and Projects and Leads on a company, Companies on a person, Members and the GitHub / Vercel / Supabase links on a project, Tasks and Updates on a lead, Time logs on a task, Linked tasks on a time log, Line items on an invoice, Linked invoice and Linked hour block.

```tsx
<EntityList
  title='People'
  add={{
    label: 'Add person',              // the +'s accessible name
    onAdd: () => setPickerOpen(true), // the + and the empty state both run it
    disabledReason: lockedReason,     // disables both, explains on hover
    render: button => (               // optional: the + as a picker trigger
      <ContactLinkPicker trigger={button} open={pickerOpen} onOpenChange={setPickerOpen} />
    ),
  }}
  isEmpty={people.length === 0}
  emptyMessage='No people here yet. Add the ones you know at this company.'
  status={isLoading ? <Skeleton className='h-11 w-full' /> : undefined}
>
  {people.map(person => <ContactRecordRow key={person.id} contact={person} />)}
</EntityList>
```

## Rules

- **The +, the list and the empty state come together.** Never a `SectionAddButton` beside a hand-built heading, and never a clickable empty state without the + above it. (guard: lint, `no-restricted-imports` on `section-add-button`)
- **The empty state is the action.** When adding is allowed, clicking the dashed box does what the + does. When it isn't, both are disabled and the + says why.
- **8px under the heading.** The heading sits 8px above the cards or the empty state, the same as a field label over its control. The + overlaps the heading row, so it never adds height.
- **Rows are preview cards.** `SheetRecordRow` (and its entity variants) by default; any card that reads as one record is fine (time log rows, line items). Cards stack 8px apart.
- **Read-only lists** leave out `add`: the heading and the cards stay, and the empty state is plain.
- **`status`** replaces the body while loading or after a failed load.
- **`titleAddon`** sits after the title (a count badge, "3h logged"). Don't put a count next to the +.

Comments stays its own thing (a thread with an inline composer) but uses `SheetSection list` for the same 8px heading.
