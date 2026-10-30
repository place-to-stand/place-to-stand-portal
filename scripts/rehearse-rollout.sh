#!/usr/bin/env bash
# Release-day rehearsal for PR #279 (migrations 0089–0114) on a copy of
# production. LOCAL ONLY: restores a pg_dump into new databases on the local
# Supabase Postgres (127.0.0.1:54322) and never connects anywhere else.
#
#   scripts/rehearse-rollout.sh /path/to/prod.dump
#
# 1. Restores the dump (public, drizzle, auth) into prod_rehearsal_before,
#    prod_rehearsal and prod_rehearsal_undo.
# 2. Runs the whole batch on prod_rehearsal (one drizzle transaction) and
#    times it; runs scripts/compare-rollout.mjs (before vs after), and
#    recomputes every month's close on the migrated copy: each closed month
#    must still match its snapshot (apps/internal/scripts/close-totals.mts).
# 3. Takes prod_rehearsal_undo to 0104, keeps a copy, runs the batch, runs
#    every documented undo step (docs/migrations/0114-undo.sql, 0113-undo.sql,
#    0112-undo.sql, 0111-undo.sql
#    and the SQL blocks in sales-tools-rollout.md §5), and diffs it against
#    its own 0104 copy (scripts/compare-schemas.py). Expect no differences.
set -uo pipefail
DUMP=${1:?usage: scripts/rehearse-rollout.sh /path/to/prod.dump}
export PGPASSWORD=postgres PGHOST=127.0.0.1 PGPORT=54322 PGUSER=postgres
ROOT=$(cd "$(dirname "$0")/.." && pwd)
U=postgresql://postgres:postgres@127.0.0.1:54322
WORK=$(mktemp -d)

restore() {
  local db=$1
  dropdb --if-exists "$db"; createdb -T template0 "$db"
  psql -d "$db" -q -c "create schema extensions; create schema auth; create schema drizzle; create extension if not exists pg_trgm with schema public; create extension if not exists pgcrypto with schema extensions; create extension if not exists \"uuid-ossp\" with schema extensions; alter database $db set search_path to public, extensions;"
  pg_restore -l -n public -n drizzle -n auth "$DUMP" > "$WORK/all.list"
  grep -v "TABLE DATA public time_log_tasks" "$WORK/all.list" > "$WORK/main.list"
  grep "TABLE DATA public time_log_tasks" "$WORK/all.list" > "$WORK/last.list"
  pg_restore -d "$db" --no-owner --no-privileges -L "$WORK/main.list" "$DUMP" 2>&1 | grep -i "error:" || true
  # Production holds rows that fail this function-based check (it reads
  # other tables, which changed later). Load them as production has them.
  psql -d "$db" -q -c "alter table time_log_tasks drop constraint time_log_tasks_project_match"
  pg_restore -d "$db" --no-owner --no-privileges -L "$WORK/last.list" "$DUMP" 2>&1 | grep -i "error:" || true
  psql -d "$db" -q -c "alter table time_log_tasks add constraint time_log_tasks_project_match check (public.time_log_task_matches_project(time_log_id, task_id)) not valid"
}

for db in prod_rehearsal_before prod_rehearsal prod_rehearsal_undo; do restore $db; done
cd "$ROOT/packages/db"
t0=$(date +%s)
DATABASE_URL=$U/prod_rehearsal npx drizzle-kit migrate > "$WORK/migrate.log" 2>&1; rc=$?
echo "FORWARD exit=$rc in $(( $(date +%s) - t0 ))s, migrations: $(psql -d prod_rehearsal -At -c 'select count(*) from drizzle.__drizzle_migrations')"
node "$ROOT/scripts/compare-rollout.mjs" --before $U/prod_rehearsal_before --after $U/prod_rehearsal; echo "COMPARE exit=$?"
(cd "$ROOT/apps/internal" && DATABASE_URL=$U/prod_rehearsal npx tsx --require ./scripts/stub-server-only.cjs scripts/close-totals.mts > "$WORK/close.json")
python3 - "$WORK/close.json" <<'PY'
import json,sys
d=json.load(open(sys.argv[1])); keys=['billingIn','payouts','payroll','origination','closer','prepaid','net30']
drift=[m for m,v in d.items() if v.get('snapshot') and any(v['snapshot'].get(k)!=v['live'].get(k) for k in keys)]
print(f"CLOSE {len(d)} months, {sum(1 for v in d.values() if v.get('snapshot'))} closed, drifting from their snapshot: {drift or 'none'}")
PY

cp -R "$ROOT/packages/db/drizzle/migrations" "$WORK/mig0104"
python3 -c "import json;p='$WORK/mig0104/meta/_journal.json';j=json.load(open(p));j['entries']=[e for e in j['entries'] if e['idx']<=104];json.dump(j,open(p,'w'),indent=2)"
printf "export default { dialect: 'postgresql', out: '$WORK/mig0104', schema: './src/schema.ts', dbCredentials: { url: '$U/prod_rehearsal_undo' } }\n" > ./.rehearse0104.config.ts
npx drizzle-kit migrate --config ./.rehearse0104.config.ts > /dev/null 2>&1; rm ./.rehearse0104.config.ts
dropdb --if-exists prod_rehearsal_at0104; createdb -T prod_rehearsal_undo prod_rehearsal_at0104
DATABASE_URL=$U/prod_rehearsal_undo npx drizzle-kit migrate > /dev/null 2>&1
python3 - "$ROOT/docs/migrations/sales-tools-rollout.md" "$WORK" <<'PY'
import re,sys
s=open(sys.argv[1]).read(); s=s[s.index('## 5. Rollback'):s.index('## 6.')]
for i,b in enumerate(re.findall(r"```sql\n(.*?)```",s,re.S)): open(f'{sys.argv[2]}/undo{i+1:02d}.sql','w').write(b)
PY
for f in "$ROOT/docs/migrations/0114-undo.sql" "$ROOT/docs/migrations/0113-undo.sql" "$ROOT/docs/migrations/0112-undo.sql" "$ROOT/docs/migrations/0111-undo.sql"; do psql -d prod_rehearsal_undo -q --single-transaction -v ON_ERROR_STOP=1 -f "$f" 2>&1 | grep -iE "error" ; done
for f in "$WORK"/undo0*.sql; do psql -d prod_rehearsal_undo -q -v ON_ERROR_STOP=1 -f "$f" 2>&1 | grep -iE "error|line [0-9]+:"; done
echo "UNDO migrations: $(psql -d prod_rehearsal_undo -At -c 'select count(*) from drizzle.__drizzle_migrations') (0104 copy: $(psql -d prod_rehearsal_at0104 -At -c 'select count(*) from drizzle.__drizzle_migrations'))"
python3 "$ROOT/scripts/compare-schemas.py" prod_rehearsal_at0104 prod_rehearsal_undo > "$WORK/undo-diff.txt"
echo "UNDO differences from the 0104 state: $(wc -l < "$WORK/undo-diff.txt" | tr -d ' ')"; cat "$WORK/undo-diff.txt"
