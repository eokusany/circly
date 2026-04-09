# Manual Verification Checklist

Items that require a live Supabase instance, a physical device/simulator,
or otherwise cannot be exercised by the automated test suite. Work through
these before each release or checkpoint merge.

## Phase 2: Recovery User Core

### Task 7a — Server auth + /api/me
- [ ] Sign in on the mobile app, hit `GET /api/me` (debug button or curl
      with the access token), confirm it returns the signed-in user's
      id and email.

### Task 7b — Emergency support button
- [ ] With a recovery-user account that has at least one active
      relationship (status = 'active'), tap the "get support" tile,
      confirm the alert, and verify a row appears in
      `public.notifications` with `type = 'emergency'` and
      `payload->>'from_display_name'` set to the requester's name.
- [ ] Tap the tile on an account with no active supporters — confirm
      the "no supporters yet" alert shows and no rows are inserted.
- [ ] Confirm the tile enters a loading state ("sending...") while the
      request is in flight.

### Migrations
- [ ] Apply `supabase/migrations/005_self_delete_function.sql` in the
      Supabase SQL editor (fixes "deleted account can sign back in"
      bug — see tasks/todo.md Phase 2.5 note).
