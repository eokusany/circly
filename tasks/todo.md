# Reeco — Task List

## Phase 1: Foundation
- [ ] Task 1: Project scaffold and tooling (Expo + Express + TypeScript + lint)
- [ ] Task 2: Supabase schema and RLS migrations (all 8 tables + policies)
- [ ] Task 3: Auth — sign up, sign in, role selection, JWT custom claim

### Checkpoint: Foundation
- [ ] App boots, auth works in Expo Go, schema deployed, lint passing

---

## Phase 2: Recovery User Core
- [ ] Task 4: Recovery dashboard — sobriety streak and milestone badges
- [ ] Task 5: Daily check-in (3 states, one per day, history log)
- [ ] Task 6: Journal entry (private by default, mood tag)
- [ ] Task 7: Emergency support button (in-app push to all supporters)

### Checkpoint: Recovery User Core
- [ ] Full recovery user flow works, RLS verified, emergency button sends notifications

---

## Phase 3: Relationships and Supporter Flow
- [ ] Task 8: Invite and link supporters (email invite, accept flow, remove)
- [ ] Task 9: Privacy controls — per-supporter visibility toggles
- [ ] Task 10: Supporter dashboard — shared feed and encouragement

### Checkpoint: Relationships and Supporter Flow
- [ ] Full invite → feed flow works, privacy toggles enforce data gating, no leaks

---

## Phase 4: Chat and Notifications
- [ ] Task 11: 1:1 real-time chat (Supabase Realtime, per-relationship conversation)
- [ ] Task 12: Push notification setup + in-app notification center

### Checkpoint: Full MVP
- [ ] All role journeys work end-to-end, push on real device, ready for TestFlight
