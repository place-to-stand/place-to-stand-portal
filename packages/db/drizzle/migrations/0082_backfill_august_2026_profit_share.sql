-- Backfill the August 2026 partner profit share onto that month's close.
--
-- August was closed on Sep 1, before the portal tracked profit share, and its
-- first distribution went out from Mercury by hand on Sep 4:
--
--   Jason Desiderio             $7,779.13  = $3,472.50 accrued + $4,306.63 profit share
--   Kristopher Crawford, LLC    $5,341.63  = $1,035.00 accrued + $4,306.63 profit share
--
-- which is exactly the policy (lib/billing/profit-share.ts) applied to the
-- Aug 31 Mercury balance:
--
--   Aug 31 balance (end of day, Pacific)   $23,120.77   checking ••3259; savings ••8856 was $0.00
--   less partner payouts in the close      −$4,507.50
--   less minimum balance                   −$10,000.00
--   available to share                      $8,613.27   → $4,306.63 each, rounded down (1¢ stays)
--
-- The Aug 31 balance is today's current balance minus every settled
-- transaction posted after Sep 1 07:00Z; the app derives the same figure live.
--
-- Writes only the `profitShare` key of the envelope, leaving the frozen
-- report and the close's cutoff alone, and marks it added after the close.
-- Safe to run anywhere: no August 2026 close, or one that already has a
-- profit share (e.g. re-closed after this shipped), is left untouched. It
-- refuses to write if the close's payouts aren't the ones the transfers were
-- computed from.

DO $$
DECLARE
  snap record;
  partners jsonb;
BEGIN
  SELECT id, report INTO snap
  FROM monthly_close_snapshots
  WHERE year = 2026 AND month = 8 AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE NOTICE 'No August 2026 close; nothing to backfill.';
    RETURN;
  END IF;

  IF jsonb_typeof(snap.report -> 'profitShare') = 'object' THEN
    RAISE NOTICE 'August 2026 close already has a profit share; leaving it.';
    RETURN;
  END IF;

  IF (snap.report -> 'report' -> 'partnerPayouts' ->> 'totalAmount')::numeric <> 4507.50 THEN
    RAISE EXCEPTION 'August 2026 close payouts are %, expected 4507.50; not backfilling.',
      snap.report -> 'report' -> 'partnerPayouts' ->> 'totalAmount';
  END IF;

  SELECT jsonb_agg(
           jsonb_build_object(
             'userId', u.id,
             'name', COALESCE(u.full_name, u.email),
             'email', u.email,
             'avatarUpdatedAt', CASE WHEN u.avatar_url IS NOT NULL THEN u.updated_at::text END,
             'amount', 4306.63
           )
           ORDER BY p.ord
         )
  INTO partners
  FROM (VALUES
         (1, 'jason@placetostandagency.com'),
         (2, 'kris@placetostandagency.com')
       ) AS p(ord, email)
  JOIN users u ON lower(u.email) = p.email AND u.deleted_at IS NULL;

  IF jsonb_array_length(COALESCE(partners, '[]'::jsonb)) <> 2 THEN
    RAISE EXCEPTION 'Expected both profit-share partners in users; found %.', partners;
  END IF;

  UPDATE monthly_close_snapshots
  SET report = jsonb_set(
        report,
        '{profitShare}',
        jsonb_build_object(
          'asOfDate', '2026-08-31',
          'monthComplete', true,
          'balance', 23120.77,
          'accounts', jsonb_build_array(
            jsonb_build_object('id', '5035270a-17e4-11f1-bdc6-2312a4d0d05c', 'name', 'Mercury Checking ••3259', 'balance', 23120.77),
            jsonb_build_object('id', '505e9cde-17e4-11f1-9b3c-4f3e126b43c2', 'name', 'Mercury Savings ••8856', 'balance', 0)
          ),
          'fetchedAt', to_jsonb(now()),
          'addedAfterCloseAt', to_jsonb(now()),
          'payouts', 4507.50,
          'minimumBalance', 10000,
          'available', 8613.27,
          'shortfall', 0,
          'partners', partners,
          'totalAmount', 8613.26
        )
      ),
      updated_at = now()
  WHERE id = snap.id;

  RAISE NOTICE 'Backfilled the August 2026 profit share ($4,306.63 each).';
END $$;
