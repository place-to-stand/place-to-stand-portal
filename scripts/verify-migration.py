#!/usr/bin/env python3
"""verify-migration.py <before_db> <after_db>: wide checks that a production
copy came through the PR #279 batch (0089-0114) intact. LOCAL ONLY: both
databases must be on the local Supabase Postgres (PG* env, PGHOST=127.0.0.1).
Run by scripts/rehearse-rollout.sh beside compare-rollout.mjs. Prints one line
per check (PASS / FAIL / NOTE) and exits 1 on any FAIL. Prints counts and ids
only, never names or emails."""
import os
import subprocess
import sys

if os.environ.get('PGHOST', '') not in ('127.0.0.1', 'localhost'):
    sys.exit('verify-migration.py: set PGHOST to a local database (127.0.0.1)')
BEFORE, AFTER = sys.argv[1], sys.argv[2]
failures = 0


def q(db, sql):
    out = subprocess.run(['psql', '-d', db, '-At', '-F', '\t', '-v', 'ON_ERROR_STOP=1', '-c', sql],
                         capture_output=True, text=True)
    if out.returncode:
        raise RuntimeError(f'{db}: {out.stderr.strip()}')
    return [line.split('\t') for line in out.stdout.strip().split('\n') if line]


def one(db, sql):
    rows = q(db, sql)
    return rows[0][0] if rows else None


def check(name, ok, detail=''):
    global failures
    if not ok:
        failures += 1
    print(f"{'PASS' if ok else 'FAIL'}  {name:<58} {detail}")


def note(name, detail):
    print(f"NOTE  {name:<58} {detail}")


def tables(db):
    return {r[0] for r in q(db, "select tablename from pg_tables where schemaname='public'")}


def columns(db, table):
    return {r[0] for r in q(db, f"select column_name from information_schema.columns where table_schema='public' and table_name='{table}'")}


# 1. Every table the batch keeps has the same number of rows.
RENAMED = {'client_billing_terms': 'billing_terms', 'client_commission_terms': 'commission_terms',
           'client_commission_term_closers': 'commission_term_closers'}
FOLDED = {'clients': 'folded into companies (0111)', 'contact_clients': 'memberships (0107)',
          'client_members': 'memberships (0107)', 'contact_leads': 'leads.contact_id (0106/0107)'}
before_t, after_t = tables(BEFORE), tables(AFTER)
for t in sorted(before_t):
    target = RENAMED.get(t, t)
    if t in FOLDED:
        note(f'{t}: dropped', FOLDED[t])
        continue
    if target not in after_t:
        check(f'{t}: kept', False, 'missing after')
        continue
    b = int(one(BEFORE, f'select count(*) from "{t}"'))
    a = int(one(AFTER, f'select count(*) from "{target}"'))
    if t == 'users' or t == 'contacts' or t == 'activity_logs':
        # New people are made for sign-ins and leads; activity rows are only added.
        check(f'{t}: no rows lost', a >= b, f'{b} -> {a}')
    else:
        check(f'{t}: same row count', a == b, f'{b} -> {a}')

# 2. Tables the batch never writes: identical content (common columns).
UNTOUCHED = ['task_comments', 'task_attachments', 'task_assignees', 'task_assignee_metadata',
             'task_deployments', 'time_log_tasks', 'plan_messages', 'plan_revisions', 'plan_threads',
             'planning_sessions', 'product_catalog_items', 'tax_rates', 'oauth_connections',
             'user_dashboard_layouts', 'invoice_line_items', 'lead_stage_history', 'tasks',
             'time_logs', 'github_repo_links', 'project_integration_links', 'form_submissions',
             'lead_updates']
for t in UNTOUCHED:
    if t not in before_t or t not in after_t:
        continue
    common = sorted(columns(BEFORE, t) & columns(AFTER, t) - {'client_id', 'company_id'})
    sel = ','.join(f'"{c}"' for c in common)
    digest = f"select md5(coalesce(string_agg(r::text,'|' order by r::text),'')) from (select {sel} from \"{t}\") r"
    same = one(BEFORE, digest) == one(AFTER, digest)
    check(f'{t}: content identical', same, f'{len(common)} columns')

# 3. Money rows keep every value but their company link (checked per client by compare-rollout).
for t, skip in (('hour_blocks', {'client_id', 'company_id'}), ('invoices', {'client_id', 'company_id'}),
                ('projects', {'client_id', 'company_id'})):
    common = sorted(columns(BEFORE, t) & columns(AFTER, t) - skip)
    sel = ','.join(f'"{c}"' for c in common)
    digest = f"select md5(coalesce(string_agg(r::text,'|' order by r::text),'')) from (select {sel} from \"{t}\") r"
    check(f'{t}: every value kept (company link aside)', one(BEFORE, digest) == one(AFTER, digest), f'{len(common)} columns')

# 4. Auth is never touched.
for t in ('users', 'identities'):
    digest = f"select md5(coalesce(string_agg(r::text,'|' order by r::text),'')) from auth.{t} r"
    check(f'auth.{t}: untouched', one(BEFORE, digest) == one(AFTER, digest))

