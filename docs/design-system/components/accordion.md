# Accordion

The house accordion, from `@pts/ui/accordion`: shadcn's Accordion (`Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent`) built on Base UI (house rule 1), with shadcn's styling: a full-width trigger, the label on the left, a chevron on the right that turns when open, an item divider.

**Use it** for content most people don't need every time, behind one click: a sheet's Activity (always the last section, below comments or updates, closed by default, the trigger reads "Activity (12)"; see `components/sheets/sheet-activity-section.tsx`).

**Rules:** closed by default; a closed panel unmounts, so its content (and any fetch in it) waits for the first open. The trigger is the label, not a sentence. For a one-off "show more" inside a section, a `Collapsible` with a ghost button is enough. (guard: review)
