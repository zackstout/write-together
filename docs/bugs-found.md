# Write Together — Bugs Found

Bugs identified during initial code review. Each entry notes the file, the problem, and its status.

---

## Fixed

### BUG-001 — Autosave race condition in ResponseEditor

**File:** `components/ResponseEditor.tsx`
**Severity:** High

`currentResponseId` was included in the `useCallback` dependency array for the `save` function. After the first save creates a new response and sets the ID via `setCurrentResponseId`, React recreates the `save` function. This causes the `useEffect` (which lists `save` as a dependency) to re-run and schedule another autosave immediately — even though nothing changed. On fast typing sessions this could fire multiple redundant saves.

**Fix:** Replaced the `currentResponseId` state variable with a `responseIdRef` (a `useRef`). The ref always holds the latest value without being a reactive dependency, so `save` is only created once per `periodId` and the effect does not re-trigger when the ID is first assigned.

---

### BUG-002 — "Continue writing" link always points to the current period

**File:** `app/my-writing/page.tsx`
**Severity:** High

The My Writing page showed a "Continue writing" link for every draft response, always pointing to `/respond`. However, `/respond` only loads the draft for the *currently active* period. If a user had an unsubmitted draft from a past period (because the period ended before they submitted), clicking "Continue writing" would open the editor for the new current period — not their old draft. The old draft would appear lost.

**Fix:** The page now fetches the active period ID. For each draft response it checks whether `period_id` matches the active period:
- If it does → show "Continue writing" linking to `/respond`.
- If it does not → show "Period ended — this draft was not submitted" with no link, since past drafts cannot be edited.

---

### BUG-003 — Character limit enforced only on the client

**File:** `app/api/responses/route.ts`
**Severity:** Medium

The `ResponseEditor` component disables the submit button and shows a warning when content exceeds `max_response_chars`, but the API route accepted any content length. A request made outside the browser (e.g., via `curl`) could save or submit a response of unlimited length, bypassing the limit entirely.

**Fix:** The API route now fetches the `max_response_chars` value from the period's prompt before writing to the database. If the content exceeds the limit it returns a `400` with a descriptive error message. The client-side check remains as an immediate UX signal; the server-side check is the authoritative enforcement.

---

## Not Fixed — Low Priority

The following issues were identified but not addressed. They are recorded here for future reference.

---

### BUG-004 — Silently ignored database errors on `.single()` calls

**Files:** `app/respond/page.tsx`, `app/page.tsx`
**Severity:** Low

Several server components call `.single()` on Supabase queries without checking the returned `error`. If the database returns an unexpected error (not "no rows found"), `data` will be `null` and the error is silently swallowed. The page renders as if no data exists rather than showing an error state.

**Why not fixed:** For a small private app with a reliable Supabase connection, silent nulls are unlikely to cause user-visible problems. The correct long-term fix is to check `error` after each `.single()` call and either throw or render an error UI.

---

### BUG-005 — No server-side email format validation on invite

**File:** `app/api/invite/route.ts`
**Severity:** Low

The invite route checks that `email` is not empty, but does not validate that it is a properly formatted email address. An invalid email string would be inserted into `invitations` and passed to `supabase.auth.admin.inviteUserByEmail()`, which would return a Supabase-level error that propagates back as a 400.

**Why not fixed:** Supabase's own validation catches the malformed email before any damage is done. For a small invite-only app with a trusted user base, adding a regex check is not urgent. A simple fix when needed: use a basic regex or the `zod` library to validate the email shape before the DB insert.

---

### BUG-006 — Type system does not reflect nested Supabase relations

**Files:** `app/responses/[id]/page.tsx`, `app/users/[id]/page.tsx`, others
**Severity:** Low

The `Response` type in `lib/types.ts` declares `period?: Period`, but when Supabase returns a response with `period:periods(*, prompt:prompts(*))`, the nested `prompt` is not represented in the `Period` type. Several pages work around this with ad-hoc type assertions like `(r.period as { prompt?: { text: string } })?.prompt`, which are fragile and will not catch type errors at compile time.

**Why not fixed:** This is a type safety gap, not a runtime bug — the data is correct. The proper fix is to generate Supabase types using the Supabase CLI (`supabase gen types typescript`) which produces exact types for every table and relation. This is worth doing once the schema stabilises.

---

### BUG-007 — No UX feedback if a period ends while the user is editing

**File:** `components/ResponseEditor.tsx`
**Severity:** Low

If the `end-period.ts` script is run while a user has the editor open, the period ends silently. The user can continue typing and autosaving (the draft is stored in the database), but when they click submit, the submit call will still succeed because the draft is linked to the now-ended period. The user will land on the response detail page normally.

The only real problem is if the user refreshes `/respond` after the period ends — the page will show "There is no active prompt right now" and their draft will appear inaccessible (though it is visible on `/my-writing` as "Period ended — this draft was not submitted").

**Why not fixed:** For a small app where period transitions are manual and infrequent, this edge case is unlikely to affect real users. A proper fix would require a polling mechanism or a Supabase Realtime subscription on the `periods` table to detect period changes and notify the editor.

---

### BUG-008 — No rate limiting on API endpoints

**Files:** `app/api/responses/route.ts`, `app/api/comments/route.ts`, `app/api/invite/route.ts`
**Severity:** Low

All API routes are open to repeated requests from any authenticated user. A logged-in user could spam comments or invite requests in a tight loop.

**Why not fixed:** The app is invite-only and the user base is a small group of friends. Rate limiting adds meaningful complexity (requires a Redis store or Vercel's edge rate limiting middleware). Not worth the overhead at this stage.
