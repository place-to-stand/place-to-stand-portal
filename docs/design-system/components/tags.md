# Tags

Free-form labels people type onto a record, Shopify-style: "Non-profit", "Production studio", "Salon". Companies have them first; any record can adopt them (`lib/tags/server.ts` explains how). Each kind of record keeps its own tags: a company's "Salon" is never offered on a lead.

**Field:** `TagField` (`components/tags/tag-field.tsx`), labelled "Tags" with `FormLabel optional`. The field looks like every other trigger (`fieldTriggerClasses`) and holds the picked tags as badges, each with a × to take it off, or "Add tags…" when empty; it grows a line when they wrap. Clicking it, or Enter or Space on it, opens a searchable list of the kind's tags, each as its badge with a check on the right when picked. Typing filters it; Enter on "Create “…”" or a comma adds what was typed. A name that exists in any case reuses that tag and its spelling. Like every sheet control it only sets the form: Save writes the tags with the rest of the record. (guard: review)

**In a list:** `TagList` (`components/tags/tag-list.tsx`) shows the first two tags and "+N" for the rest, so rows keep one height. The list's tag filter is a multi-choice `FilterSelect` ("All tags") whose options are the same badges; it matches records with any of the picked tags. (guard: review)

**Look:** every tag is `TagBadge`: the `secondary` badge, so it reads as a label, not a status, and stays clear of the status and entity colours. Names are stored as typed and shown in the badge's caps. (guard: scripts/check-badges.mjs)

**Limits:** 40 characters a tag, 20 tags a record; spaces collapse and commas split. (guard: review)

**Who:** whoever can edit the record can add, create and remove its tags (companies: `companies.manage`, so Admin and Sales). (guard: review)
