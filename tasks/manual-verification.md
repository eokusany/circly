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
- [ ] Apply `supabase/migrations/006_invite_codes.sql` in the Supabase
      SQL editor.

## Phase 3: Relationships and Supporter Flow

### Task 10 — Supporter dashboard + encouragements
- [ ] Sign in as a supporter linked to a recovery user; confirm the
      person's card shows streak, today's check-in emoji/label, and
      latest milestone label.
- [ ] Toggle check-ins off from the recovery side — the supporter
      card should now show "not yet today · not shared" for today.
- [ ] Tap "send encouragement", pick a preset, confirm a row appears
      in `public.notifications` with `type='encouragement'` and
      `payload->>'message'` set.
- [ ] Send a custom message — same check.
- [ ] Sign in as a supporter with no links; confirm the empty state
      shows and "enter invite code" routes to /(auth)/invite-code.

### Task 9 — Privacy controls
- [ ] As a recovery user, tap a supporter card in settings, toggle
      "can see check-ins" off.
- [ ] Sign in as that supporter and confirm their dashboard no longer
      shows the recovery user's check-ins (RLS enforced via
      can_see_check_ins SQL function).
- [ ] Toggle back on; verify check-ins re-appear on the supporter side.
- [ ] Tap "remove supporter", confirm; verify the supporter disappears
      from the recovery user's circle list and their relationship row
      has status='removed' in the DB.

### Task 8b — Mobile invite UI
- [ ] As a recovery user, open the settings gear on the dashboard,
      tap "generate invite code", confirm the 6-char code appears in
      a big accent card with "expires in 24 hours".
- [ ] Tap the share button and confirm the OS share sheet opens with
      the code in the message.
- [ ] Sign up a new supporter account; after role-select, confirm the
      invite-code screen appears (not the supporter dashboard).
- [ ] Enter the code from the first account, tap continue, confirm
      you land on the supporter dashboard.
- [ ] Return to the recovery account's settings — the new supporter
      should appear in "your circle".
- [ ] Error paths: expired code, already-used code, self-invite, and
      invalid (random) code all surface friendly messages.

### Task 8a — Invite codes
- [ ] After `POST /api/invites`, `select * from invite_codes` shows
      the generated row with the expected expires_at (~24h out).
- [ ] After `POST /api/invites/accept`, both a `relationships` row
      (status='active') and a `conversations` row (type='direct',
      participant_ids contains both user ids) exist, and the
      `invite_codes` row has `used_at` set.
