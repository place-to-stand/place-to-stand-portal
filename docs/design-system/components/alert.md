# Alert

A notice that stays on the page or in a sheet while its cause does. From `@pts/ui/alert`: `Alert`, `AlertContent` (the text column), `AlertTitle`, `AlertDescription`, `AlertAction` (buttons after the text, right-aligned, wrapping under it on a phone). Shown on `/design#feedback`.

**Variants:** `default` (card, muted icon: neutral information), `warning` (the `warning` token: worth a look, never blocks saving), `destructive` (something is broken).

**A save side effect is a caution alert.** Anything Save does beyond the form itself ("Ada Lovelace will get an email invite to the client portal when you save.", "Ada Lovelace will get a client portal sign-in (ada@acme.com) and an email link when you save.", "Billing stops when you save. …", "Ada Lovelace isn't at Acme Industries yet, and will be added to Acme Industries when you save.") is one `SaveSideEffect` (`components/sheets/save-side-effect.tsx`): `warning` with `TriangleAlert`. Copy: the person or thing first, what happens, then "when you save"; never "Saving <verb>s …". Never a muted line. State and field help that Save doesn't act on ("Billing stops after June 2026.", "They sign in with ada@acme.com.") stay plain muted text.

**Consumer provides:** a lucide icon as the first child (`TriangleAlert` for warning and destructive; it is sized, tinted and centred on the first line of text for you), then `AlertContent`, then an optional `AlertAction` with `size='xs'` buttons that fix the cause ("Add to Acme Industries").

**Alignment:** the icon and the action are each one text line tall, so both centre on the first line of text, however the text wraps.

**Do:** say what is wrong in one sentence and put the fix in the action. Use it for mismatches in a form (a lead's person not at its company), advisories (below a product's minimum quantity), and page-level failures (the saved close can't be read).
**Don't:** use it for something that just happened (that's a toast), for a field error (`FormMessage`) or a save result (a toast), or hand-roll an amber or red box.
