-- Local dev only. Gives SQL-seeded rows in public.users a matching
-- auth.users record so auth-coupled flows work against the fixtures.
--
-- Without this, the Access toggle appears broken for seeded users: enabling
-- access clears the Supabase ban FIRST (fail-closed ordering), that admin
-- call 404s with user_not_found, and disabled_at is never cleared.
--
-- The empty-string defaults on the token columns are load-bearing: GoTrue
-- scans them into Go strings and returns 500 on NULL.
--
-- Run:
--   docker exec -i -e PGPASSWORD=postgres supabase_db_place-to-stand-portal \
--     psql -h 127.0.0.1 -U postgres -d postgres -v ON_ERROR_STOP=1 \
--     < apps/internal/scripts/backfill-fixture-auth-users.sql
--
-- Seeded accounts get the password 'dev-local-1'.
BEGIN;

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  banned_until, is_sso_user, is_anonymous
)
SELECT
  '00000000-0000-0000-0000-000000000000',
  u.id,
  'authenticated',
  'authenticated',
  u.email,
  extensions.crypt('dev-local-1', extensions.gen_salt('bf')),
  now(),
  u.created_at,
  u.updated_at,
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('email_verified', true, 'full_name', u.full_name),
  CASE WHEN u.disabled_at IS NOT NULL THEN now() + interval '87600 hours' END,
  false,
  false
FROM public.users u
LEFT JOIN auth.users a ON a.id = u.id
WHERE a.id IS NULL;

INSERT INTO auth.identities (
  provider_id, user_id, identity_data, provider, created_at, updated_at
)
SELECT
  u.id::text,
  u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true, 'phone_verified', false),
  'email',
  u.created_at,
  u.updated_at
FROM public.users u
LEFT JOIN auth.identities i ON i.user_id = u.id AND i.provider = 'email'
WHERE i.user_id IS NULL;

-- GoTrue cannot scan NULL into its string token fields.
UPDATE auth.users SET
  confirmation_token = coalesce(confirmation_token, ''),
  recovery_token = coalesce(recovery_token, ''),
  email_change_token_new = coalesce(email_change_token_new, ''),
  email_change = coalesce(email_change, ''),
  email_change_token_current = coalesce(email_change_token_current, ''),
  phone_change = coalesce(phone_change, ''),
  phone_change_token = coalesce(phone_change_token, ''),
  reauthentication_token = coalesce(reauthentication_token, '')
WHERE confirmation_token IS NULL OR recovery_token IS NULL
   OR email_change_token_new IS NULL OR email_change IS NULL
   OR email_change_token_current IS NULL OR phone_change IS NULL
   OR phone_change_token IS NULL OR reauthentication_token IS NULL;

COMMIT;
