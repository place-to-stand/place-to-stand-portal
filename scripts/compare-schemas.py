#!/usr/bin/env python3
"""compare-schemas.py <db_a> <db_b>: schema (columns, constraints, indexes) and
per-table data differences between two LOCAL databases (PG* env vars set by
scripts/rehearse-rollout.sh). Prints nothing when they match."""
import subprocess,sys,os
if os.environ.get('PGHOST','') not in ('127.0.0.1','localhost'):
    sys.exit('compare-schemas.py: set PGHOST to a local database (127.0.0.1)')
a,b=sys.argv[1],sys.argv[2]
def q(db,sql): return subprocess.run(['psql','-d',db,'-At','-F','\t','-c',sql],capture_output=True,text=True).stdout.strip().split('\n')
def cols(db):
    out={}
    for line in q(db,"select table_name, column_name, data_type, is_nullable, coalesce(column_default,'-') from information_schema.columns where table_schema='public' and table_name in (select tablename from pg_tables where schemaname='public')"):
        if not line: continue
        t,c,dt,n,d=(line.split('\t')+['-'])[:5]; out.setdefault(t,{})[c]=(dt,n,d)
    return out
ca,cb=cols(a),cols(b)
for t in sorted(set(ca)|set(cb)):
    if t not in ca or t not in cb: print('TABLE only in', a if t in ca else b, t); continue
    for c in sorted(set(ca[t])|set(cb[t])):
        if ca[t].get(c)!=cb[t].get(c): print('COLUMN',t,c,ca[t].get(c),'|',cb[t].get(c))
def cons(db): return set(q(db,"select conrelid::regclass||' '||conname||' '||pg_get_constraintdef(oid) from pg_constraint where connamespace='public'::regnamespace"))
def idx(db): return set(q(db,"select indexdef from pg_indexes where schemaname='public'"))
for name,fn in (('CONSTRAINT',cons),('INDEX',idx)):
    x,y=fn(a),fn(b)
    for v in sorted(x-y): print(name,'only in',a,v[:160])
    for v in sorted(y-x): print(name,'only in',b,v[:160])
for t in sorted(set(ca)&set(cb)):
    common=sorted(set(ca[t])&set(cb[t]))
    sel=','.join('"%s"'%c for c in common)
    ra=q(a,f'select count(*)||\' \'||md5(coalesce(string_agg(r::text,\'|\' order by r::text),\'\')) from (select {sel} from "{t}") r')
    rb=q(b,f'select count(*)||\' \'||md5(coalesce(string_agg(r::text,\'|\' order by r::text),\'\')) from (select {sel} from "{t}") r')
    if ra!=rb: print('DATA',t,ra,rb)
