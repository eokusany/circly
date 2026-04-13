# Premium Journal — Feature Specification

> Transform the journal from a basic CRUD notes screen into a premium, private, emotionally intelligent writing space that feels like the most personal part of Circly.

---

## 1. Objective

The journal is the recovery user's most private space. It should feel sacred — locked, beautiful, and responsive. Every interaction should reinforce that this is *their* place, protected and purposeful.

**Target user:** Recovery users only. Supporters and sponsors never see journal content (enforced by existing RLS policies).

**Success criteria:**
- Journal feels noticeably different from the rest of the app — more intimate, more polished
- Users write more frequently (guided prompts lower the blank-page barrier)
- Mood tracking becomes a visual, engaging ritual rather than an afterthought
- The PIN lock creates a tangible feeling of privacy on every open

---

## 2. Features

### 2.1 PIN Lock & Biometric Unlock

**What:** A 4-digit PIN gate that appears every time the user navigates to the journal tab. Optional biometric (Face ID / Touch ID) as a faster alternative.

**Flow:**
1. First visit → "set up your journal pin" screen with a 4-digit input
2. Confirm PIN (enter twice)
3. Every subsequent visit → PIN entry screen with unlock animation
4. After 3 failed attempts → 30-second cooldown with a gentle message
5. Settings toggle to enable biometrics (shown only if device supports it)

**Storage:**
- PIN stored via `expo-secure-store` (encrypted on-device, never leaves the device)
- Biometric preference stored in `expo-secure-store` as a boolean flag
- No server-side PIN storage — this is a UX privacy layer, not encryption

**Unlock ritual animation:**
- Lock icon centered on screen
- On correct PIN: lock springs open (scale 1 → 1.2 → 0, opacity fade), screen content fades up from below
- Haptic: `notifySuccess()` on unlock
- Duration: ~400ms total

**Reset flow:**
- No "forgot PIN" — user must sign out and sign back in to reset (re-auth clears the secure store key)
- This keeps it simple and avoids a recovery flow that would weaken the privacy perception

**New dependencies:** `expo-secure-store`, `expo-local-authentication`

### 2.2 Guided Prompts

**What:** A rotating writing prompt shown at the top of the new entry screen. Tapping it pre-fills the prompt as a starting point. User can dismiss and free-write.

**Prompt pool (hardcoded, no AI):**
```
- "what's one thing you're proud of today?"
- "what felt hard today, and how did you get through it?"
- "write a letter to your future self."
- "what does your support system mean to you?"
- "describe a moment of peace from today."
- "what's something you're grateful for right now?"
- "what would you tell someone just starting their journey?"
- "what triggered you today, and what did you do instead?"
- "write about a person who believes in you."
- "what does recovery mean to you today?"
```

**Behavior:**
- One prompt shown per session, selected by day-of-year index (deterministic, not random — so re-opening the same day shows the same prompt)
- Displayed as a subtle card above the text input with a "use this prompt" tap target
- Tapping inserts the prompt text and places cursor after it
- "skip" link dismisses the card for this session
- Prompt used is saved on the entry as `prompt_used` (nullable text column) for future reflection features

**Schema change:**
```sql
ALTER TABLE journal_entries ADD COLUMN prompt_used text;
```

### 2.3 Fluid Mood Slider

**What:** Replace the 6 discrete mood pills with a continuous horizontal slider on a gradient spectrum.

**Spectrum (left to right):**
```
struggling ← anxious ← sad ← neutral ← calm ← hopeful ← grateful
```

**Visual:**
- Horizontal gradient bar: warm amber (left/negative) → sage green (right/positive)
- Draggable thumb with the current mood's Feather icon inside
- As thumb moves, the icon morphs between mood icons at threshold points
- Label below the slider shows the current mood word
- Haptic tick (`tapLight()`) at each mood boundary crossing

**Data model:**
- Store `mood_value` as an integer 0–100 alongside the existing `mood_tag`
- `mood_tag` is derived from the value at save time (0–14: struggling, 15–28: anxious, 29–42: sad, 43–57: neutral, 58–71: calm, 72–85: hopeful, 86–100: grateful)
- Backward compatible: existing entries without `mood_value` still render from `mood_tag`