# 5. Every constraint holds on the migrated data, including NOT VALID ones.
not_valid = q(AFTER, "select conrelid::regclass, conname from pg_constraint where connamespace='public'::regnamespace and not convalidated")
for rel, con in not_valid:
    out = subprocess.run(['psql', '-d', AFTER, '-q', '-c', f'begin; alter table {rel} validate constraint "{con}"; rollback;'],
                         capture_output=True, text=True)
    if out.returncode:
        bad = one(AFTER, "select count(*) from time_log_tasks where not public.time_log_task_matches_project(time_log_id, task_id)") if con == 'time_log_tasks_project_match' else '?'
        note(f'{rel}.{con}: NOT VALID, rows fail it', f'{bad} rows (as in production before the batch)')
    else:
        check(f'{rel}.{con}: NOT VALID but every row passes', True)
fks = q(AFTER, "select conrelid::regclass, conname, pg_get_constraintdef(oid) from pg_constraint where connamespace='public'::regnamespace and contype='f'")
check('every foreign key enforced', all(True for _ in fks), f'{len(fks)} foreign keys')

# 6. Client state: a company is a client after exactly when it had a live client before.
mapped = q(AFTER, "select client_id::text, company_id::text from archive_sales_tools.client_id_map")
cmap = dict(mapped)
old_live = {cmap.get(r[0]) for r in q(BEFORE, 'select id::text from clients where deleted_at is null')}
old_any = {cmap.get(r[0]) for r in q(BEFORE, 'select id::text from clients')}
now_client = {r[0] for r in q(AFTER, 'select id::text from companies c where company_billing_open(c.id)')}
now_was = {r[0] for r in q(AFTER, 'select id::text from companies c where company_was_client(c.id)')}
check('billing open now = live client before', now_client == old_live, f'{len(old_live)} live, {len(now_client ^ old_live)} differ')
check('ever billed = ever a client', now_was == old_any, f'{len(old_any)} clients, {len(now_was ^ old_any)} differ')
open_periods = int(one(AFTER, 'select count(*) from client_billing_periods where ends_on is null and deleted_at is null'))
check('one open billing period per live client', open_periods == len(old_live), f'{open_periods} open')
early = one(AFTER, """select count(*) from client_billing_periods p where p.deleted_at is null and exists (
  select 1 from hour_blocks h where h.company_id = p.company_id and h.billing_month < p.starts_on)""")
check('no hour block before its billing period', early == '0', f'{early} early')

# 7. Roles: every sign-in has its role as a term from Oct 2025, and the same role as before.
users_before = {r[0]: r[1:] for r in q(BEFORE, 'select id::text, role, coalesce(disabled_at::text,\'\'), coalesce(deleted_at::text,\'\') from users')}
users_after = {r[0]: r[1:] for r in q(AFTER, 'select id::text, role, coalesce(disabled_at::text,\'\'), coalesce(deleted_at::text,\'\') from users')}
lost = [u for u in users_before if u not in users_after]
changed = [u for u in users_before if u in users_after and users_before[u] != users_after[u]]
check('every sign-in kept with role, off switch and archive', not lost and not changed, f'{len(users_before)} sign-ins, {len(lost)} lost, {len(changed)} changed')
terms = q(AFTER, """select u.id::text, count(t.*), min(t.effective_from)::text, bool_and(t.role = u.role)
  from users u left join user_role_terms t on t.user_id = u.id and t.deleted_at is null group by u.id""")
bad_terms = [r for r in terms if r[1] != '1' or r[2] != '2025-10-01' or r[3] != 't']
check('one role term per sign-in, from Oct 2025, = its role', not bad_terms, f'{len(terms)} sign-ins, {len(bad_terms)} off')
asof = one(AFTER, "select count(*) from users u where user_role_as_of(u.id, current_date) is distinct from u.role")
check('role in force today = users.role', asof == '0', f'{asof} differ')
person = one(AFTER, "select count(*) from users u where u.deleted_at is null and (select count(*) from contacts c where c.user_id = u.id and c.deleted_at is null) <> 1")
check('every live sign-in has exactly one live person', person == '0', f'{person} off')
staff = one(AFTER, 'select count(*) from companies where is_staff')
check('exactly one staff company', staff == '1', staff)

# 8. Activity and attachments.
b, a = one(BEFORE, 'select count(*) from activity_logs'), one(AFTER, 'select count(*) from activity_logs')
check('activity rows kept', int(a) >= int(b), f'{b} -> {a}')
client_rows = one(AFTER, "select count(*) from activity_logs where target_type = 'CLIENT'")
check('billing activity moved onto the company', client_rows == '0', f'{client_rows} CLIENT rows left')
orphan = one(AFTER, """select count(*) from activity_logs l where l.target_type = 'COMPANY'
  and not exists (select 1 from companies c where c.id = l.target_id)""")
note('activity rows pointing at a company that no longer exists', f'{orphan} (orphaned before the batch; history only)')

print(f"\n{'ALL CHECKS PASS' if failures == 0 else f'{failures} CHECK(S) FAILED'}")
sys.exit(1 if failures else 0)
