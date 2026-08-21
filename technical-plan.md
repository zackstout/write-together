# Write Together — Technical Plan

## Stack

| Layer | Tool | Notes |
|---|---|---|
| Framework | Next.js 15 (App Router) | Web + mobile-responsive |
| Language | TypeScript | Superset of JS; recommended for Next.js + Supabase type safety |
| Database | Supabase (PostgreSQL) | Auth, RLS, and DB in one |
| Hosting | Vercel | Native Next.js deployment |
| Styling | Tailwind CSS | Responsive by default |

---

## Database Schema

### `prompts`
Stores the hard-coded prompt list, seeded from a script.

| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| text | text | The writing prompt |
| max_response_chars | int | Character limit shown to users |
| created_at | timestamptz | |

### `periods`
One active period at a time. A period references a single prompt.

| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| prompt_id | uuid (FK → prompts) | |
| started_at | timestamptz | |
| ended_at | timestamptz, nullable | null = currently active |

Only one period may have `ended_at = null` at any time. This is enforced by the CLI end-period script and a DB partial unique index.

### `profiles`
Public user data, extends Supabase `auth.users`.

| Column | Type | Notes |
|---|---|---|
| id | uuid (PK, FK → auth.users) | |
| display_name | text | |
| created_at | timestamptz | |

### `responses`
A user's response to a period. Can be a draft or submitted.

| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| period_id | uuid (FK → periods) | |
| user_id | uuid (FK → profiles) | |
| content | text | |
| is_draft | boolean | true until submitted |
| is_public | boolean, default true | Controls public visibility |
| submitted_at | timestamptz, nullable | null if still a draft |
| created_at | timestamptz | |
| updated_at | timestamptz | |

Rules enforced via RLS:
- Only the owner can read/write a draft.
- Once submitted (`is_draft = false`), content is immutable.
- Public submitted responses are readable by anyone.

### `comments`
Text comments on submitted responses.

| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| response_id | uuid (FK → responses) | |
| user_id | uuid (FK → profiles) | |
| content | text | |
| created_at | timestamptz | |

Rules: Anyone can read comments on a public response. Only logged-in users can post comments.

### `invitations`
Tracks who has been invited.

| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| email | text (unique) | |
| invited_by | uuid (FK → profiles) | |
| created_at | timestamptz | |
| accepted_at | timestamptz, nullable | Set on first login |

---

## Authentication

Supabase magic link (passwordless).

**Invite flow:**
1. An existing user (or admin) calls a protected API route: `POST /api/invite` with `{ email }`.
2. The API inserts a row into `invitations` and calls `supabase.auth.admin.inviteUserByEmail(email)`.
3. Supabase sends the invite email with a magic link.
4. User clicks the link → account is created → `profiles` row is inserted via a Supabase database trigger.
5. `invitations.accepted_at` is updated on first login via the same trigger.

**Subsequent logins:**
- User visits the site → requests a magic link via email → clicks → logged in.

**Access control:**
- Un-invited emails cannot sign up. The invite flow is the only entry point.
- The `POST /api/invite` route is protected — only logged-in users can send invites for now.

---

## Prompts Data

Prompts are generated once (one-time LLM session) and stored as a static TypeScript array:

```
data/prompts.ts   ← array of { text, max_response_chars }
```

A seed script inserts them into the `prompts` table and creates the first active period:

```
scripts/seed-prompts.ts
```

Run once during initial setup: `npx tsx scripts/seed-prompts.ts`

---

## CLI Script: End Period

```
scripts/end-period.ts
```

Run locally: `npx tsx scripts/end-period.ts`

