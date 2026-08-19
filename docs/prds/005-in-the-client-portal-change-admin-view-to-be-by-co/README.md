# Implementation Plan: Admin "View As" by Contact in Client Portal (Revised)

## Context

Two things change:

1. **Client Portal admin banner** — replace the client picker with a **contact picker** showing *all* non-deleted contacts. Promoted contacts (those with a `userId`) get a **"Portal" badge** in the list so admins can tell who has an account. When a contact is selected, the portal scopes to all `clientIds` linked to that contact via `contact_clients`.

2. **Internal Portal contacts table** — add an **eye-icon "Preview in Portal" button** on **every active-mode contact row** (not just promoted ones). Clicking opens the client portal pre-scoped to that contact in a new tab. This uses a new GET route on the client portal that sets the cookie then redirects.

---

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| New cookie key | `pts_view_as_contact` | Contacts map to *multiple* clients; the existing `pts_view_as_client` holds a single `clientId`. Separate cookies keep the logic clean and non-breaking. Old cookie stays but is ignored. |
| Cookie value | `contacts.id` (UUID) | Looked up at request time against `contact_clients` to derive `clientIds`. Identical pattern to current client cookie. |
| Contact list filtering | `deletedAt IS NULL` only | All non-deleted contacts are previewable. Promoted badge marks those with `userId IS NOT NULL`. |
| Scope when no linked clients | `clientIds: []` — empty portal | Safest fail-closed behavior; admin still sees the banner and can switch. |
| Badge in dropdown | Small inline `<Badge>` labeled `"Portal"` next to the contact name | Visually communicates promoted status without hiding the contact. |
| Preview button visibility | All active-mode rows (not just promoted) | Per revised requirement. Archived contacts are excluded (`mode === 'archive'`). |
| Cross-app navigation | New `GET /api/admin/preview-contact?contactId=<uuid>` on client portal | Admins navigate to the client portal URL. The route validates admin auth, sets the cookie, and redirects. No server-action bridging needed across apps. |
| `clientPortalUrl` threading | Passed as prop from server page → `ContactsManagementTable` → `ContactsTableSection` | `CLIENT_PORTAL_URL` already exists in `apps/internal/lib/env.server.ts`. Client components can't read server env directly, so prop-drilling from the page is the correct pattern. |
| Empty-state copy | "Select a contact above to preview the portal." | Updated from "Select a client above". |

---

## Architecture Overview

```
Internal Portal — contacts table
  ├─ contacts/page.tsx (server)
  │     reads serverEnv.CLIENT_PORTAL_URL → passes as prop
  │
  ├─ ContactsManagementTable (client)
  │     receives clientPortalUrl, forwards to section
  │
  └─ ContactsTableSection (client)
        Eye icon button on every active-mode row
        href = `${clientPortalUrl}/api/admin/preview-contact?contactId=<id>`
        window.open(…, '_blank')

Client Portal — GET /api/admin/preview-contact?contactId=<uuid>
  ├─ getCurrentUser() → no user → redirect /sign-in
  ├─ isAdmin check → redirect /unauthorized
  ├─ validate contact exists, deletedAt IS NULL
  ├─ set pts_view_as_contact cookie
  ├─ clear pts_view_as_client cookie
  └─ redirect('/')

Client Portal — lib/auth/view-as.ts resolvePortalScope()
  └─ isAdmin branch → resolveAdminScope()
        reads pts_view_as_contact cookie
        fetches availableContacts (all non-deleted contacts + name + isPromoted)
        if valid selection: join contact_clients → clientIds
        returns PortalScope { clientIds, scopedClients, availableContacts, viewingAsContactId }

Client Portal — ViewAsBanner
  ├─ Dropdown: availableContacts list
  ├─ Promoted contacts show inline "Portal" badge
  └─ onSelect → setViewAsContact(contactId) server action

Client Portal — _actions/set-view-as-contact.ts
  └─ admin check → validates contact → sets cookie → revalidatePath
```

---

## Files Changed

| File | Status | Role |
|---|---|---|
| `apps/client/lib/auth/view-as.ts` | Modified | Core scope resolution — primary change target |
| `apps/client/app/(portal)/_actions/set-view-as-contact.ts` | **Created** | Server action to set preview cookie from banner |
| `apps/client/app/api/admin/preview-contact/route.ts` | **Created** | GET route for cross-app deep-link from internal portal |
| `apps/client/components/layout/view-as-banner.tsx` | Modified | Admin banner UI — contact picker with promoted badge |
| `apps/client/app/(portal)/layout.tsx` | Modified | Pass new scope props to banner |
| `apps/internal/app/(dashboard)/contacts/_components/contacts-table-section.tsx` | Modified | Add Eye icon button on every active row |
| `apps/internal/app/(dashboard)/contacts/_components/contacts-management-table.tsx` | Modified | Wire preview handler + accept `clientPortalUrl` prop |
| `apps/internal/app/(dashboard)/contacts/page.tsx` | Modified | Pass `clientPortalUrl` from `serverEnv` |
| `apps/internal/app/(dashboard)/contacts/archive/page.tsx` | Modified | Same |
| `apps/client/app/(portal)/page.tsx` | Modified | Update empty-state copy |
| `apps/client/app/(portal)/hours/page.tsx` | Modified | Update empty-state copy |
| `apps/client/app/(portal)/invoices/page.tsx` | Modified | Update empty-state copy |

---

Plan ID: PLN-qg4sbq
Issue: #144
