# Native Chat System with Supabase Realtime

## Goal
Build a native real-time chat system to replace Google Chat for internal team communication. The system integrates with the existing unified inbox and leverages Supabase Realtime for WebSocket-based messaging, presence, and typing indicators.

## Scope Decisions

| Decision | Choice |
|----------|--------|
| **Access** | ADMIN users only (internal team) |
| **MVP Scope** | DMs + Group chats first (skip public channels) |
| **History** | Fresh start (no Google Chat migration) |

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Extend existing `threads`/`messages` tables** | Unified inbox shows chat + email together; `messageSource` already has `'CHAT'` |
| **New tables for chat-specific features** | Spaces, membership, reactions need dedicated structure |
| **Supabase Realtime (not polling)** | True WebSocket for presence, typing, instant messages |
| **Application-layer access control** | Follows existing pattern - no RLS |
| **ADMIN-only access** | Chat routes guard with `requireRole('ADMIN')` |

---

## Phase 1: Database Schema

### New Tables

**1. `chat_spaces`** - Chat rooms
```
id, type (DIRECT/GROUP), name, description, avatarUrl
clientId, projectId (optional scoping)
threadId (links to unified threads table)
isArchived, createdBy, timestamps

Note: CHANNEL type deferred for MVP - focus on DMs and group chats first
```

**2. `chat_space_members`** - Membership
```
id, spaceId, userId, role (OWNER/ADMIN/MEMBER)
lastReadAt, lastReadMessageId (unread tracking)
notificationsEnabled, joinedAt, leftAt
```

**3. `message_reactions`** - Emoji reactions
```
id, messageId, userId, emoji, createdAt
unique(messageId, userId, emoji)
```

**4. `chat_attachments`** - File attachments
```
id, messageId, storagePath, originalName, mimeType, fileSize
thumbnailPath, uploadedBy, timestamps
```

### Modifications to Existing `messages` Table
```sql
ALTER TABLE messages ADD COLUMN reply_to_message_id UUID;
ALTER TABLE messages ADD COLUMN is_edited BOOLEAN DEFAULT FALSE;
ALTER TABLE messages ADD COLUMN edited_at TIMESTAMPTZ;
```

### Migration File
`drizzle/migrations/XXXX_chat_system.sql`

---

## Phase 2: Supabase Realtime Architecture

### Channel Structure

| Channel | Purpose |
|---------|---------|
| `presence:team` | Online/offline status for ADMIN users only |
| `space:{spaceId}` | Postgres changes for messages in a space |
| `typing:{spaceId}` | Broadcast channel for typing indicators |
| `user:{userId}` | Personal notifications (DMs, mentions) |

### New Files

| File | Purpose |
|------|---------|
| `lib/realtime/realtime-provider.tsx` | Context for Realtime connection + presence |
| `lib/realtime/use-connection-status.ts` | Monitor connection state, handle reconnects |
| `components/providers/app-providers.tsx` | Add RealtimeProvider to hierarchy |

### RealtimeProvider Responsibilities
1. Initialize global presence channel on mount
2. Track user's online status (`online`, `away`, `busy`)
3. Expose `subscribeToSpace()` / `unsubscribeFromSpace()` for lazy loading
4. Handle visibility changes (tab focus) for presence updates

---

## Phase 3: Query Layer

### New Query Files

| File | Key Functions |
|------|---------------|
| `lib/queries/chat-spaces.ts` | `createChatSpace`, `listUserChatSpaces`, `getSpaceById`, `updateSpace`, `archiveSpace` |
| `lib/queries/chat-members.ts` | `addMember`, `removeMember`, `listSpaceMembers`, `updateLastRead` |
| `lib/queries/chat-messages.ts` | `createChatMessage`, `listMessagesForSpace`, `editMessage`, `deleteMessage` |
| `lib/queries/chat-reactions.ts` | `addReaction`, `removeReaction`, `listReactionsForMessage` |

### Access Control Pattern
```typescript
// 1. All chat routes require ADMIN role:
const user = await requireRole('ADMIN')

// 2. All chat queries enforce membership check:
async function ensureSpaceAccess(userId: string, spaceId: string): Promise<void> {
  const member = await db.query.chatSpaceMembers.findFirst({
    where: and(
      eq(chatSpaceMembers.spaceId, spaceId),
      eq(chatSpaceMembers.userId, userId),
      isNull(chatSpaceMembers.leftAt)
    )
  })
  if (!member) throw new ForbiddenError('Not a member of this space')
}
```

---

## Phase 4: API Routes

```
app/api/chat/
├── spaces/
│   ├── route.ts                    # GET list, POST create
│   └── [spaceId]/
│       ├── route.ts                # GET, PATCH, DELETE space
│       ├── members/route.ts        # GET, POST members
│       ├── messages/route.ts       # GET (paginated), POST new message
│       └── read/route.ts           # POST mark as read
├── messages/
│   └── [messageId]/
│       ├── route.ts                # PATCH edit, DELETE
│       └── reactions/route.ts      # POST add, DELETE remove
└── dm/route.ts                     # POST find-or-create DM
```

---

## Phase 5: React Hooks

