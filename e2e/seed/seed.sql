-- Made-up data for local development and the browser tests: a studio
-- ("Northwind Studio"), four clients, leads, projects, tasks, time, invoices,
-- plus rows the tests change in bulk. Loaded by `npm run test:e2e:seed`, which
-- creates the three sign-ins first. Never load it into a real database.
begin;
-- Staff: the three sign-ins seed.mjs created, at the staff company.
insert into companies (name, slug, is_staff) values ('Northwind Studio', 'northwind-studio', true);
insert into users (id, email, role, onboarding_completed_at)
 select au.id, au.email, v.role::user_role, now()
 from (values ('ada@example.com','ADMIN'),('grace@example.com','ADMIN'),('miles@example.com','SALES')) v(email, role)
 join auth.users au on au.email = v.email;
insert into user_role_terms (user_id, role, effective_from)
 select id, role, '2026-01-01' from users;
insert into contacts (name, email, user_id)
 select v.name, u.email, u.id
 from (values ('ada@example.com','Ada Lovelace'),('grace@example.com','Grace Hopper'),('miles@example.com','Miles Okafor')) v(email, name)
 join users u on u.email = v.email;
insert into memberships (contact_id, company_id, title)
 select c.id, s.id, v.title
 from (values ('ada@example.com','Co-founder, engineer'),('grace@example.com','Co-founder, engineer'),('miles@example.com','Sales')) v(email, title)
 join contacts c on c.email = v.email cross join companies s where s.is_staff;

update business_settings set legal_name='Northwind Studio LLC', website='https://northwind.example', address_line1='100 Example Street', city='Springfield', region='OR', postal_code='97477', country='US', phone='+1 555 0100', inbox_email='hello@northwind.example', sending_email='portal@northwind.example', booking_url='https://cal.example/northwind', confirmed_at=now();
insert into business_settings (legal_name,website,address_line1,city,region,postal_code,country,phone,inbox_email,sending_email,booking_url,confirmed_at)
 select 'Northwind Studio LLC','https://northwind.example','100 Example Street','Springfield','OR','97477','US','+1 555 0100','hello@northwind.example','portal@northwind.example','https://cal.example/northwind',now()
 where not exists (select 1 from business_settings);

do $$
declare
 ada uuid := (select id from users where email='ada@example.com');
 grace uuid := (select id from users where email='grace@example.com');
 miles uuid := (select id from users where email='miles@example.com');
 c record; p uuid; i int; inv uuid; li uuid;
