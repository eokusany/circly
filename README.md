# Circly

Circly helps people stay connected to support without feeling watched.

A mobile app for people who need support and the people who care about them. Check in on your own terms, journal privately, and let the people in your circle know you're okay. If you go quiet, they'll know to reach out.

## Try the beta

iOS only, invite via TestFlight: <https://testflight.apple.com/join/cbAbZtb6>

## Stack

- Expo (React Native) + TypeScript — mobile
- Express + TypeScript — server (deployed on Railway)
- Supabase — Postgres, auth, RLS, Realtime
- Sentry — crash reporting

## Setup

Requires Node.js 18+, Expo CLI, and a Supabase project.

Copy `.env.example` files in `apps/mobile/` and `server/`, then:

```bash
npm install
cd server && npm run dev
cd apps/mobile && npx expo start
```

## License

Private. All rights reserved.