**What it does:**
1. Reads `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from local `.env`.
2. Finds the active period (`ended_at = null`).
3. Sets `ended_at = now()` on that period.
4. Finds the next unused prompt and inserts a new period row with `started_at = now()`.
5. Logs confirmation.

The script uses the service role key to bypass RLS. It never runs in the app itself.

---

## Application Routes

### Pages

| Route | Visibility | Description |
|---|---|---|
| `/` | Public | Current prompt + all public submitted responses for the current period |
| `/archive` | Public | All past periods grouped by prompt, each with their public responses |
| `/respond` | Auth required | Draft editor for the current period |
| `/my-writing` | Auth required | All of the logged-in user's responses across all periods (including current draft and private posts) |
| `/responses/[id]` | Public (if response is public) | Full response + comments |
| `/users/[id]` | Public | A user's public responses across all periods |
| `/login` | Public | Magic link request form |

**Nav visibility:** The navigation is only shown to logged-in users. Logged-out visitors can still access all public routes directly.

**Home page behavior:**
- Current prompt is always shown front and center.
- Logged-in user with a draft → "Continue Writing" card linking to `/respond`.
- Logged-in user who already submitted → their submitted response is highlighted.
- All other public submitted responses for the current period are shown below.

**Draft access:** The draft editor lives at `/respond`. It is also linked from `/my-writing`. The editor component is shared — it is not built twice.

### API Routes

| Route | Method | Auth | Description |
|---|---|---|---|
| `/api/responses` | POST | Required | Create or upsert a draft |
| `/api/responses/[id]` | PATCH | Required (owner) | Update draft content |
| `/api/responses/[id]/submit` | POST | Required (owner) | Submit draft (locks it) |
| `/api/comments` | POST | Required | Add a comment to a response |
| `/api/invite` | POST | Required | Send an invite email |

---

## File Structure

```
write-together/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                      # Current prompt + public responses
│   ├── archive/
│   │   └── page.tsx                  # Past periods grouped by prompt
│   ├── respond/
│   │   └── page.tsx                  # Draft editor
│   ├── my-writing/
│   │   └── page.tsx                  # Logged-in user's full response history
│   ├── responses/
│   │   └── [id]/
│   │       └── page.tsx              # Response detail + comments
│   ├── users/
│   │   └── [id]/
│   │       └── page.tsx              # Public profile — user's public responses
│   ├── login/
│   │   └── page.tsx                  # Magic link request
│   └── api/
│       ├── responses/
│       │   ├── route.ts
│       │   └── [id]/
│       │       ├── route.ts
│       │       └── submit/route.ts
│       ├── comments/
│       │   └── route.ts
│       └── invite/
│           └── route.ts
├── components/
│   ├── PromptCard.tsx
│   ├── ResponseEditor.tsx            # Draft editor with autosave
│   ├── ResponseList.tsx
│   └── CommentSection.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts                 # Browser client
│   │   └── server.ts                 # Server client (uses cookies)
│   └── types.ts                      # Shared TypeScript types
├── data/
│   └── prompts.ts                    # Hard-coded prompt list
├── scripts/
│   ├── seed-prompts.ts
│   └── end-period.ts
└── supabase/
    └── migrations/
        └── 001_initial.sql           # All table + RLS definitions
```

---

## Key Behaviors

### Draft autosave
The `ResponseEditor` component debounces content changes (e.g., 1 second delay) and calls `PATCH /api/responses/[id]` automatically. A "Saved" / "Saving..." indicator is shown.

### Submit locks the response
`POST /api/responses/[id]/submit` sets `is_draft = false` and `submitted_at = now()`. After this, the RLS policy denies any further `UPDATE` on that row, even from the owner.

### Public/private toggle
A checkbox on the editor (default: checked = public). Stored as `is_public`. Public responses are readable by anyone via RLS. Private responses are only readable by the owner.

### Row-Level Security summary
- **prompts**: readable by anyone, writable by service role only.
- **periods**: readable by anyone, writable by service role only.
- **responses (draft)**: readable and writable by owner only.
- **responses (submitted, public)**: readable by anyone; writable by nobody.
- **responses (submitted, private)**: readable by owner only; writable by nobody.
- **comments**: readable by anyone (on public responses); insertable by logged-in users; not editable after creation.
- **profiles**: readable by anyone; writable by owner only.

---

## Build Order

1. Supabase project setup — tables, RLS, auth config.
2. Next.js project scaffold — Tailwind, Supabase client helpers, types.
3. Prompt seed script + end-period CLI script.
4. Auth pages — login, magic link callback.
5. Home page — current prompt + public response list.
6. Draft editor page — create, autosave, submit, public toggle.
7. Response detail page — full response + comments.
8. Past periods page.
9. Invite flow — API route + UI trigger.
