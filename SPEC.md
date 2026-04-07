# Reeco — Product Specification

> A modern recovery support app that helps people in recovery stay accountable, connected, and supported by trusted loved ones.

---

## 1. Objective

Reeco is a dual-sided mobile app for people in addiction recovery and their support network. It creates a structured, privacy-first space where:

- **People in recovery** track their journey, log daily check-ins, and choose what to share.
- **Supporters** (family, loved ones) show up in healthy, intentional ways — without supervising.
- **Sponsors** (verified professionals) host sessions and provide guided support.

**Core design principle:** Supporters can support, not supervise. The person in recovery always owns their data and controls what is visible.

**Target users:**
- Adults in recovery from substance addiction (primary user)
- Family members or close friends who want to be present (supporters)
- Licensed therapists, counselors, or trained peer sponsors (sponsors)

---

## 2. Roles and Permissions

Roles are **permissions on a shared system**, not separate apps.

| Capability | Recovery User | Supporter | Sponsor |
|---|---|---|---|
| Daily check-in | ✅ | — | — |
| Journal entries | ✅ | — | — |
| Sobriety counter | ✅ | — | — |
| Emergency support button | ✅ | — | — |
| View their own shared updates | ✅ | ✅ (if permitted) | ✅ |
| Send encouragement | — | ✅ | ✅ |
| Invite supporters | ✅ | — | — |
| Approve/remove supporters | ✅ | — | — |
| Host sessions | — | — | ✅ |
| Chat | ✅ | ✅ | ✅ |
| View resources | ✅ | ✅ | ✅ |
| Verified badge | — | — | ✅ (after verification) |

---

## 3. MVP Feature Scope

### Phase 1 — Core (Build First)

**Onboarding**
- Create account (email/password via Supabase Auth)
- Select account type: Person in Recovery / Supporter / Sponsor
- Role-specific welcome flow
- Sponsor accounts enter verification queue (not active until verified)

**Recovery User Dashboard**
- Daily check-in: three states — Sober, Struggling, Good Day
- Sobriety counter / streak tracker (days since date set at onboarding)
- Milestone badges (1 day, 7 days, 30 days, 90 days, 1 year)
- Journal entry (private text + optional mood tag)
- Emergency support button (triggers notification to linked supporters)
- Privacy controls: choose what is shared with each supporter

**Supporter Dashboard**
- View shared updates (check-ins, milestones) from their linked recovery user
- Send encouragement (short messages, reactions)
- Prompt cards: "Check in today", "Send a note"
- Resources: how to support without overwhelming

**Shared Features**
- 1:1 and group chat (Supabase Realtime)
- Push notifications (Expo Notifications)
- Recovery goals (user sets, supporters can see if permitted)

### Phase 2 — Next (Post-MVP)

- Sponsor session hosting (scheduled video/audio via third-party SDK)
- Sponsor verification flow (document upload + admin review)
- Support groups (many-to-many relationships)
- AI-powered reflection prompts
- Content moderation tooling
- Product analytics dashboard

---

## 4. Data Model

```
users
  id, email, display_name, avatar_url, role (recovery|supporter|sponsor), created_at

profiles
  user_id, sobriety_start_date, bio, is_verified (sponsors only), verification_status

relationships
  id, recovery_user_id, supporter_id, status (pending|active|removed), permissions (jsonb)

check_ins
  id, user_id, status (sober|struggling|good_day), note, created_at

journal_entries
  id, user_id, body, mood_tag, is_private, created_at

milestones
  id, user_id, type (1d|7d|30d|90d|1y|custom), achieved_at

messages
  id, conversation_id, sender_id, body, created_at

conversations
  id, type (direct|group), participant_ids[], created_at

notifications
  id, recipient_id, type, payload (jsonb), read_at, created_at
```

---

## 5. Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| Mobile frontend | React Native + Expo | Cross-platform iOS/Android, fast iteration |
| Backend API | Express.js (Node) | Lightweight REST API, full control over business logic |
| Database | Supabase (PostgreSQL) | Auth, Realtime, Row-Level Security, easy scaling |
| Realtime chat | Supabase Realtime | Built-in, no extra infra |
| Auth | Supabase Auth | Email/password + social login later |
| Push notifications | Expo Notifications | Native push on both platforms |
| Content moderation | TBD (Phase 2) | Consider Hive or OpenAI Moderation API |
| Analytics | TBD (Phase 2) | Consider PostHog or Mixpanel |
| Deployment (dev) | Expo Go | Fastest iteration loop |
| Deployment (QA) | Expo Development Build | Access to native modules |
| Deployment (beta) | TestFlight (iOS) | Internal testing |
| Deployment (prod) | App Store + Google Play | GA launch |

---

## 6. Design System

**Philosophy:** Hyper-modern. Calm, not clinical. Emotional but not cheesy.

**Color mode:** Follows system default (light/dark via `useColorScheme`). No manual toggle in MVP.