begin
 -- clients
 for c in select * from (values
   ('Harbor & Pine Coffee','harbor-pine','https://harborpine.example','prepaid','2025-03-01'::date),
   ('Fieldnote Bikes','fieldnote-bikes','https://fieldnote.example','net_30','2024-09-01'),
   ('Lumen Dental Group','lumen-dental','https://lumendental.example','prepaid','2026-06-01'),
   ('Copperleaf Outfitters','copperleaf','https://copperleaf.example','net_30','2025-11-01')) v(name,slug,web,bt,start)
 loop
   insert into companies (name,slug,website,state,created_by) values (c.name,c.slug,c.web,'OR',ada) returning id into p;
   insert into client_billing_periods (company_id,starts_on,created_by) values (p,c.start,ada);
   insert into billing_terms (company_id,billing_type,effective_from,created_by) values (p,c.bt::client_billing_type,c.start,ada);
 end loop;

 -- client people
 insert into contacts (name,email,phone) values
  ('Rosa Delgado','rosa@harborpine.example','+1 555 0141'),('Theo Brandt','theo@harborpine.example',null),
  ('Nina Park','nina@fieldnote.example','+1 555 0172'),('Omar Haddad','omar@fieldnote.example',null),
  ('Dr. Claire Moss','claire@lumendental.example','+1 555 0190'),
  ('Ben Whitaker','ben@copperleaf.example',null),
  ('Priya Raman','priya@tallgrass.example',null),('Leo Marsh','leo@ironwoodlabs.example',null),
  ('Sam Ortiz','sam@bluefinmarine.example',null),('Jordan Lee','jordan@quarrybakery.example',null),
  ('Dana Kim','dana@meridianfit.example',null),('Marcus Hale','marcus@oakhollow.example',null),
  ('Rachel Stone','rachel@pinecrestvet.example',null),('Ivy Chen','ivy@sundial.example',null);
 insert into memberships (contact_id,company_id,title,is_primary,portal_access)
  select ct.id, co.id, v.title, v.prim, v.portal from (values
   ('rosa@harborpine.example','harbor-pine','Owner',true,true),('theo@harborpine.example','harbor-pine','Operations',false,false),
   ('nina@fieldnote.example','fieldnote-bikes','Head of E-commerce',true,true),('omar@fieldnote.example','fieldnote-bikes','Marketing',false,false),
   ('claire@lumendental.example','lumen-dental','Practice Owner',true,false),
   ('ben@copperleaf.example','copperleaf','Founder',true,true)) v(email,slug,title,prim,portal)
  join contacts ct on ct.email=v.email join companies co on co.slug=v.slug;

 -- lead companies
 insert into companies (name,website,created_by) values
  ('Tallgrass Realty','https://tallgrass.example',miles),('Ironwood Labs','https://ironwoodlabs.example',miles),
  ('Bluefin Marine','https://bluefinmarine.example',miles),('Quarry Bakery','https://quarrybakery.example',miles),
  ('Meridian Fitness','https://meridianfit.example',miles),('Oak Hollow Farms','https://oakhollow.example',miles),
  ('Pinecrest Vet','https://pinecrestvet.example',miles),('Sundial Studio','https://sundial.example',miles);
 insert into memberships (contact_id,company_id,title,is_primary)
  select ct.id, co.id, 'Owner', true from contacts ct join companies co on split_part(ct.email,'@',2)=substring(co.website from 9)
  where co.slug is null;

 insert into leads (status,source_type,source_detail,assignee_id,rank,company_id,contact_id,current_stage_entered_at,created_at)
  select v.st::lead_status, v.src, v.det, v.who, v.rk, co.id, ct.id, now()-(v.d||' days')::interval, now()-(v.d+5||' days')::interval
  from (values
   ('NEW_OPPORTUNITIES','WEBSITE','Contact form','priya@tallgrass.example',miles,'a0',1),
   ('NEW_OPPORTUNITIES','REFERRAL','From Rosa at Harbor & Pine','leo@ironwoodlabs.example',ada,'a1',2),
   ('ACTIVE_OPPORTUNITIES','WEBSITE','Opportunity audit','sam@bluefinmarine.example',miles,'a0',6),
   ('ACTIVE_OPPORTUNITIES','EVENT','Spring maker fair','jordan@quarrybakery.example',grace,'a1',9),
   ('PROPOSAL_SENT','REFERRAL','From Nina at Fieldnote','dana@meridianfit.example',ada,'a0',4),
   ('ON_ICE','WEBSITE','Contact form','marcus@oakhollow.example',miles,'a0',30),
   ('CLOSED_WON','REFERRAL','From Dr. Moss','rachel@pinecrestvet.example',ada,'a0',3),
   ('PROPOSAL_SENT','WEBSITE','Opportunity audit','ivy@sundial.example',miles,'a1',8)) v(st,src,det,email,who,rk,d)
  join contacts ct on ct.email=v.email join memberships m on m.contact_id=ct.id join companies co on co.id=m.company_id;

 -- projects and tasks
 for c in select * from (values
   ('harbor-pine','Online store','online-store','ACTIVE'),
   ('harbor-pine','Wholesale portal','wholesale-portal','ONBOARDING'),
   ('fieldnote-bikes','Bike builder','bike-builder','ACTIVE'),
   ('lumen-dental','Patient booking','patient-booking','ACTIVE'),
   ('copperleaf','Inventory sync','inventory-sync','ON_HOLD')) v(slug,name,pslug,st)
 loop
   insert into projects (company_id,name,slug,status,type,created_by,owner_id,starts_on)
    select id,c.name,c.pslug,c.st::project_status,'CLIENT',ada,ada,'2026-09-01' from companies where slug=c.slug returning id into p;
 end loop;
 insert into projects (name,slug,status,type,created_by,owner_id) values ('Studio site refresh','studio-site-refresh','ACTIVE','INTERNAL',ada,ada);

 insert into tasks (id,project_id,title,status,rank,due_on,created_by,completed_at)
  select case when v.title = 'Gift card balance page' then 'e2e0e2e0-0000-4000-8000-000000000001'::uuid else gen_random_uuid() end, pr.id, v.title, v.st::task_status, v.rk, v.due::date, ada, case when v.st='DONE' then now()-interval '2 days' end
  from (values
   ('online-store','Subscription checkout for whole-bean plans','IN_PROGRESS','a0','2026-11-26'),
   ('online-store','Gift card balance page','ON_DECK','a0','2026-12-04'),
   ('online-store','Holiday bundle landing page','ON_DECK','a1','2026-12-01'),
   ('online-store','Fix tax on local pickup orders','BLOCKED','a0',null),
   ('online-store','Faster product image loading','DONE','a0',null),
   ('online-store','Roaster notes on product pages','DONE','a1',null),
   ('online-store','Wholesale price list import','ON_DECK','a2',null),
   ('online-store','Shipping rates for Alaska and Hawaii','IN_PROGRESS','a1','2026-11-24'),
   ('bike-builder','Frame size picker','IN_PROGRESS','a0','2026-11-28'),
   ('bike-builder','Live price as parts change','ON_DECK','a0',null),
   ('bike-builder','Save a build and share the link','ON_DECK','a1',null),
   ('bike-builder','Parts stock check','DONE','a0',null),
   ('patient-booking','Online booking form','IN_PROGRESS','a0','2026-12-02'),
   ('patient-booking','Text reminders the day before','ON_DECK','a0',null),
   ('patient-booking','Insurance details step','BLOCKED','a0',null),
   ('studio-site-refresh','New case study: Fieldnote Bikes','ON_DECK','a0',null)) v(pslug,title,st,rk,due)
  join projects pr on pr.slug=v.pslug;
 insert into task_assignees (task_id,user_id)
  select t.id, case when row_number() over (order by t.title) % 2 = 0 then ada else grace end from tasks t;

 -- time logs (last two months)
 insert into time_logs (project_id,user_id,hours,logged_on,note)
  select pr.id, case when g % 2 = 0 then ada else grace end, (1 + (g % 4))::numeric, (date '2026-11-19' - g), 'Build and review'
  from projects pr cross join generate_series(0,40,3) g where pr.type='CLIENT' and pr.status <> 'ON_HOLD';

 -- products, invoices, hour blocks
 insert into product_catalog_items (name,unit_price,unit_label,creates_hour_block_default) values ('Engineering hours',150,'hour',true);
 i := 140;
 for c in select co.id, co.name, bt.billing_type from companies co join billing_terms bt on bt.company_id=co.id loop
   i := i + 1;
   insert into invoices (invoice_number,status,company_id,created_by,issued_date,due_date,subtotal,total,billing_type,paid_at)
    values ('INV-0'||i, case when c.billing_type='prepaid' then 'PAID' else 'SENT' end::invoice_status, c.id, ada, '2026-11-03', '2026-12-03', 3000, 3000, c.billing_type,
     case when c.billing_type='prepaid' then now()-interval '10 days' end) returning id into inv;
   insert into invoice_line_items (invoice_id,description,quantity,unit_price,amount,creates_hour_block)
    values (inv,'Engineering hours',20,150,3000,c.billing_type='prepaid') returning id into li;
   if c.billing_type='prepaid' then
     insert into hour_blocks (hours_purchased,created_by,company_id,invoice_line_item_id,billing_month) values (20,ada,c.id,li,'2026-11-01');
   end if;
   i := i + 1;
   insert into invoices (invoice_number,status,company_id,created_by,issued_date,due_date,subtotal,total,billing_type,paid_at)
    values ('INV-0'||i,'PAID',c.id,ada,'2026-10-03','2026-11-02',2400,2400,c.billing_type,'2026-10-20') returning id into inv;
   insert into invoice_line_items (invoice_id,description,quantity,unit_price,amount) values (inv,'Engineering hours',16,150,2400);
 end loop;
