# 06 — Future Scope

Items discussed or discovered during this PRD but explicitly deferred. Revisit when the trigger
condition appears.

## Deferred from decisions

- **Narrow `GOOGLE_SCOPES`** (from D8): with the SOW feature gone, nothing needs the
  `drive`/`documents` OAuth scopes in `apps/internal/lib/oauth/google.ts`, but removing them changes
  the consent screen for every future Google connection and invites scope drift between existing
  and new grants. Revisit once it's confirmed no upcoming feature needs Docs/Drive (a proposal-
  generation feature was evidently once planned — the deleted `lib/google/docs.ts` carried unused
  `copyDocument`/`shareDocument` helpers).
- **Lead task overlay stay-open** (from D1): the quick-capture overlay keeps close-on-save. If
  lead-task creation grows into a fuller flow (planning from a lead task, etc.), adopt the 01
  create→edit transition there too — the `closeOnSave` prop makes it a one-line flip plus a
  navigation callback.
- **SOW data export** (from D6): rejected — drop without export. If a need for historical SOW
  snapshot text surfaces post-drop, the content still exists in the source Google Docs revision
  history.

## Discovered adjacent work (not asked for)

- **Hours-logged on task cards / My Tasks board**: 02 surfaces time logs only in the task sheet.
  A per-card aggregate (e.g. "3.5h") would need `TaskWithRelations` to carry a hours rollup and a
  batched query — meaningful board-query cost, so wait for an explicit ask.
- **Client count-query inconsistency** (from 04): `apps/internal/lib/queries/clients/settings/list-clients.ts`
  computes `totalProjects` **without** a `deletedAt` filter and `activeProjects` without ONBOARDING,
  diverging from `fetchClientsWithMetrics`. Feeds the settings/archive surface only. Cleanup pass
  candidate.
- **Clients archive management table**: still renders a bare active-projects number with no total
  column and no hover. Extend 04's cell there if the archive page ever gets attention.
- **A `listTaskTimeLogs`-powered "time" column or rollup elsewhere** (reports, project overview):
  the 02 query + API route are reusable; nothing else consumes them yet.
- **Users: search-by-name/email filter**: while adding the filter row, a text search input would
  slot into the same pattern (submissions has no search either — would be a new pattern; needs
  debounced URL writes). Wait for an ask.
