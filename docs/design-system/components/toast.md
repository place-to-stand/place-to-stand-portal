# Toast

A short note that something just happened, in the bottom corner (bottom centre on a phone). It goes away by itself after 4 seconds, or with its close button. From `apps/internal/components/ui/use-toast`: `toast({ title, description?, variant? })`. The look is `ToastCard` (`components/ui/toast-card.tsx`); it is shown on `/design#feedback`, with every kind visible.

**Kinds:**
- `default` / `success`: confirms something that just happened. Green `CircleCheck`.
- `destructive`: a failure. Red `TriangleAlert`, red title, a light red wash.
- `warning`: it worked, but something needs a look (a closed month affected). Amber `TriangleAlert`, a light amber wash.
- `info`: neutral news ("Copied"). Muted `Info`.

**Built like an Alert:** the same icon rule (`firstLineIcon` from `@pts/ui/alert`), so the icon and the close button each sit on the first line of text however it wraps. Semibold title, muted description, 14px text, the popover surface, a border and the large shadow. Colours are tokens only: no gradients, no solid red or amber slabs.

**Copy:** past tense on success ("Invoice sent"); "Unable to <verb> <noun>" on failure, with the reason in the description; sentence case.

**Toast or Alert?** A toast reports what just happened and leaves. An Alert stays on the page or sheet while its cause does (a lead's person isn't at its company). An error someone must fix before saving stays in the form (`FormMessage` for a field, `FormFeedback` for the save), never only in a toast.

**Don't:** put actions in a toast, use one for a field error, or call `toast` with hand-rolled classes.
