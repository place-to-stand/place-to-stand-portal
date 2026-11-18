-- Every install starts with Place To Stand's details, so a new install shows
-- who built it until an admin fills in the Business page. confirmed_at stays
-- empty, which keeps the "Set up your business" banner up until then.
-- Street address and phone are left for the admin to fill in. Replies to the
-- portal's emails go to the inbox email from here on.
INSERT INTO "business_settings" (
  "id", "legal_name", "website", "city", "region", "country",
  "inbox_email", "booking_url", "time_zone"
) VALUES (
  true,
  'Place To Stand Agency LLC',
  'https://placetostandagency.com',
  'Austin',
  'TX',
  'US',
  'hello@placetostandagency.com',
  'https://placetostandagency.com/contact',
  'America/Chicago'
) ON CONFLICT ("id") DO NOTHING;
