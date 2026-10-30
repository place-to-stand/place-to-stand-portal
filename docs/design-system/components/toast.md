# Toast

A short note that something just happened, in the bottom corner (bottom centre on a phone). It goes away by itself after 4 seconds, or with its close button. From `apps/internal/components/ui/use-toast`: `toast({ title, description?, variant? })`. The look is `ToastCard` (`components/ui/toast-card.tsx`); it is shown on `/design#feedback`, with every kind visible.

**Kinds:**
- `default` / `success`: confirms something that just happened. Green `CircleCheck`.
- `destructive`: a failure. Red `TriangleAlert`, red title, a light red wash.
- `warning`: it worked, but something needs a look (a closed month affected). Amber `TriangleAlert`, a light amber wash.
- `info`: neutral news ("Copied"). Muted `Info`.

**Built like an Alert:** the same icon rule (`firstLineIcon` from `@pts/ui/alert`), so the icon and the close button each sit on the first line of text however it wraps. Semibold title, muted description, 14px text, the popover surface, a border and the large shadow. Colours are tokens only: no gradients, no solid red or amber slabs.

**Copy:** past tense on success ("Invoice sent"); "Unable to <verb> <noun>" on failure, with the reason in the description; sentence case.

**Toast or Alert?** A toast reports what just happened and leaves. An Alert stays on the page or sheet while its cause does (a lead's person isn't at its company).

**Save results are toasts, on every sheet and dialog.** A save, archive, send or log either succeeds ("Company saved", "Company created", "Time logged") or fails ("Unable to save company") as a toast, the same way everywhere, and a failed save leaves the sheet open with its edits. A refusal gives its reason in the description: "Someone else saved this company. Reload to see their changes.", a closed month, "Only an admin can …". There is no inline save-error box. Only a field's own error (required, format, a lead's Won needing a company) stays under that field (`FormMessage`), and it may also be the reason a save toast gives.

**Don't:** put actions in a toast, use one for a field error, or call `toast` with hand-rolled classes.
