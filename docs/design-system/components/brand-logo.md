# BrandLogo

The Place To Stand lockup: the blueprint mark (a square frame holding a dot a third its size) beside "Place To Stand" in Space Grotesk bold, tracking-tight. It is the only logo in both portals for Place To Stand's own install. From `@pts/ui/brand` (`BrandLogo`, `BrandLogoMark`, `BrandLockup`, `BlueprintCorners`, `BRAND`).

**Sizes** (`size`): `sm` mark 16 / text 15px / gap-2 (client portal header) · `md` 20 / text-lg / gap-2.5 (internal sidebar, mobile share header) · `lg` 24 / text-xl / gap-3 (the marketing header's exact size).

**Tone** (`tone`)

- `theme` (default): follows the app theme. Light: mark `#65a30d` (`brand-lime-600`), frame at 60%; dark: `#b5f542` (`brand-lime`), frame at 50%; word in `foreground`.
- `brand`: pinned to the dark marketing colors (lime mark, `brand-text` word) for `brand-bg` grounds — auth screens and public share headers.

**Also:** `BrandLogoMark` alone where the wordmark won't fit (collapsed sidebar); frame 1px, 2px at 32px+. `BrandLockup` (auth): 36px mark over the wordmark over a lime `mono-label` naming the portal ("Internal Portal"). `BlueprintCorners`: lime corner brackets for cards on share pages only.

**Another business** (Settings → Business). Every logo takes the business: pass `brandPropsFor(identity)` (`name`, `logoSrc`, `iconSrc`, from `lib/business/identity.ts` in the internal portal, `lib/business.ts` in the client portal). An uploaded logo replaces mark and wordmark (its height is the mark's plus 8px, at most 200px wide). Without a logo, the name stands in the wordmark's place, with the uploaded icon as its mark. The blueprint mark belongs to Place To Stand: another name with no icon gets no mark beside the wordmark, and `BrandLogoMark` alone shows the name's first letter in the frame instead. Uploaded images are served from `/api/public/business/{logo,icon}` on the internal portal. (guard: review)

**Don't**

- Use the PTS favicon tile (Logos group) as an in-app logo.
- Put `brand-lime` on a light ground — use `tone="theme"`.
- Recolor, outline, or re-set the wordmark in another face or case.

**Favicon files.** `pts-favicon-192.png` and `pts-apple-icon-180.png` (white "PTS" on `brand-bg` with lime corner brackets) are embedded in `packages/ui/src/brand-icon-assets.ts`. Favicon and apple-touch icon only, never an in-app logo. There is no SVG logo file in the repo.
