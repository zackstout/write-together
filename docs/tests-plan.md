# Write Together — Tests Plan

## Tools

| Layer | Tool | Notes |
|---|---|---|
| Unit / component tests | [Vitest](https://vitest.dev) | Fast, TypeScript-native, works well with Next.js |
| Component rendering | [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/) | Tests components from a user's perspective |
| End-to-end tests | [Playwright](https://playwright.dev) | Full browser automation against a running dev server |
| RLS policy tests | Supabase SQL Editor | Run directly against a test database |

---

## 1. API Route Unit Tests

These are the highest-value tests. They protect data integrity independently of the UI. Each test should mock the Supabase client and assert the correct response status and body.

### `POST /api/responses`

| # | Test case | Expected result |
|---|---|---|
| 1 | Request with no session cookie | 401 `{ error: 'Unauthorized' }` |
| 2 | Valid request with no `responseId` (new draft) | 201 `{ id: '<uuid>' }` |
| 3 | Valid request with existing `responseId` (update draft) | 200 `{ id: '<uuid>' }` |
| 4 | Content length exceeds `max_response_chars` for the period | 400 `{ error: '...character limit...' }` |
| 5 | `responseId` belongs to a submitted response (`is_draft = false`) | 400 (RLS blocks the update) |
| 6 | `responseId` belongs to a different user | 400 (RLS blocks the update) |

### `POST /api/responses/[id]/submit`

| # | Test case | Expected result |
|---|---|---|
| 7 | Request with no session cookie | 401 |
| 8 | Valid request on an owned draft | 200 `{ id: '<uuid>' }` |
| 9 | Request on a response that is already submitted | 400 (RLS blocks second update) |
| 10 | Request on a response owned by a different user | 400 |

### `POST /api/comments`

| # | Test case | Expected result |
|---|---|---|
| 11 | Request with no session cookie | 401 |
| 12 | Valid request with content | 201 — body includes `profile.display_name` |
| 13 | Request with empty `content` | 400 `{ error: 'Content is required' }` |
| 14 | Request with whitespace-only `content` | 400 |
| 15 | `responseId` points to a draft or private response | 400 (RLS blocks insert) |

### `POST /api/invite`

| # | Test case | Expected result |
|---|---|---|
| 16 | Request with no session cookie | 401 |
| 17 | Valid request with a new email | 201 `{ ok: true }` |
| 18 | Email already exists in `invitations` table | 400 (unique constraint violation) |
| 19 | Missing or empty `email` field | 400 `{ error: 'Email is required' }` |

---

## 2. Component Tests

`ResponseEditor` contains the most complex client-side logic and is the most important component to test. Use React Testing Library to render it with mocked fetch calls.

### `ResponseEditor`

| # | Test case | How to verify |
|---|---|---|
| 20 | Submit button is disabled when content is empty | Button has `disabled` attribute on initial render |
| 21 | Submit button is disabled when content exceeds `maxChars` | Set content to `maxChars + 1` chars; assert button is disabled |
| 22 | Character counter shows correct remaining count | Render with `maxChars=2000`, type 100 chars → counter shows `1900 characters remaining` |
| 23 | Character counter text turns red when over limit | Type past limit → assert counter has red styling class |
| 24 | `POST /api/responses` is called after the debounce delay | Mock fetch; type in textarea; advance timers by 1s → assert fetch was called once |
| 25 | Autosave does not fire if content equals initial content | Render with `initialContent`; do not type → advance timers → assert fetch was NOT called |
| 26 | "Saved" indicator appears after a successful autosave | Mock fetch to resolve OK; trigger save → assert "Saved" text appears |
| 27 | "Save failed" indicator appears on a failed autosave | Mock fetch to reject; trigger save → assert "Save failed" text appears |
| 28 | `POST /api/responses/[id]/submit` is called on submit click | Mock fetch; click submit → assert correct URL was called |
| 29 | Public toggle defaults to checked | `initialIsPublic={true}` → checkbox is checked |
| 30 | Toggling public checkbox is included in the next autosave | Toggle checkbox; advance timers → assert `isPublic: false` in fetch body |

### `CommentSection`

| # | Test case | How to verify |
|---|---|---|
| 31 | Initial comments are rendered | Pass `initialComments` with 2 items → assert both appear in the list |
| 32 | Post button is disabled when textarea is empty | Assert button has `disabled` attribute on initial render |
| 33 | New comment appears in the list after a successful post | Mock fetch; type a comment; click post → assert comment text appears without a page reload |
| 34 | Error message appears when post fails | Mock fetch to return an error → assert error message is shown |
| 35 | Comment form is not shown when `isLoggedIn={false}` | Assert textarea is not rendered; assert "Sign in" link is shown instead |

---

## 3. End-to-End Tests (Playwright)

Run against a local dev server connected to a test Supabase project. Each flow tests the full path from UI to database and back.

### Full response flow

| # | Step | Expected result |
|---|---|---|
| 36 | Visit `/` as a logged-out user | Current prompt is visible; no nav bar shown |
| 37 | Click "Sign in to write a response" | Redirected to `/login` |
| 38 | Submit the login form | Confirmation message "Check your email" shown |
| 39 | Visit `/respond` while logged out | Redirected to `/login` |
| 40 | Visit `/respond` while logged in | Prompt text and editor textarea are visible |
| 41 | Type in the editor and wait 1 second | "Saved" indicator appears |
| 42 | Reload `/respond` | Previous draft content is pre-filled |
| 43 | Click "Submit response" | Redirected to `/responses/[id]`; response text is shown |
| 44 | Return to `/respond` after submitting | Redirected to `/responses/[id]` (no longer editable) |

### Archive

| # | Step | Expected result |
|---|---|---|
| 45 | Visit `/archive` as a logged-out visitor | Past periods and their public responses are listed |
| 46 | Click a response card | Navigated to `/responses/[id]`; full text and comments shown |
| 47 | Run `end-period.ts` script | Refreshing `/archive` shows the newly ended period |

### My Writing

| # | Step | Expected result |
|---|---|---|
| 48 | Visit `/my-writing` while logged out | Redirected to `/login` |
| 49 | Visit `/my-writing` with an active draft | Draft item shows "Continue writing" link |
| 50 | Visit `/my-writing` after period has ended with an unsubmitted draft | Item shows "Period ended — this draft was not submitted" (no link) |
| 51 | Visit `/my-writing` after submitting | Item shows "View response" link; no Draft badge |
| 52 | Private submitted response | Shows "Private" badge; "View response" link still works for the owner |

### Comments

| # | Step | Expected result |
|---|---|---|
| 53 | View a public response as a logged-out user | Comment list is visible; no comment form shown |
| 54 | View a public response as a logged-in user | Comment form is visible |
| 55 | Post a comment | Comment appears in the list immediately without a page reload |

### Access control

| # | Step | Expected result |
|---|---|---|
| 56 | Request a private response URL as a logged-out visitor | 404 page shown |
| 57 | Request a private response URL as a logged-in non-owner | 404 page shown |
| 58 | Request a draft response URL as a non-owner | 404 page shown |
| 59 | Request `/users/[id]` for a user with no public responses | Page renders with "No public responses yet" |

---

## 4. RLS Policy Tests

Run these SQL statements directly in the Supabase SQL Editor against a test database. Each query should be run as the relevant Postgres role to simulate the correct auth context.

### Setup

Create two test users (user A and user B) and a submitted response owned by user A, and a draft owned by user A.

### Policy assertions

| # | Test | Run as | Expected result |
|---|---|---|---|
| 60 | `UPDATE responses SET content = 'injected' WHERE is_draft = false` | User A (owner) | 0 rows updated — RLS blocks update on submitted response |
| 61 | `SELECT * FROM responses WHERE is_draft = true` | User B | 0 rows — draft is invisible to non-owner |
| 62 | `SELECT * FROM responses WHERE is_public = false AND is_draft = false` | `anon` role | 0 rows — private response invisible to logged-out users |
| 63 | `INSERT INTO comments (response_id, ...) WHERE response = <private response>` | User B (logged in) | Error — RLS blocks comment on a non-public response |
| 64 | `UPDATE profiles SET display_name = 'hacked' WHERE id = <user B id>` | User A | 0 rows — users cannot update other users' profiles |
| 65 | `INSERT INTO responses (...) WHERE user_id = <user B id>` | User A | Error — cannot insert a response on behalf of another user |
| 66 | `UPDATE periods SET ended_at = now()` | User A (anon key) | Error — periods are not writable via the anon key |
| 67 | `UPDATE prompts SET text = 'hacked'` | User A (anon key) | Error — prompts are not writable via the anon key |

---

## Priority Order

If starting from zero test coverage, implement in this order:

1. **API route tests** — most critical; protect data integrity regardless of UI
2. **RLS policy tests** — verify database-level immutability and privacy
3. **`ResponseEditor` component tests** — autosave and submit are the most complex client logic
4. **End-to-end: full response flow** (tests 36–44) — covers the primary user path
5. **End-to-end: access control** (tests 56–59) — covers privacy guarantees
6. **Remaining component and E2E tests** — fill in coverage as the app grows
