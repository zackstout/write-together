# Write Together — Architectural Overview

A shared writing prompt app for a small, invite-only group of friends. Users respond to rotating writing prompts, read each other's submissions, and leave comments.

---

## Table of Contents

1. [Technology Stack](#technology-stack)
2. [Repository Layout](#repository-layout)
3. [Data Model](#data-model)
4. [Authentication and Access Control](#authentication-and-access-control)
5. [Supabase Client Architecture](#supabase-client-architecture)
6. [Middleware and Route Protection](#middleware-and-route-protection)
7. [Pages](#pages)
8. [Components](#components)
9. [API Routes](#api-routes)
10. [Scripts](#scripts)
11. [Data Flow: Key User Actions](#data-flow-key-user-actions)
12. [Row-Level Security Policy Summary](#row-level-security-policy-summary)
13. [What Is Not Yet Built](#what-is-not-yet-built)

---

## Technology Stack

| Layer | Tool | Version | Notes |
|---|---|---|---|
| Framework | Next.js | 15 | App Router, Server Components by default |
| Language | TypeScript | 5 | Strict mode; all files `.ts` / `.tsx` |
| Styling | Tailwind CSS | 4 | Utility-first; responsive by default |
| Database | Supabase (PostgreSQL) | — | Managed Postgres with built-in auth, RLS, and triggers |
| Auth | Supabase Auth | — | Magic link (passwordless); invite-only |
| Hosting | Vercel | — | Zero-config Next.js deployment |

---

## Repository Layout

```
write-together/
│
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root layout: loads user session, renders Nav if logged in
│   ├── page.tsx                  # Home — current prompt + public responses
│   ├── globals.css               # Tailwind base styles
│   │
│   ├── archive/
│   │   └── page.tsx              # All past periods grouped by prompt
│   │
│   ├── respond/
│   │   └── page.tsx              # Draft editor for the current period (auth required)
│   │
│   ├── my-writing/
│   │   └── page.tsx              # Logged-in user's full response history (auth required)
│   │
│   ├── responses/[id]/
│   │   └── page.tsx              # Single response with comments
│   │
│   ├── users/[id]/
│   │   └── page.tsx              # Public profile — a user's public responses
│   │
│   ├── login/
│   │   └── page.tsx              # Magic link request form
│   │
│   ├── auth/callback/
│   │   └── route.ts              # Supabase magic link callback handler
│   │
│   └── api/
│       ├── responses/
│       │   ├── route.ts          # POST — create or update a draft
│       │   └── [id]/submit/
│       │       └── route.ts      # POST — submit a draft (locks it permanently)
│       ├── comments/
│       │   └── route.ts          # POST — add a comment to a response
│       └── invite/
│           └── route.ts          # POST — send an invite email to a new user
│
├── components/
│   ├── Nav.tsx                   # Top navigation bar (client component)
│   ├── ResponseEditor.tsx        # Draft editor with autosave (client component)
│   └── CommentSection.tsx        # Comment list and post form (client component)
│
├── lib/
│   ├── types.ts                  # Shared TypeScript types for all domain objects
│   └── supabase/
│       ├── client.ts             # Browser Supabase client (used in client components)
│       ├── server.ts             # Server Supabase client (used in Server Components and API routes)
│       └── middleware.ts         # Session refresh logic + route protection
│
├── data/
│   └── prompts.ts                # Hard-coded array of writing prompts
│
├── scripts/
│   ├── seed-prompts.ts           # One-time script: inserts prompts and creates first period
│   └── end-period.ts             # CLI: ends the current period and starts the next
│
├── supabase/
│   └── migrations/
│       └── 001_initial.sql       # All table definitions, RLS policies, and triggers
│
├── docs/
│   ├── plan.md                   # Original product requirements
│   ├── technical-plan.md         # Technical decisions and setup instructions
│   └── architectural-overview.md # This file
│
├── middleware.ts                 # Next.js middleware entry point (calls lib/supabase/middleware.ts)
├── .env.local.example            # Template for required environment variables
└── tsconfig.json
```

---

## Data Model

Five tables live in the `public` schema in Supabase. All tables have Row-Level Security enabled.

### `prompts`

Stores the full list of writing prompts, seeded once from `data/prompts.ts`.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | Auto-generated |
| `text` | `text` | The prompt shown to users |
| `max_response_chars` | `int` | Character limit for responses (default 2000) |
| `created_at` | `timestamptz` | |

### `periods`

A period represents one active prompt. Exactly one period is active at a time (`ended_at IS NULL`). A partial unique index on the database enforces this constraint.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `prompt_id` | `uuid` FK → `prompts` | |
| `started_at` | `timestamptz` | Set on insert |
| `ended_at` | `timestamptz`, nullable | `NULL` = currently active |

When `ended_at` is set, the period is closed and its responses become the historical record.

### `profiles`

Public user data that extends Supabase's internal `auth.users` table. Created automatically by a database trigger when a new user signs in for the first time.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK, FK → `auth.users` | Cascade deletes |
| `display_name` | `text` | Defaults to the part of the email before `@` |
| `created_at` | `timestamptz` | |

### `responses`

A user's response to a period. A user can have at most one response per period (enforced by a unique constraint on `(period_id, user_id)`). A response starts as a draft and is locked when submitted.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `period_id` | `uuid` FK → `periods` | |
| `user_id` | `uuid` FK → `profiles` | |
| `content` | `text` | The body of the response |
| `is_draft` | `boolean` | `true` until submitted; defaults to `true` |
| `is_public` | `boolean` | Visible to logged-out visitors; defaults to `true` |
| `submitted_at` | `timestamptz`, nullable | Set when `is_draft` becomes `false` |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | Auto-updated by a trigger on every `UPDATE` |

Once `is_draft = false`, the RLS policy blocks any further `UPDATE` on that row — even from the owner. Immutability is enforced at the database level, not just the application level.

### `comments`

Text comments on a submitted response. Not editable after creation.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `response_id` | `uuid` FK → `responses` | Cascade deletes |
| `user_id` | `uuid` FK → `profiles` | |
| `content` | `text` | |
| `created_at` | `timestamptz` | |

### `invitations`

Tracks who has been invited and whether they have accepted. A trigger marks `accepted_at` automatically when the invited email signs in for the first time.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `email` | `text`, unique | |
| `invited_by` | `uuid` FK → `profiles` | |
| `created_at` | `timestamptz` | |
| `accepted_at` | `timestamptz`, nullable | `NULL` = not yet accepted |

### Database triggers

| Trigger | Table | Event | What it does |
|---|---|---|---|
| `on_auth_user_created` | `auth.users` | `INSERT` | Creates a row in `profiles` |
| `on_auth_user_created_accept_invitation` | `auth.users` | `INSERT` | Sets `invitations.accepted_at` for the matching email |
| `responses_updated_at` | `responses` | `UPDATE` | Sets `updated_at = now()` |

---

## Authentication and Access Control

### Magic link (passwordless)

Users do not set passwords. When a user wants to sign in, they enter their email on `/login`. Supabase sends them a one-time magic link. Clicking the link redirects to `/auth/callback`, which exchanges the link code for a session and redirects to `/`.

### Invite-only access

New users can only enter the app through an invitation. Any logged-in user can send an invite via `POST /api/invite`. This route:
1. Records the invitation in the `invitations` table.
2. Calls `supabase.auth.admin.inviteUserByEmail()` using the service role key (which triggers Supabase to send a magic link email to the invitee).

Uninvited emails cannot create accounts — the Supabase invite flow is the only entry point.

### Session management

Supabase sessions are stored in cookies. The Next.js middleware (`middleware.ts`) refreshes the session on every request so it does not expire while the user is actively using the app.

---

## Supabase Client Architecture

Three separate Supabase client instances are used depending on context:

| File | Used in | Key | Notes |
|---|---|---|---|
| `lib/supabase/client.ts` | Client components (`'use client'`) | Anon key | Created once per browser session via `createBrowserClient` |
| `lib/supabase/server.ts` | Server Components, API routes | Anon key | Created per request; reads/writes cookies for session |
| `scripts/*.ts` | Local CLI scripts only | Service role key | Bypasses RLS; never used in the app itself |
| `app/api/invite/route.ts` | Invite API route | Service role key | Needed to call `auth.admin.inviteUserByEmail` |

The service role key is never sent to the browser. It is used only in server-side code and local scripts.

---

## Middleware and Route Protection

`middleware.ts` runs on every request (except static assets). It calls `lib/supabase/middleware.ts`, which:

1. Refreshes the Supabase session from cookies.
2. Checks if the requested route is in the protected list (`/respond`, `/my-writing`).
3. Redirects unauthenticated requests to `/login`.

All other access control (e.g., private responses, draft visibility) is enforced at the database level by RLS policies, not by the middleware.

---

## Pages

All pages are React Server Components by default. Data fetching happens on the server; no client-side fetch on initial load.

### `/` — Home

Fetches the active period and its prompt. If the user is logged in, also fetches their response for the current period. Shows a "Start writing" or "Continue writing" CTA that links to `/respond`. Lists all public submitted responses for the current period.

### `/archive`

Fetches all ended periods with their prompts and all public submitted responses. Groups responses under their period. Useful for reading past work.

### `/respond` — Draft Editor

Auth-required. Fetches the active period and the user's existing draft (if any). If the user already submitted, redirects to `/responses/[id]`. Renders the `ResponseEditor` client component with the draft's current state.

### `/my-writing`

Auth-required. Fetches all of the logged-in user's responses across all periods — including drafts and private posts. Shows draft/private badges. Links drafts to `/respond` and submitted responses to `/responses/[id]`.

### `/responses/[id]` — Response Detail

Fetches a single response. Enforces visibility: private or draft responses return 404 to anyone who is not the owner. Renders the full response text, then the `CommentSection` client component.

### `/users/[id]` — Public Profile

Fetches a user's profile and all their public submitted responses. Visible to anyone, including logged-out visitors.

### `/login`

A client component form. Calls `supabase.auth.signInWithOtp()` with the user's email. On success, shows a confirmation message to check email.

---

## Components

All three components are client components (`'use client'`) because they manage interactive state.

### `Nav.tsx`

Rendered in `app/layout.tsx` only when a user session exists. Contains links to Current Prompt, My Draft, My Writing, and Archive. Includes a Sign Out button that calls `supabase.auth.signOut()` and redirects to `/`.

### `ResponseEditor.tsx`

The core interactive component. Accepts the current period ID, max character limit, initial content, initial public flag, and the existing response ID (if any) as props.

**Autosave:** A `useEffect` watches `content` and `isPublic`. When either changes, it waits 1 second (debounced) then calls `POST /api/responses`. A status indicator shows `Saving...` / `Saved` / `Save failed`.

**Submit:** The submit button calls `POST /api/responses/[id]/submit`. On success, the router navigates to the response detail page. The button is disabled if the character limit is exceeded or the content is empty.

**Character counter:** Shows characters remaining. Turns red and blocks submission when over the limit.

**Public toggle:** A checkbox (default checked). Controls the `is_public` field saved with the draft.

### `CommentSection.tsx`

Accepts the response ID, initial comments array, and a boolean for whether the user is logged in. Manages comment state locally — new comments are appended to the list after a successful `POST /api/comments` without a page reload.

---

## API Routes

All API routes validate the user session before acting. They return JSON.

### `POST /api/responses`

Creates a new draft or updates an existing one. Accepts `{ periodId, responseId, content, isPublic }`. If `responseId` is provided, issues an `UPDATE` (only allowed while `is_draft = true` via RLS). If not, issues an `INSERT`.

### `POST /api/responses/[id]/submit`

Sets `is_draft = false` and `submitted_at = now()` on the specified response. The RLS policy allows this `UPDATE` only while `is_draft = true`, so calling this endpoint twice has no effect after the first call succeeds.

### `POST /api/comments`

Inserts a new comment. Validates that `content` is not empty. Returns the inserted comment including the commenter's `profile.display_name` so the client can append it to the list immediately.

### `POST /api/invite`

Records the invitation in `invitations` then calls `supabase.auth.admin.inviteUserByEmail()` using a service client initialized with the service role key. The service role key is read from the environment variable and is never exposed to the browser.

---

## Scripts

Scripts run locally with `npx tsx <script>`. They load `.env.local` to get Supabase credentials and use the service role key to bypass RLS.

### `scripts/seed-prompts.ts`

Run once during initial setup. Inserts all prompts from `data/prompts.ts` into the `prompts` table. Then checks whether an active period exists. If not, creates the first period using the first prompt. Safe to inspect the source before running.

### `scripts/end-period.ts`

Run when you want to close the current writing period and open the next one. Steps:
1. Finds the active period (`ended_at IS NULL`).
2. Sets `ended_at = now()` on that period.
3. Queries all `prompt_id` values from `periods` to determine which prompts have already been used.
4. Picks the first unused prompt (by `created_at` order).
5. Inserts a new period with `started_at = now()`.

If all prompts have been used, it exits cleanly with a message rather than creating a new period.

---

## Data Flow: Key User Actions

### Submitting a response

```
User types in ResponseEditor
  → debounce (1s)
    → POST /api/responses  (upsert draft)
      → Supabase UPDATE responses SET content = ... WHERE is_draft = true
        → "Saved" indicator shown

User clicks "Submit response"
  → POST /api/responses/[id]/submit
    → Supabase UPDATE responses SET is_draft = false, submitted_at = now()
      → RLS: UPDATE allowed only while is_draft = true
        → router.push(/responses/[id])
```

### Posting a comment

```
User types in CommentSection and clicks "Post comment"
  → POST /api/comments { responseId, content }
    → Supabase INSERT into comments
      → Returns new comment row with profile.display_name
        → Appended to local state (no page reload)
```

### Sending an invite

```
Logged-in user triggers POST /api/invite { email }
  → INSERT into invitations
  → serviceClient.auth.admin.inviteUserByEmail(email)
    → Supabase sends magic link email to invitee

Invitee clicks email link
  → /auth/callback?code=...
    → supabase.auth.exchangeCodeForSession(code)
      → auth.users row created
        → Trigger: INSERT into profiles (display_name = email prefix)
        → Trigger: UPDATE invitations SET accepted_at = now()
          → redirect to /
```

---

## Row-Level Security Policy Summary

| Table | Who can SELECT | Who can INSERT | Who can UPDATE | Who can DELETE |
|---|---|---|---|---|
| `prompts` | Anyone | Service role only | Service role only | Service role only |
| `periods` | Anyone | Service role only | Service role only | Service role only |
| `profiles` | Anyone | Service role only (via trigger) | Owner only | — |
| `responses` (draft) | Owner only | Owner | Owner | — |
| `responses` (submitted, public) | Anyone | — | Nobody | — |
| `responses` (submitted, private) | Owner only | — | Nobody | — |
| `comments` | Anyone (on public responses) | Logged-in users | Nobody | — |
| `invitations` | Logged-in users | Logged-in users | Service role only (via trigger) | — |

---

## What Is Not Yet Built

These items are noted for future work but are not in the current codebase:

- **Invite UI** — A form in the app to call `POST /api/invite`. Currently the API route exists but there is no UI to trigger it from.
- **Auto-close periods** — The plan notes that periods should eventually close automatically when all users have submitted a response. Currently periods are closed manually via `scripts/end-period.ts`.
- **Display name editing** — Users cannot change their display name after the profile is auto-created on first login.
- **Comment editing or deletion** — Comments are permanent once posted.
- **Notifications** — No mechanism exists to alert users when a new period starts or when someone comments on their response.