**Schema change:**
```sql
ALTER TABLE journal_entries ADD COLUMN mood_value integer;
```

### 2.4 Streak & Consistency Calendar

**What:** A heatmap-style calendar grid showing the current month's writing consistency. Replaces the current mood dots as the primary visual at the top of the journal list.

**Visual:**
- 7-column grid (Mon–Sun), rows for weeks in the current month
- Each cell is a small rounded square:
  - No entry: `surfaceRaised` (faint)
  - Has entry: `accentSoft` fill with `accent` border
  - Today: ring border in `accent`
- Current streak count displayed prominently: "7 day streak" with a small flame/pen icon
- Tapping a day with an entry scrolls to that entry in the list below

**Data:** Derived client-side from the existing entries list (no new queries needed — just group by date).

### 2.5 Weekly Reflection Digest

**What:** An auto-generated summary card that appears at the top of the journal list every 7 days (if the user has 3+ entries that week).

**Content (computed client-side, no AI):**
- "this week you wrote {n} entries"
- Mood trend: "your mood shifted from {startMood} → {endMood}" (based on first and last mood-tagged entries of the week)
- Most used mood: "you felt {mood} most often"
- Prompt: "keep it up" / "every entry matters" (rotating encouragement)

**Visual:**
- A distinct card with a subtle gradient background (accentSoft → successSoft horizontal)
- Feather icon: `bar-chart-2`
- Dismissible (tap X to hide for this week)
- Only shows if the current week has ended (appears on Monday for the prior week)

**Storage:** Dismissal state is local-only (AsyncStorage key: `journal_digest_dismissed_{weekId}`).

### 2.6 Entry Animations & Micro-interactions

**Save animation:**
- On save: the text input gently scales down (1 → 0.98) while a checkmark fades in at center, then navigates back
- Haptic: `notifySuccess()`

