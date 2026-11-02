-- D2 / D24: one way to read billing and commission terms "as of" a date.
-- Before this, four inline subqueries resolved them, each correlated with an
-- outer column (a bug class: drizzle may write that column unqualified) and
-- each with its own default. Both functions take the company id, so no
-- query correlates. Pass 'infinity' for the newest term, scheduled or not.
--
-- Additive only: nothing reads these until the app code that uses them
-- ships, so this runs safely before that merge.
--
-- The billing type in force on p_as_of: the newest live term starting on or
-- before it. NULL when none has started; callers that want a default apply
-- DEFAULT_BILLING_TYPE (packages/db/src/terms.ts), the one place it lives.
CREATE FUNCTION "billing_type_as_of"(p_company uuid, p_as_of date) RETURNS client_billing_type
LANGUAGE sql STABLE AS $$
  SELECT t.billing_type FROM billing_terms t
  WHERE t.company_id = p_company AND t.deleted_at IS NULL
    AND t.effective_from <= p_as_of
  ORDER BY t.effective_from DESC
  LIMIT 1
$$;--> statement-breakpoint
-- The commission term in force on p_as_of, as a whole row (read a column as
-- (commission_term_as_of(id, d)).origination_user_id). NULL when none has
-- started.
CREATE FUNCTION "commission_term_as_of"(p_company uuid, p_as_of date) RETURNS commission_terms
LANGUAGE sql STABLE AS $$
  SELECT t.* FROM commission_terms t
  WHERE t.company_id = p_company AND t.deleted_at IS NULL
    AND t.effective_from <= p_as_of
  ORDER BY t.effective_from DESC
  LIMIT 1
$$;--> statement-breakpoint
-- Callable by the app (owner) only, like the 0113 helpers (see 0115).
REVOKE EXECUTE ON FUNCTION "billing_type_as_of"(uuid, date) FROM PUBLIC, anon, authenticated;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION "commission_term_as_of"(uuid, date) FROM PUBLIC, anon, authenticated;