end $$;

-- Rows the browser tests work on in bulk (e2e/tests/bulk-select-writes.spec.ts).
do $$
declare ada uuid := (select id from users where email = 'ada@example.com');
begin
 insert into companies (name, created_by)
  select 'Company ' || lpad(g::text, 3, '0'), ada from generate_series(1, 60) g;
 -- Company 010 is billed, so it refuses a bulk archive.
 update companies set slug = 'company-010', state = 'OR' where name = 'Company 010';
 insert into client_billing_periods (company_id, starts_on, created_by)
  select id, '2026-01-01', ada from companies where name = 'Company 010';
 insert into billing_terms (company_id, billing_type, effective_from, created_by)
  select id, 'net_30', '2026-01-01', ada from companies where name = 'Company 010';
 insert into projects (company_id, name, slug, status, type, created_by, owner_id)
  select id, 'Project 01', 'project-01', 'ACTIVE', 'CLIENT', ada, ada from companies where name = 'Company 010';
 insert into projects (name, slug, status, type, created_by, owner_id)
  values ('Internal tools', 'internal-tools', 'ACTIVE', 'INTERNAL', ada, ada);

 insert into contacts (name, email)
  select 'Person ' || lpad(g::text, 3, '0'), 'person' || g || '@example.com' from generate_series(1, 120) g;

 insert into form_submissions (kind, session_key, status, source_detail, started_at, last_activity_at, completed_at, contact_name, contact_email, message)
  select 'contact', 'e2e-' || g, 'completed', 'Contact form', now() - (g || ' hours')::interval, now() - (g || ' hours')::interval, now() - (g || ' hours')::interval,
   'Sender ' || lpad(g::text, 3, '0'), 'sender' || g || '@example.com', 'We need a new booking flow.'
  from generate_series(1, 5) g;

 -- Every lead on Ada's board; opening hour blocks for the prepaid clients.
 update leads set assignee_id = ada;
 insert into hour_blocks (hours_purchased, created_by, company_id, billing_month, notes)
  select 40, ada, id, m, 'Opening block' from companies,
   (values (date '2026-09-01'), (date '2026-10-01')) v(m)
  where slug in ('harbor-pine', 'lumen-dental');

 -- The task sheet's Planning panel needs a project with a linked repo.
 insert into github_app_installations (company_id, installed_by_user_id, installation_id, account_login, account_id, account_type, repository_selection)
  select id, ada, 1001, 'harbor-pine-example', 1001, 'Organization', 'selected' from companies where slug = 'harbor-pine';
 insert into github_repo_links (project_id, github_app_installation_id, repo_owner, repo_name, repo_full_name, repo_id, linked_by)
  select pr.id, gi.id, 'harbor-pine-example', 'store', 'harbor-pine-example/store', 1001, ada
  from projects pr cross join github_app_installations gi where pr.slug = 'online-store';

 -- One archived time log, so the time log archive has rows.
 insert into time_logs (project_id, user_id, hours, logged_on, note, deleted_at)
  select id, ada, 1, '2026-08-03', 'Archived entry', now() from projects where slug = 'online-store';