**New entry card appearance:**
- When returning to the list after saving, the new entry card slides in from the top with a spring animation (like OkayTapCard's scale pop pattern)

**Delete confirmation:**
- Pressing delete: card shakes briefly (translateX spring: 0 → -4 → 4 → -2 → 0) before showing the alert
- Haptic: `notifyWarning()`

**Mood slider feedback:**
- Crossing a mood boundary triggers `tapLight()` and a brief scale pulse on the mood label

**FAB (floating action button):**
- Entrance: slides up with a spring when the list finishes loading
- Press: scales down 0.9 → springs back on release

### 2.7 Rich Mood Timeline

**What:** Replace the current dot-based mood timeline with a smooth SVG curve visualization.

**Visual:**
- A card at the top of the journal list (below the streak calendar)
- X-axis: dates (last 14 entries with mood data)
- Y-axis: mood value (0–100, no labels — just the curve shape)
- Smooth bezier curve connecting mood points
- Gradient fill below the curve (accentSoft at top → transparent at bottom)
- Each data point is a small dot; tapping it shows a tooltip with the mood label and date
- If fewer than 3 mood-tagged entries exist, show the old dot fallback

**Implementation:** Use React Native's built-in `Svg` from `react-native-svg` (needs to be added as dependency). Simple path calculation — no charting library needed.

**New dependency:** `react-native-svg`

### 2.8 Time-of-Day Theming

**What:** Subtly shift the journal entry screen's ambient color based on when the user is writing.

**Rules:**
| Time | Tint | Feel |
|---|---|---|
| 5am – 11am | Warm golden overlay on surface | Morning warmth |
| 11am – 5pm | No tint (default) | Neutral clarity |
| 5pm – 9pm | Soft amber warmth on surface | Evening wind-down |
| 9pm – 5am | Cooler, slightly darker surface | Night calm |

**Implementation:**
- A `useTimeOfDay()` hook returns the current period
- The journal entry screen applies a very subtle background color override (3–5% opacity tint over the base surface color)
- Only affects the entry writing screen, not the list
- Uses `interpolateColor` or simple RGBA blending — no animation library needed

### 2.9 Privacy Unlock Ritual

**What:** The visual transition from the PIN screen to the journal content. Not a separate feature — this is the animation layer of 2.1.

**Sequence (400ms total):**
1. PIN correct → success haptic fires immediately
2. Lock icon: spring scale 1 → 1.3, then fade out (150ms)
3. Background: subtle warm pulse (surface briefly brightens 5%, returns) (150ms)
4. Journal content: fades in from opacity 0 → 1 with a slight upward translate (-20 → 0) (200ms, overlaps with step 3)

---

## 3. Schema Changes

Single migration file: `013_journal_premium.sql`

```sql
-- Add mood value for fluid slider (0-100 scale)
ALTER TABLE public.journal_entries
  ADD COLUMN mood_value integer;

-- Add prompt tracking
ALTER TABLE public.journal_entries
  ADD COLUMN prompt_used text;

-- Add constraint for mood_value range
ALTER TABLE public.journal_entries
  ADD CONSTRAINT journal_entries_mood_value_range
  CHECK (mood_value IS NULL OR (mood_value >= 0 AND mood_value <= 100));
```

No new tables. No RLS changes (existing policies cover the new columns automatically).

---

## 4. New Dependencies

| Package | Purpose | Used by |
|---|---|---|
| `expo-secure-store` | Encrypted PIN storage | PIN lock |
| `expo-local-authentication` | Face ID / Touch ID | Biometric unlock |
| `react-native-svg` | Mood timeline curve | Rich mood timeline |

---

## 5. File Plan

### New files
| File | Purpose |
|---|---|
| `components/JournalLock.tsx` | PIN entry / setup / biometric unlock screen |
| `components/MoodSlider.tsx` | Fluid gradient mood slider with haptic ticks |
| `components/StreakCalendar.tsx` | Monthly heatmap calendar grid |
| `components/WeeklyDigest.tsx` | Auto-generated weekly reflection card |
| `components/MoodCurve.tsx` | SVG-based mood timeline curve |
| `hooks/useJournalLock.ts` | PIN state management (SecureStore + biometrics) |
| `hooks/useTimeOfDay.ts` | Returns current time period for ambient theming |
| `lib/prompts.ts` | Prompt pool + day-based selection |
| `store/journal.ts` | Zustand store for journal UI state (lock status, digest dismissal) |
| `supabase/migrations/013_journal_premium.sql` | Schema migration |

### Modified files
| File | Changes |
|---|---|
| `app/(recovery)/journal.tsx` | Add lock gate, streak calendar, weekly digest, mood curve, entry animations |
| `app/(recovery)/journal-entry.tsx` | Add guided prompt card, mood slider, time-of-day theming, save animation |
| `lib/mood.ts` | Add `moodFromValue()` function, expand MOODS to include `struggling` and `neutral` |
| `app/(recovery)/_layout.tsx` | Add `journal-lock` as hidden tab screen |

---

## 6. Build Order

Each step is independently testable and committable:

1. **Schema migration** — Add `mood_value` and `prompt_used` columns
2. **Dependencies** — Install `expo-secure-store`, `expo-local-authentication`, `react-native-svg`
3. **PIN lock + unlock ritual** — `JournalLock`, `useJournalLock`, lock gate in journal.tsx
4. **Guided prompts** — `lib/prompts.ts`, prompt card in journal-entry.tsx
5. **Mood slider** — `MoodSlider` component, integrate into journal-entry.tsx, update `lib/mood.ts`
6. **Streak calendar** — `StreakCalendar` component, replace mood dots in journal.tsx
7. **Mood curve** — `MoodCurve` component, add to journal.tsx below calendar
8. **Weekly digest** — `WeeklyDigest` component, add to journal.tsx
9. **Time-of-day theming** — `useTimeOfDay` hook, apply to journal-entry.tsx
10. **Micro-interactions** — Entry animations, FAB spring, delete shake

---

## 7. Boundaries

### Always do
- Store PIN exclusively in `expo-secure-store` — never in AsyncStorage, state, or server
- Keep journal entries private — no new RLS policies that expose data
- Use existing design tokens (spacing, radii, colors) — no magic numbers
- Haptic feedback on every meaningful interaction

### Never do
- Send PIN or journal content to the server beyond what Supabase RLS already handles
- Show journal content in push notifications
- Add AI-generated content to journal entries (prompts are human-written)
- Break backward compatibility with existing entries (mood_tag must still work)

---

*Spec for feature/journal branch — 2026-04-13*
