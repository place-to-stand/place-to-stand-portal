# PR #279 resume note (30 Oct 2026, ~19:55 UTC, before the macOS update restart)

## Done (pushed to claude/project-thread-ee2vhs, head a7d36244)

- All 46 decisions, every UI ask from today, and the review fixes (Stripe Checkout paid only when Stripe says paid; hours summary month key; four small review items).
- Re-verified at baaf9e45: rehearsal on the fresh prod dump passes (41/41, ALL CHECKS PASS, no drift, undo 0), close amounts identical for 13 months, lint/type-check/build pass, Codex review approve, Claude review fixed.
- Lint PR #281 (claude/lint-guardrails) open as a draft, merged with #279 at baaf9e45.

## After the restart

1. Start Docker Desktop (`open -a Docker`); the place-to-stand-portal Supabase containers should come back; check `psql -h 127.0.0.1 -p 54322 -U postgres -c 'select 1'` (password postgres).
2. Restart :3003/:3011 from ~/Sites/place-to-stand-portal-local (fast-forward it to the PR head first), with the egress guard (NODE_OPTIONS="--require /Users/jasondesiderio/Backups/pts-portal/local-prod-guard/block-egress.cjs").
3. Restart the rehearsal apps :3013/:3014 from ~/Sites/place-to-stand-portal-0111 on DATABASE_URL=.../prod_rehearsal_app2.
4. Re-run the full e2e suite with E2E_WRITES=1 on :3013 (it was cut short by the full disk).
5. Email checks: app mail goes to local Mailpit (http://127.0.0.1:54324) outside production. Trigger portal invite, sign-in link / reset, invoice send and form-submission emails on :3013-style server; check recipient, from, subject, links.
6. Stripe: restart a dev server with STRIPE_WEBHOOK_SECRET=whsec_local_test_secret and post signed events (paid, unpaid then async succeeded, async failed, under/over/wrong currency, replay) to /api/integrations/stripe for an invoice on prod_rehearsal_app2; check status and hour_blocks.
7. Report all results to the coordinator together.
