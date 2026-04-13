# Circly

**Circly helps people stay connected to support without feeling watched.**

A mobile app for people who need support and the people who care about them. It creates a calm, structured space where someone can share how they're doing on their own terms — and where supporters can show up without overstepping. Recovery is one context. Family care is another. The connection layer is the same.

## Why

Recovery doesn't happen alone, but the tools available today either put too much pressure on the person recovering or leave supporters in the dark. Most apps treat recovery like a solo productivity problem — streak counters, habit trackers, journaling prompts — but ignore the human relationships that actually sustain long-term recovery.

Circly closes that gap. It gives people in recovery full control over what they share and when, while giving supporters meaningful, guided ways to be present.

**Core principle: supporters can support, not supervise.**

## V1 features

### For users
- **Daily check-ins** — log how you're holding up (sober, struggling, good day) with optional private notes
- **Sobriety streak tracking** — milestone badges at 1 day, 7 days, 30 days, 90 days, and 1 year
- **Private journaling** — biometric-locked entries that stay yours
- **"I'm okay" tap** — a zero-friction daily signal that lets your circle know you're alright
- **Emergency button** — instantly alert your supporters when you need help
- **Privacy controls** — you decide what each supporter can see

### For supporters
- **Shared updates** — see check-ins and milestones your person has chosen to share
- **Warm pings** — send a one-tap "I'm with you" signal without conversation pressure
- **Silence nudges** — get notified when someone in your circle goes quiet
- **Encouragement messages** — short notes of support, delivered gently
- **Emergency alerts** — immediate notification when someone needs you

### The Silent Support Engine
The feature that makes Circly different. It combines three systems:

1. **"I'm okay" loop** — the user taps once daily to generate a liveness signal
2. **Silent signal** — the server detects when someone stops checking in and nudges their supporters
3. **Warm ping** — supporters respond with a one-tap presence signal that says "I'm here"

Silence becomes the signal. No one has to ask for help — the app notices and connects people automatically.

## Roles

Two roles. That's it.

- **User** — person in recovery, tracking their journey and sharing with their circle
- **Supporter** — family member, friend, or loved one showing up for someone they care about

## Tech stack

| Layer | Technology |
|---|---|
| Mobile | React Native + Expo (TypeScript) |
| Backend | Express.js (TypeScript) |
| Database | Supabase (PostgreSQL + RLS + Realtime) |
| Auth | Supabase Auth (email/password) |
| Push notifications | Expo Notifications |
| State management | Zustand |
| Navigation | Expo Router |

## Project structure

```
circly/
├── apps/
│   └── mobile/          # Expo React Native app
│       ├── app/         # Expo Router screens
│       ├── components/  # Shared UI components
│       ├── hooks/       # Custom hooks
│       ├── lib/         # Supabase client, API client, copy system
│       ├── store/       # Zustand stores
│       └── constants/   # Theme, colors
├── server/              # Express.js API
│   ├── src/
│   │   ├── routes/      # API endpoints
│   │   ├── middleware/  # Auth, rate limiting
│   │   └── services/   # Silence detection, business logic
│   └── package.json
├── supabase/
│   └── migrations/      # SQL schema + RLS policies
├── SPEC.md              # Product specification
└── launchtodo.md        # Launch preparation checklist
```

## Setup

### Prerequisites
- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- Supabase project (local or hosted)
- iOS Simulator or Android Emulator (or Expo Go on a real device)

### Environment variables

Create `.env` files from the examples:

**Mobile** (`apps/mobile/.env`):
```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_API_URL=http://localhost:3000
```

**Server** (`server/.env`):
```
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
PORT=3000
```

### Running locally

```bash
# Install dependencies (from root)
npm install

# Start the server
cd server
npm run dev

# Start the mobile app (separate terminal)
cd apps/mobile
npx expo start
```

### Running tests

```bash
# Server tests (Vitest)
cd server && npx vitest run

# Mobile tests (Jest)
cd apps/mobile && npx jest
```

### Database

Apply migrations to your Supabase project:

```bash
# Using Supabase CLI
supabase db push

# Or apply manually via SQL editor using files in supabase/migrations/
```

## License

Private. All rights reserved.