| Hook | Purpose |
|------|---------|
| `lib/chat/use-chat-messages.ts` | Infinite query + real-time subscription for messages |
| `lib/chat/use-chat-space.ts` | Space subscription, typing indicator state |
| `lib/chat/use-unread-counts.ts` | Unread badge counts with real-time updates |
| `lib/chat/use-presence.ts` | Access global presence state |
| `lib/chat/use-typing.ts` | Debounced typing indicator emission |

### Example: useChatMessages
```typescript
// Uses TanStack Query for pagination
// Subscribes to postgres_changes for real-time inserts
// Optimistically updates cache on new message
```

---

## Phase 6: UI Components

### Component Structure
```
components/chat/
├── ChatProvider.tsx              # Context for active space, message state
├── ChatLayout.tsx                # Sidebar + panel layout
├── ChatSidebar.tsx               # Space list
│   ├── SpaceList.tsx
│   ├── SpaceItem.tsx
│   └── NewChatButton.tsx
├── ChatPanel.tsx                 # Main chat area
│   ├── ChatHeader.tsx
│   ├── MessageList.tsx           # Virtualized (TanStack Virtual)
│   │   └── ChatMessage.tsx
│   ├── TypingIndicator.tsx
│   └── ChatInput.tsx
├── PresenceIndicator.tsx         # Online dot
└── dialogs/
    ├── NewSpaceDialog.tsx
    └── SpaceMembersDialog.tsx
```

### Key UI Features
- **Virtualized message list** using `@tanstack/react-virtual` (already in project)
- **Message grouping** by sender for consecutive messages
- **Hover actions** for reply, react, edit, delete
- **Typing indicator** shows "X is typing..." with debounced updates
- **Presence dots** on avatars (green/yellow/gray)

---

## Phase 7: Storage

### New Bucket: `chat-attachments`

| File | Purpose |
|------|---------|
| `lib/storage/chat-attachments.ts` | Upload, delete, generate signed URLs |

**Limits:**
- Max file size: 25MB
- Allowed types: images, documents, videos (configurable)

---

## Phase 8: Inbox Integration

### Modifications to `/my/inbox`

1. **Add source filter** in `inbox-panel.tsx`:
   ```typescript
   <SelectItem value='chat'>Chat Only</SelectItem>
   ```

2. **Thread row icon** - Show chat bubble vs mail icon based on `source`

3. **Deep linking** - Chat threads open in chat UI or inline in inbox

### Sidebar Navigation
Add chat entry point with unread badge:
```typescript
<NavItem href="/chat" icon={MessageSquare}>
  Chat
  <UnreadBadge count={unreadChatCount} />
</NavItem>
```

---

## Phase 9: Routes

| Route | Purpose |
|-------|---------|
| `/chat` | Chat home (redirects to most recent space) |
| `/chat/[spaceId]` | Specific space view |
| `/chat/new` | Create new space/DM |

---

## Implementation Order

### Week 1-2: Foundation
- [ ] Create migration for chat tables
- [ ] Add schema definitions to `lib/db/schema.ts`
- [ ] Add relations to `lib/db/relations.ts`
- [ ] Create `chat-attachments` storage bucket
- [ ] Implement basic query functions

### Week 3-4: Core Chat
- [ ] Build `RealtimeProvider` with presence
- [ ] Create API routes for spaces and messages
- [ ] Implement `useChatMessages` hook with real-time
- [ ] Build `ChatLayout`, `ChatSidebar`, `ChatPanel` components
- [ ] Create `ChatInput` with message sending

### Week 5: Real-time Features
- [ ] Implement typing indicators (broadcast channel)
- [ ] Build `TypingIndicator` component
- [ ] Add `PresenceIndicator` to avatars
- [ ] Implement unread tracking + `useUnreadCounts`

### Week 6: Polish
- [ ] Add message reactions UI
- [ ] Implement file attachments
- [ ] Add to sidebar navigation
- [ ] Integrate with inbox filters
- [ ] Mobile responsive design

---

## Critical Files to Modify

| File | Changes |
|------|---------|
| `lib/db/schema.ts` | Add chat tables |
| `lib/db/relations.ts` | Add chat relations |
| `components/providers/app-providers.tsx` | Add RealtimeProvider |
| `components/layout/sidebar.tsx` | Add chat nav item |
| `app/(dashboard)/my/inbox/_components/inbox-panel.tsx` | Add chat filter |

---

## Verification

### Testing Checklist

1. **Schema Migration**
   ```bash
   npm run db:generate -- --name chat_system
   npm run db:migrate
   # Verify tables in Supabase Studio
   ```

2. **Realtime Connection**
   - Open browser devtools Network tab
   - Filter by WS
   - Verify WebSocket connection to Supabase
   - Check presence sync in console

3. **Message Flow**
   - Send message in one browser tab
   - Verify instant appearance in another tab
   - Check database has correct `source: 'CHAT'`

4. **Typing Indicators**
   - Start typing in one tab
   - Verify "X is typing..." appears in other tab
   - Verify it disappears after stopping

5. **Presence**
   - Open in two browsers with different users
   - Verify online indicators update
   - Close one browser, verify goes offline

6. **Inbox Integration**
   - Create chat thread
   - Navigate to `/my/inbox?filter=chat`
   - Verify chat thread appears with chat icon
