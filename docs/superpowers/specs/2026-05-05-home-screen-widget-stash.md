# Home-Screen Widget — Stashed (Post-V1)

**Date:** 2026-05-05
**Status:** Stashed (post-v1, do not implement now)
**Scope:** Capture the home-screen widget idea so it isn't lost. Not for current implementation.

---

## 1. Why This Is Stashed

The widget idea is real and good. It is parked for after v1 launch because the cost (3-4 weeks of focused native work across iOS and Android plus ongoing maintenance tax) is incompatible with the v1 launch timeline. The complementary feature — notification action buttons — covers ~80% of the same "tap without opening" outcome for a fraction of the effort. See [2026-05-05-notification-checkin-actions-design.md](2026-05-05-notification-checkin-actions-design.md) for the v1 path.

This document exists so the idea survives in the spec log and can be picked up later.

## 2. The Idea

A persistent home-screen widget the user pins to their home screen. Tapping the widget logs an "I'm okay" check-in (or one of the three mood values) without opening the app. The widget surface also shows the user's current streak and the time of their last check-in.

Visual aspiration: the **Duolingo widget** style — a single large widget tile with the brand mascot/icon, prominent live data, and a clear tappable region. The tile feels like part of the user's home screen rather than a window into another app.

## 3. Why It Matters

For a daily-ritual app, presence on the home screen reinforces the ritual without requiring a notification at all. The widget is ambient: the user sees their streak every time they unlock their phone, and the action to keep the streak going is one tap away. This is closer to how habit-forming apps build long-term retention than push notifications alone.

## 4. Scope When Revisited

- iOS first (iOS 17+ for full interactivity via App Intents; pre-17 falls back to a deep-link tap)
- Android second (full interactivity is available across versions via PendingIntent)
- Mood selection in the widget: still TBD when picked up. The lightest version is a single "I'm okay" tap; a richer version mirrors the three mood buttons from the notification action design.
- Recovery role only (substance and life contexts both)

## 5. Cost Estimate

- ~3-4 weeks of focused work for both platforms with interactive actions
- Permanent maintenance burden — auth, API, and check-in data model changes have to be replicated in two native code locations
- Build pipeline change required: development can no longer happen in Expo Go. Dev builds and EAS Build profile updates needed.
- Most likely shipped iOS-first as a focused 1.5-2 week project, then Android added later

## 6. Decision Trigger

Revisit this spec when **any** of the following are true post-launch:
- User feedback explicitly asks for a widget more than a handful of times
- Notification permission grant rate is below ~50% (widgets bypass that channel entirely)
- Daily check-in retention plateaus and home-screen presence is a plausible lever
- A native developer joins the team and the maintenance tax shrinks

Until then, the notification-action work covers the same job at a fraction of the cost.