end $$;
-- More rows so every browser test has something to act on: two archived
-- records on each list, a draft invoice, busier boards, a client with a
-- closer, a former client, a Won lead that made a client, a client sign-in.
do $$
declare
 ada uuid := (select id from users where email = 'ada@example.com');
 grace uuid := (select id from users where email = 'grace@example.com');
 miles uuid := (select id from users where email = 'miles@example.com');
 harbor uuid := (select id from companies where slug = 'harbor-pine');
 term uuid; inv uuid;
begin
 insert into companies (name, created_by, deleted_at) values
  ('Driftwood Supply', ada, now()), ('Kestrel Print Co', ada, now());
 insert into contacts (name, email, deleted_at) values
  ('Hugo Alvarez', 'hugo@driftwood.example', now()), ('Mae Fischer', 'mae@kestrelprint.example', now());
 insert into projects (company_id, name, slug, status, type, created_by, owner_id, deleted_at) values
  (harbor, 'Loyalty card pilot', 'loyalty-card-pilot', 'COMPLETED', 'CLIENT', ada, ada, now()),
  (harbor, 'Spring pop-up site', 'spring-pop-up-site', 'COMPLETED', 'CLIENT', ada, ada, now());
 insert into time_logs (project_id, user_id, hours, logged_on, note, deleted_at)
  select id, grace, 2, '2026-08-04', 'Archived entry', now() from projects where slug = 'online-store';
 insert into hour_blocks (hours_purchased, created_by, company_id, billing_month, notes, deleted_at) values
  (10, ada, harbor, '2026-07-01', 'Archived block', now()),
  (5, ada, harbor, '2026-08-01', 'Archived block', now());
 insert into invoices (invoice_number, status, company_id, created_by, issued_date, due_date, subtotal, total, billing_type, deleted_at)
  values ('INV-0131', 'DRAFT', harbor, ada, '2026-08-01', '2026-08-31', 0, 0, 'prepaid', now()),
         ('INV-0132', 'DRAFT', harbor, ada, '2026-08-02', '2026-09-01', 0, 0, 'prepaid', now());
 insert into invoices (invoice_number, status, company_id, created_by, issued_date, due_date, subtotal, total, billing_type, notes)
  values ('INV-0149', 'DRAFT', (select id from companies where slug = 'fieldnote-bikes'), ada, '2026-11-18', '2026-12-18', 1500, 1500, 'net_30', 'Thanks for the work this month.')
  returning id into inv;
 insert into invoice_line_items (invoice_id, description, quantity, unit_price, amount) values (inv, 'Engineering hours', 10, 150, 1500);
 update form_submissions set deleted_at = now() where contact_name in ('Sender 004', 'Sender 005');

 -- Leads: a few more new ones, two archived.
 insert into contacts (name, email) values
  ('Ruth Okoye', 'ruth@larkspur.example'), ('Felix Grant', 'felix@tidewater.example'),
  ('Ana Silva', 'ana@northstar.example'), ('Ken Ito', 'ken@cobaltgym.example');
 insert into leads (status, source_type, source_detail, assignee_id, rank, contact_id, current_stage_entered_at, deleted_at)
  select 'NEW_OPPORTUNITIES', 'WEBSITE', 'Contact form', ada, v.rk, c.id, now(), v.del
  from (values ('ruth@larkspur.example', 'a2', null::timestamptz), ('felix@tidewater.example', 'a3', null),
               ('ana@northstar.example', 'a4', now()), ('ken@cobaltgym.example', 'a5', now())) v(email, rk, del)
  join contacts c on c.email = v.email;

 -- The Won lead made Pinecrest Vet a client.
 update leads set converted_at = now() - interval '3 days'
  where status = 'CLOSED_WON';
 insert into client_billing_periods (company_id, starts_on, created_by)
  select id, '2026-11-01', ada from companies where name = 'Pinecrest Vet';
 insert into billing_terms (company_id, billing_type, effective_from, created_by)
  select id, 'prepaid', '2026-11-01', ada from companies where name = 'Pinecrest Vet';

 -- Fieldnote Bikes: Miles found it, Grace closed it.
 insert into commission_terms (company_id, effective_from, origination_user_id, created_by)
  select id, '2024-09-01', miles, ada from companies where slug = 'fieldnote-bikes' returning id into term;
 insert into commission_term_closers (term_id, closer_user_id, share_percent) values (term, grace, 100);

 -- Bluefin Marine was a client for a while and stopped.
 insert into client_billing_periods (company_id, starts_on, ends_on, created_by)
  select id, '2025-01-01', '2025-12-01', ada from companies where name = 'Bluefin Marine';
 insert into billing_terms (company_id, billing_type, effective_from, created_by)
  select id, 'net_30', '2025-01-01', ada from companies where name = 'Bluefin Marine';

 -- Project 01's board: cards in more than one column.
 insert into tasks (project_id, title, status, rank, created_by)
  select pr.id, v.title, v.st::task_status, v.rk, ada
  from (values ('Order history export', 'ON_DECK', 'a0'), ('Reorder button', 'ON_DECK', 'a1'),
               ('Bulk price update', 'ON_DECK', 'a2'), ('Account page', 'IN_PROGRESS', 'a0'),
               ('Login by email link', 'IN_PROGRESS', 'a1')) v(title, st, rk)
  cross join projects pr where pr.slug = 'project-01';

 -- Rosa (prepaid) and Nina (Net 30) sign in to the client portal.
 insert into users (id, email, role, onboarding_completed_at)
  select id, email, 'CLIENT', now() from auth.users
  where email in ('rosa@harborpine.example', 'nina@fieldnote.example');
 insert into user_role_terms (user_id, role, effective_from)
  select id, 'CLIENT', '2026-01-01' from users where role = 'CLIENT';
 update contacts c set user_id = u.id from users u
  where u.role = 'CLIENT' and c.email = u.email;
end $$;

commit;
