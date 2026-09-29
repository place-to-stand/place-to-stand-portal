-- Custom SQL migration file, put your code below! ---- A share link is live exactly while an invoice is sent: sending turns it on
-- and reverting to draft turns it off. Drafts shared under the old separate
-- "Generate shareable link" toggle were public but not payable; take them
-- private. Tokens are kept, so sending the invoice revives any link already
-- handed out.
UPDATE "invoices"
SET "share_enabled" = false,
    "updated_at" = timezone('utc'::text, now())
WHERE "status" = 'DRAFT'
  AND "share_enabled" = true;
