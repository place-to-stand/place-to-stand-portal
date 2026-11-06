-- Sheets refuse a save when the record changed after the sheet loaded it,
-- comparing updated_at. So on the seven sheet tables updated_at must move on
-- every change a person makes, and only then:
--
--   * an UPDATE that sets updated_at itself moves it: every sheet save does,
--     so a save that only changed related rows (members, links, lines)
--     still counts, and so does a touch (touchContacts);
--   * otherwise any changed column moves it, as set_updated_at() does,
--   * except the machine-written columns named in the trigger's arguments
--     (worker status, invoice views, Stripe ids): an UPDATE changing only
--     those, or nothing, leaves it alone, so they never look like a
--     teammate's save. Their writers don't set updated_at.
--
-- An argument "col:FROM>TO" ignores only that one change of the column
-- (invoices: SENT>VIEWED when the client opens the link). updated_by is
-- always ignored: who wrote last is not itself a change.
CREATE OR REPLACE FUNCTION public.set_sheet_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
	old_row jsonb;
	new_row jsonb;
	arg text;
	col text;
begin
	if new.updated_at is distinct from old.updated_at then
		new.updated_at = timezone('utc', now());
		return new;
	end if;
	old_row = to_jsonb(old) - 'updated_at' - 'updated_by';
	new_row = to_jsonb(new) - 'updated_at' - 'updated_by';
	foreach arg in array coalesce(tg_argv, array[]::text[]) loop
		if position(':' in arg) > 0 then
			col = split_part(arg, ':', 1);
			if old_row ->> col = split_part(split_part(arg, ':', 2), '>', 1)
				and new_row ->> col = split_part(split_part(arg, ':', 2), '>', 2) then
				old_row = old_row - col;
				new_row = new_row - col;
			end if;
		else
			old_row = old_row - arg;
			new_row = new_row - arg;
		end if;
	end loop;
	if new_row <> old_row then
		new.updated_at = timezone('utc', now());
	end if;
	return new;
end;
$function$;--> statement-breakpoint
DROP TRIGGER IF EXISTS "companies_set_updated_at" ON "companies";--> statement-breakpoint
CREATE TRIGGER "companies_set_updated_at" BEFORE UPDATE ON "companies" FOR EACH ROW EXECUTE FUNCTION public.set_sheet_updated_at();--> statement-breakpoint
DROP TRIGGER IF EXISTS "contacts_set_updated_at" ON "contacts";--> statement-breakpoint
CREATE TRIGGER "contacts_set_updated_at" BEFORE UPDATE ON "contacts" FOR EACH ROW EXECUTE FUNCTION public.set_sheet_updated_at();--> statement-breakpoint
DROP TRIGGER IF EXISTS "leads_set_updated_at" ON "leads";--> statement-breakpoint
CREATE TRIGGER "leads_set_updated_at" BEFORE UPDATE ON "leads" FOR EACH ROW EXECUTE FUNCTION public.set_sheet_updated_at();--> statement-breakpoint
DROP TRIGGER IF EXISTS "projects_set_updated_at" ON "projects";--> statement-breakpoint
CREATE TRIGGER "projects_set_updated_at" BEFORE UPDATE ON "projects" FOR EACH ROW EXECUTE FUNCTION public.set_sheet_updated_at();--> statement-breakpoint
DROP TRIGGER IF EXISTS "hour_blocks_set_updated_at" ON "hour_blocks";--> statement-breakpoint
CREATE TRIGGER "hour_blocks_set_updated_at" BEFORE UPDATE ON "hour_blocks" FOR EACH ROW EXECUTE FUNCTION public.set_sheet_updated_at();--> statement-breakpoint
DROP TRIGGER IF EXISTS "tasks_set_updated_at" ON "tasks";--> statement-breakpoint
CREATE TRIGGER "tasks_set_updated_at" BEFORE UPDATE ON "tasks" FOR EACH ROW EXECUTE FUNCTION public.set_sheet_updated_at('worker_status', 'github_issue_number', 'github_issue_url');--> statement-breakpoint
DROP TRIGGER IF EXISTS "invoices_set_updated_at" ON "invoices";--> statement-breakpoint
CREATE TRIGGER "invoices_set_updated_at" BEFORE UPDATE ON "invoices" FOR EACH ROW EXECUTE FUNCTION public.set_sheet_updated_at('viewed_at', 'viewed_count', 'stripe_checkout_session_id', 'stripe_payment_intent_id', 'status:SENT>VIEWED');
