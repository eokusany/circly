# Circly — Launch Checklist

> V1 features are built. This tracks everything needed to go from working code to a real release.

---

## Product clarity

- [x] Lock roles to user + supporter (no sponsor in v1)
- [x] Simplify role labels across all screens and copy
- [x] Define one-sentence value prop: "Circly helps people stay connected to support without feeling watched."
- [x] Rename all Reeco references to Circly
- [x] Clean up README with setup instructions and architecture
- [ ] Review all user-facing copy for consistency (screens, alerts, notifications, empty states)

## Onboarding

- [x] Build 4-screen onboarding flow (welcome, privacy, support model, silence engine)
- [x] Add inline privacy explainer during onboarding ("your supporter can see X, never Y")
- [ ] Make role selection feel clear and intentional (not just a form)
- [ ] Test the full sign-up to home-screen path on both roles

## Trust and privacy

- [x] Add privacy policy screen accessible from profile > legal
- [ ] Review all supporter-visible data paths — confirm nothing leaks beyond permissions
- [ ] Add clear labels on check-in and journal screens about what is shared vs. private
- [ ] Ensure journal biometric lock works reliably on real devices

## Backend reliability

- [x] Wire up silence detection (runs on startup + hourly with retry handling)
- [ ] Test silence detection end-to-end: user goes quiet -> supporter gets nudge
- [ ] Verify no duplicate nudges are sent (48-hour dedup window)
- [ ] Test emergency alert delivery to all linked supporters
- [ ] Verify push notification delivery on real iOS and Android devices
- [ ] Confirm rate limiters work correctly under load
- [x] Add retry handling for silence detection (3 retries with 30s delay)

## Missing screens and states

- [x] Empty states for: circle, notifications, chat (all have EmptyState components)
- [x] Error states for: network failure on both home screens (ErrorState with retry)
- [x] Loading states for all data-fetching screens (SkeletonCard shimmer)
- [ ] Offline handling (graceful degradation, not crashes)
- [ ] Handle notification permission denied gracefully
- [ ] Handle expired/invalid auth session (redirect to sign-in)

## Real device testing

- [ ] Test on physical iPhone (latest iOS)
- [ ] Test on physical Android device
- [ ] Test slow network (3G simulation)
- [ ] Test app reopen after long inactivity
- [ ] Test keyboard overlap on all input screens
- [ ] Test long text in display name, notes, messages
- [ ] Test dark mode on all screens
- [ ] Test small screen (iPhone SE / small Android)

## Legal and safety

- [x] Write privacy policy (accessible from profile > legal)
- [x] Write terms of service (accessible from profile > legal)
- [x] Add disclaimer in TOS: "Circly is not a substitute for professional medical or emergency care"
- [ ] Verify account deletion flow works completely (data removal)
- [ ] Add support/contact email
- [ ] Review all safety-related copy (emergency button, alerts, crisis language)

## Production infrastructure

- [ ] Set up environment separation (dev / staging / production)
- [ ] Add crash reporting (Sentry or similar)
- [ ] Add basic analytics (onboarding completion, daily active, check-in rate)
- [ ] Add error logging for server
- [ ] Set up database backups
- [ ] Configure production Supabase project
- [ ] Set up production server hosting

## Store preparation

- [ ] Finalize app icon
- [ ] Create splash/launch screen
- [ ] Take 4-6 App Store screenshots (both roles)
- [ ] Write App Store description and subtitle
- [ ] Write Play Store description and feature graphic
- [ ] Select App Store keywords
- [ ] Fill out App Store privacy nutrition labels
- [ ] Set support URL and privacy policy URL in store listings
- [ ] Submit for TestFlight (iOS beta)
- [ ] Submit for Play Store internal testing (Android beta)

## Beta testing

- [ ] Recruit 5-10 trusted testers (mix of both roles)
- [ ] Include testers of different ages and tech comfort levels
- [ ] Create simple feedback form (what confused you, what felt broken, what felt good)
- [ ] Watch for confusion in: onboarding, pairing, privacy understanding, check-ins, alerts
- [ ] Fix critical issues found in beta
- [ ] Run a second beta round if needed

## Final pre-launch

- [ ] Full pass through all screens — does everything feel calm, intentional, trustworthy?
- [ ] Verify the complete user journey works end-to-end on a clean install
- [ ] Confirm silence detection runs reliably in production
- [ ] Confirm push notifications deliver on both platforms
- [ ] Review all error messages for tone (calm, not alarming)
- [ ] Check accessibility basics (font sizes, contrast, screen reader labels)
- [ ] Remove any debug logs, test data, or placeholder copy
- [ ] Tag a release version in git

---

*Last updated: 2026-04-13*
