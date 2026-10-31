# Stat card and billing type badge

**StatCard** (`apps/internal/components/ui/stat-card.tsx`): one figure with its label above it, in a small tinted card (`bg-muted/40`, border, `px-4 py-3`). Set two or more side by side in a grid (`grid grid-cols-2 gap-3`). Used for the time log dialog's project and client hours. `tone='negative'` turns a figure under zero red (an overdrawn prepaid balance). Hours keep the `1.5h` format (`formatHours`). (guard: review)

**BillingTypeBadge** (`apps/internal/components/billing/billing-type-badge.tsx`): a client's billing type as a badge, Prepaid (green) or Net 30 (amber), the billing type picker's colours from `CLIENT_BILLING_TYPE_SELECT_OPTIONS`, in the one badge family. Put it right after the client's name; never a "Billing" label row. Used in the invoices list and the time log dialog. (guard: review)

The time log dialog's top card names the client and project with their coloured entity icons and no text labels ("Heatonist [NET 30]", "Hot Ones Shopify Store"); the hours sit below in two StatCards. (guard: review)