### Color Tokens

| Token | Light | Dark |
|---|---|---|
| `background` | `#F5F3F8` | `#16131E` |
| `surface` | `#FFFFFF` | `#1F1A2E` |
| `surface-raised` | `#EFECF5` | `#2A2440` |
| `text-primary` | `#1A1625` | `#F0EDF8` |
| `text-secondary` | `#6B6480` | `#9B93B4` |
| `accent` | `#7B5EA7` | `#9B8EC4` |
| `accent-gradient` | `#9B8EC4 → #7B5EA7` | `#B8ADDA → #9B8EC4` |
| `success` | `#5CAF8A` | `#6DC9A0` |
| `warning` | `#E8A44A` | `#F0B866` |
| `danger` | `#D95F5F` | `#F07070` |
| `border` | `#E2DCF0` | `#2E2845` |

### Typography

- **Font family:** Plus Jakarta Sans (weights: 400, 500, 600, 700)
- **Scale:** `xs` 12 / `sm` 14 / `base` 16 / `lg` 18 / `xl` 22 / `2xl` 28 / `3xl` 36
- **Line height:** 1.5× for body, 1.2× for headings
- **Style:** Lowercase-friendly. App name and CTAs use lowercase where appropriate.

### Shape Language

- **Border radius:** `sm` 8 / `md` 16 / `lg` 24 / `pill` 999
- **Cards:** `surface` background, `md` radius, subtle `border` stroke or soft shadow
- **Buttons:** Pill-shaped (`pill` radius) for primary actions
- **Avatar / counters:** Circular. The orbital dot motif from the logo used as accent decoration on milestone and streak screens.

### Motion

- Check-in selection: spring scale pop on the chosen state
- Milestone unlock: circular ripple expand from the badge center
- Encouragement sent: orbital dot animates briefly around the send button
- Screen transitions: fade + slight upward slide (not aggressive)

### Tone

Warm, supportive, non-judgmental. Copy never uses clinical language in UI. "How are you holding up today?" not "Submit daily status."

---

## 7. Project Structure

```
reeco/
├── apps/
│   └── mobile/          # Expo React Native app
│       ├── app/         # Expo Router screens
│       ├── components/  # Shared UI components
│       ├── hooks/       # Custom React hooks
│       ├── lib/         # Supabase client, API client
│       └── store/       # Global state (Zustand or Context)
├── server/              # Express.js backend
│   ├── routes/
│   ├── middleware/
│   ├── services/
│   └── index.ts
├── supabase/
│   ├── migrations/      # SQL schema migrations
│   └── seed.sql
├── SPEC.md
└── README.md
```

---

## 8. Code Style

- **Language:** TypeScript everywhere (mobile + server)
- **Linting:** ESLint + Prettier
- **Naming:** camelCase for variables/functions, PascalCase for components/types
- **API:** REST (versioned: `/api/v1/...`)
- **Error handling:** Structured error responses `{ error: { code, message } }`
- **Env vars:** `.env` files, never committed. Use `.env.example` for documentation.

---

## 9. Testing Strategy

- **Unit tests:** Vitest for utility functions and service logic
- **Integration tests:** Supertest for Express API endpoints
- **Component tests:** React Native Testing Library for critical UI flows
- **E2E (Phase 2):** Detox or Maestro for full user journeys

Minimum coverage targets for MVP:
- Auth flows: 100%
- Check-in logic: 100%
- Permission/privacy logic: 100%

---

## 10. Boundaries

### Always do
- Enforce Row-Level Security in Supabase for all user data
- Require the recovery user to approve any relationship before a supporter can see data
- Default all journal entries to private unless explicitly shared
- Send emergency button notifications immediately with no delay

### Ask first
- Anything that changes how supporter-visible data works
- New roles or permission levels
- Any feature that involves professional/clinical language or advice

### Never do
- Allow a supporter to see data the recovery user has not explicitly shared
- Allow a sponsor to access any data before verification is complete
- Store sensitive entries (journals, check-ins) in plaintext logs
- Push notifications that reveal journal content in the notification body

---

## 11. Decisions Log

| Question | Decision |
|---|---|
| Sponsor verification | Phase 2. Video submission → manual review first, AI-assisted review later. No code-blocking for MVP. |
| Emergency button | In-app only for MVP. SMS/call trigger to be tested in a later phase. |
| Multiple supporters | Yes. A recovery user can link with multiple supporters. No cap for now. |
| Supporter verification | None required. Supporters join via invite from the recovery user only. |
| Monetization | Free for all users. No paywall, no subscription tier in MVP. |

## 12. Open Questions

- [ ] Do supporters need their own wellness or check-in feature, or is their dashboard purely about the recovery user?
- [ ] Should supporters be able to see each other (e.g., a shared supporter view), or are all relationships private 1:recovery-to-supporter?

---

*Last updated: 2026-04-06*
