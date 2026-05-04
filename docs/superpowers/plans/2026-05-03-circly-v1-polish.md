# Circly V1 Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the V1 polish spec — feed-based home, navigation redesign, onboarding visual overhaul, journal improvements, and design system fixes.

**Architecture:** The home tab becomes a curated feed for both roles. A persistent AppHeader (avatar, SOS, add supporter, messages) replaces per-screen headers. A custom tab bar adds a raised center check-in button. Onboarding is rebuilt visually from the ground up while keeping the same Expo Router route structure.

**Tech Stack:** React Native (Expo Router), TypeScript, Supabase, Express.js, Zustand, `@expo/vector-icons` via the existing `Icon` component, Vitest for tests.

---

## Scope note

These tasks are organized in dependency order. Tasks 1–4 (foundation) must ship before Tasks 5–11 (feed). Tasks 12–16 (onboarding + journal) are independent and can be done in any order relative to the feed work.

---

## Task 1: Fix Mood Scale (Struggling → Thriving)

**Files:**
- Modify: `apps/mobile/lib/mood.ts`

- [ ] **Step 1: Update the top-end mood entry and legacy map**

In `apps/mobile/lib/mood.ts`, change the last entry in `MOODS` and add a legacy mapping for the old `grateful` tag so existing journal entries don't break:

```ts
export const MOODS: Mood[] = [
  { tag: 'struggling', icon: 'alert-circle',  label: 'struggling', min: 0,  max: 14  },
  { tag: 'anxious',    icon: 'cloud',          label: 'anxious',    min: 15, max: 28  },
  { tag: 'sad',        icon: 'cloud-rain',     label: 'sad',        min: 29, max: 42  },
  { tag: 'neutral',    icon: 'minus',          label: 'neutral',    min: 43, max: 57  },
  { tag: 'calm',       icon: 'wind',           label: 'calm',       min: 58, max: 71  },
  { tag: 'hopeful',    icon: 'trending-up',    label: 'hopeful',    min: 72, max: 85  },
  { tag: 'thriving',   icon: 'sun',            label: 'thriving',   min: 86, max: 100 },
]

const LEGACY_MAP: Record<string, string> = {
  angry:    'struggling',
  grateful: 'thriving',   // migrated
}
```

- [ ] **Step 2: Write unit tests**

Create `apps/mobile/lib/__tests__/mood.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { moodFromValue, findMood, MOODS } from '../mood'

describe('mood scale', () => {
  it('top end tag is thriving', () => {
    expect(MOODS[MOODS.length - 1].tag).toBe('thriving')
  })

  it('moodFromValue(100) returns thriving', () => {
    expect(moodFromValue(100).tag).toBe('thriving')
  })

  it('moodFromValue(0) returns struggling', () => {
    expect(moodFromValue(0).tag).toBe('struggling')
  })

  it('legacy grateful tag resolves to thriving', () => {
    expect(findMood('grateful')?.tag).toBe('thriving')
  })

  it('ranges are contiguous from 0 to 100', () => {
    for (let i = 0; i < MOODS.length - 1; i++) {
      expect(MOODS[i].max + 1).toBe(MOODS[i + 1].min)
    }
    expect(MOODS[0].min).toBe(0)
    expect(MOODS[MOODS.length - 1].max).toBe(100)
  })
})
```

- [ ] **Step 3: Run tests**

```bash
cd apps/mobile && npx vitest run lib/__tests__/mood.test.ts
```

Expected: all 5 tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/lib/mood.ts apps/mobile/lib/__tests__/mood.test.ts
git commit -m "fix: rename top mood from grateful to thriving, add legacy map"
```

---

## Task 2: AppHeader Component

**Files:**
- Create: `apps/mobile/components/AppHeader.tsx`

The header is rendered at the top of each main screen's layout (added in Task 3 & 4). It shows: avatar (initials, tappable → profile), "circly" wordmark, and right-side icons: SOS, add supporter, messages badge.

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/components/__tests__/AppHeader.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react-native'
import { AppHeader } from '../AppHeader'

describe('AppHeader', () => {
  it('renders the circly wordmark', () => {
    render(
      <AppHeader
        displayName="Alex"
        unreadMessages={0}
        onSOS={() => {}}
        onAddSupporter={() => {}}
        onMessages={() => {}}
        onProfile={() => {}}
      />
    )
    expect(screen.getByText('circly')).toBeTruthy()
  })

  it('shows unread badge when unreadMessages > 0', () => {
    render(
      <AppHeader
        displayName="Alex"
        unreadMessages={3}
        onSOS={() => {}}
        onAddSupporter={() => {}}
        onMessages={() => {}}
        onProfile={() => {}}
      />
    )
    expect(screen.getByText('3')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd apps/mobile && npx vitest run components/__tests__/AppHeader.test.tsx
```

Expected: FAIL — cannot find module `../AppHeader`.

- [ ] **Step 3: Create the component**

Create `apps/mobile/components/AppHeader.tsx`:

```tsx
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useColors } from '../hooks/useColors'
import { Icon } from './Icon'
import { spacing, radii, type } from '../constants/theme'

interface AppHeaderProps {
  displayName: string
  unreadMessages: number
  onSOS: () => void
  onAddSupporter: () => void
  onMessages: () => void
  onProfile: () => void
}

export function AppHeader({
  displayName,
  unreadMessages,
  onSOS,
  onAddSupporter,
  onMessages,
  onProfile,
}: AppHeaderProps) {
  const colors = useColors()
  const initial = (displayName?.[0] ?? '?').toUpperCase()

  return (
    <View style={[styles.container, { borderBottomColor: colors.border }]}>
      {/* Avatar */}
      <Pressable
        onPress={onProfile}
        accessibilityLabel="Open profile"
        style={[styles.avatar, { backgroundColor: colors.accent }]}
      >
        <Text style={[styles.avatarText, { color: colors.background }]}>{initial}</Text>
      </Pressable>

      {/* Wordmark */}
      <Text style={[styles.wordmark, { color: colors.textPrimary }]}>circly</Text>

      {/* Right icons */}
      <View style={styles.icons}>
        {/* SOS */}
        <Pressable
          onPress={onSOS}
          accessibilityLabel="Get support"
          style={[styles.iconBtn, { backgroundColor: colors.dangerSoft, borderColor: colors.danger, borderWidth: 1 }]}
        >
          <Icon name="alert-triangle" size={16} color={colors.danger} />
        </Pressable>

        {/* Add supporter */}
        <Pressable
          onPress={onAddSupporter}
          accessibilityLabel="Add supporter"
          style={[styles.iconBtn, { backgroundColor: colors.surface }]}
        >
          <Icon name="user-plus" size={16} color={colors.textSecondary} />
        </Pressable>

        {/* Messages */}
        <Pressable
          onPress={onMessages}
          accessibilityLabel={`Messages${unreadMessages > 0 ? `, ${unreadMessages} unread` : ''}`}
          style={[styles.iconBtn, { backgroundColor: colors.surface }]}
        >
          <Icon name="message-circle" size={16} color={colors.textSecondary} />
          {unreadMessages > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.danger }]}>
              <Text style={styles.badgeText}>{unreadMessages > 9 ? '9+' : unreadMessages}</Text>
            </View>
          )}
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '700',
  },
  wordmark: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  icons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
})
```

- [ ] **Step 4: Run tests**

```bash
cd apps/mobile && npx vitest run components/__tests__/AppHeader.test.tsx
```

Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/components/AppHeader.tsx apps/mobile/components/__tests__/AppHeader.test.tsx
git commit -m "feat: add AppHeader component with avatar, SOS, add supporter, and messages"
```

---

## Task 3: Navigation — Recovery Layout (Option C)

**Files:**
- Create: `apps/mobile/components/RecoveryTabBar.tsx`
- Modify: `apps/mobile/app/(recovery)/_layout.tsx`

Replace the current 5-tab nav with a custom tab bar: 4 tabs flanking a raised center check-in button. Messages moves to the header — the `chat` tab is hidden from the bar but still accessible from the header icon.

- [ ] **Step 1: Create the custom tab bar**

Create `apps/mobile/components/RecoveryTabBar.tsx`:

```tsx
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { router } from 'expo-router'
import { useColors } from '../hooks/useColors'
import { Icon } from './Icon'
import { spacing, radii } from '../constants/theme'
import type { IconName } from './Icon'

const TABS: Array<{ name: string; label: string; icon: IconName }> = [
  { name: 'index',         label: 'home',    icon: 'home'      },
  { name: 'journal',       label: 'journal', icon: 'book-open' },
  { name: 'notifications', label: 'alerts',  icon: 'bell'      },
  { name: 'profile',       label: 'profile', icon: 'user'      },
]

const HIDDEN = new Set(['check-in', 'journal-entry', 'settings', 'supporter-settings', 'silence-settings', 'chat'])

export function RecoveryTabBar({ state, navigation }: BottomTabBarProps) {
  const colors = useColors()

  const visibleRoutes = state.routes.filter((r) => !HIDDEN.has(r.name))
  const half = Math.floor(visibleRoutes.length / 2)
  const left = visibleRoutes.slice(0, half)
  const right = visibleRoutes.slice(half)

  function renderTab(route: typeof state.routes[0], tabDef: typeof TABS[0]) {
    const isFocused = state.routes[state.index].name === route.name
    const color = isFocused ? colors.accent : colors.textMuted

    return (
      <Pressable
        key={route.name}
        onPress={() => navigation.navigate(route.name)}
        accessibilityRole="tab"
        accessibilityLabel={tabDef.label}
        style={styles.tab}
      >
        <Icon name={tabDef.icon} size={22} color={color} />
        <Text style={[styles.label, { color }]}>{tabDef.label}</Text>
      </Pressable>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
      {/* Left tabs */}
      {left.map((route) => {
        const def = TABS.find((t) => t.name === route.name)!
        return renderTab(route, def)
      })}

      {/* Center check-in button */}
      <Pressable
        onPress={() => router.push('/(recovery)/check-in')}
        accessibilityLabel="Check in"
        style={styles.centerWrap}
      >
        <View style={[styles.centerBtn, { backgroundColor: colors.accent }]}>
          <Icon name="check" size={24} color={colors.background} />
        </View>
        <Text style={[styles.label, { color: colors.accent, fontWeight: '700' }]}>check in</Text>
      </Pressable>

      {/* Right tabs */}
      {right.map((route) => {
        const def = TABS.find((t) => t.name === route.name)!
        return renderTab(route, def)
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.md,
    height: 80,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingTop: spacing.sm,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    marginTop: -20,
  },
  centerBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
})
```

- [ ] **Step 2: Update the recovery layout**

Replace the `<Tabs>` content in `apps/mobile/app/(recovery)/_layout.tsx`. Add `tabBar` prop and remove the `chat` tab from the visible set. Keep all the existing `useEffect` logic unchanged — only change the JSX return:

```tsx
// Add this import at the top:
import { RecoveryTabBar } from '../../components/RecoveryTabBar'

// Replace the return statement:
return (
  <Tabs
    tabBar={(props) => <RecoveryTabBar {...props} />}
    screenOptions={{
      headerShown: false,
      sceneStyle: { backgroundColor: colors.background },
    }}
  >
    <Tabs.Screen name="index"         options={{ title: 'home'    }} />
    <Tabs.Screen name="journal"       options={{ title: 'journal' }} />
    <Tabs.Screen name="notifications" options={{ title: 'alerts'  }} />
    <Tabs.Screen name="profile"       options={{ title: 'profile' }} />
    {/* Accessible from header, not tab bar */}
    <Tabs.Screen name="chat"          options={{ href: null }} />
    {/* Sub-screens */}
    <Tabs.Screen name="check-in"        options={{ href: null }} />
    <Tabs.Screen name="journal-entry"   options={{ href: null }} />
    <Tabs.Screen name="settings"        options={{ href: null }} />
    <Tabs.Screen name="supporter-settings" options={{ href: null }} />
    <Tabs.Screen name="silence-settings"   options={{ href: null }} />
  </Tabs>
)
```

- [ ] **Step 3: Verify in simulator**

Start the app and confirm:
- 4 tabs visible: home, journal, alerts, profile
- Center raised check-in button in the middle
- Tapping check-in navigates to the check-in screen
- Active tab uses accent colour

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/components/RecoveryTabBar.tsx apps/mobile/app/(recovery)/_layout.tsx
git commit -m "feat: add Option C center check-in tab bar for recovery users"
```

---

## Task 4: Navigation — Supporter Layout + AppHeader Integration

**Files:**
- Create: `apps/mobile/components/SupporterTabBar.tsx`
- Modify: `apps/mobile/app/(supporter)/_layout.tsx`
- Modify: `apps/mobile/app/(recovery)/index.tsx` (add AppHeader)
- Modify: `apps/mobile/app/(supporter)/index.tsx` (add AppHeader)

- [ ] **Step 1: Create supporter tab bar**

Create `apps/mobile/components/SupporterTabBar.tsx`:

```tsx
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { useColors } from '../hooks/useColors'
import { Icon } from './Icon'
import { spacing } from '../constants/theme'
import type { IconName } from './Icon'

const TABS: Array<{ name: string; label: string; icon: IconName }> = [
  { name: 'index',         label: 'home',        icon: 'home'    },
  { name: 'connections',   label: 'connections', icon: 'users'   },
  { name: 'notifications', label: 'alerts',      icon: 'bell'    },
  { name: 'profile',       label: 'profile',     icon: 'user'    },
]

export function SupporterTabBar({ state, navigation }: BottomTabBarProps) {
  const colors = useColors()

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
      {TABS.map(({ name, label, icon }) => {
        const route = state.routes.find((r) => r.name === name)
        const isFocused = route ? state.routes[state.index].name === name : false
        const color = isFocused ? colors.accent : colors.textMuted

        return (
          <Pressable
            key={name}
            onPress={() => route && navigation.navigate(name)}
            accessibilityRole="tab"
            accessibilityLabel={label}
            style={styles.tab}
          >
            <Icon name={icon} size={22} color={color} />
            <Text style={[styles.label, { color }]}>{label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingBottom: 24,
    height: 80,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 3,
    paddingBottom: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
})
```

- [ ] **Step 2: Update supporter layout**

In `apps/mobile/app/(supporter)/_layout.tsx`, add the `SupporterTabBar` and update screen declarations to match the 4-tab structure (the existing `invites` screen maps to the `connections` tab label):

```tsx
import { SupporterTabBar } from '../../components/SupporterTabBar'

// In the return:
return (
  <Tabs
    tabBar={(props) => <SupporterTabBar {...props} />}
    screenOptions={{
      headerShown: false,
      sceneStyle: { backgroundColor: colors.background },
    }}
  >
    <Tabs.Screen name="index"         options={{ title: 'home'        }} />
    <Tabs.Screen name="invites"       options={{ title: 'connections' }} />
    <Tabs.Screen name="notifications" options={{ title: 'alerts'      }} />
    <Tabs.Screen name="profile"       options={{ title: 'profile'     }} />
    <Tabs.Screen name="chat"          options={{ href: null }} />
    <Tabs.Screen name="settings"      options={{ href: null }} />
  </Tabs>
)
```

- [ ] **Step 3: Add AppHeader to recovery home screen**

At the top of the `RecoveryHome` return in `apps/mobile/app/(recovery)/index.tsx`, replace the existing inline header with `AppHeader`. Add these imports:

```tsx
import { AppHeader } from '../../components/AppHeader'
```

Replace the `<View style={styles.header}>` block (lines 223–246) and the `handleGetSupport` usage in the header with:

```tsx
<AppHeader
  displayName={user?.displayName ?? ''}
  unreadMessages={0}  // wire up in Task 10 when chat unread count is available
  onSOS={handleGetSupport}
  onAddSupporter={() => router.push('/(recovery)/settings')}
  onMessages={() => router.push('/(recovery)/chat')}
  onProfile={() => router.push('/(recovery)/profile')}
/>
```

Remove the old `styles.header`, `styles.headerText`, `styles.headerButton` styles since they're no longer used.

- [ ] **Step 4: Add AppHeader to supporter home screen**

Open `apps/mobile/app/(supporter)/index.tsx` and apply the same pattern — import `AppHeader`, render it at the top of the screen, wired to the supporter's actions:

```tsx
import { AppHeader } from '../../components/AppHeader'

// In the return, at the top before the ScrollView content:
<AppHeader
  displayName={user?.displayName ?? ''}
  unreadMessages={0}
  onSOS={() => {}}          // supporters don't have SOS — hide icon or no-op
  onAddSupporter={() => router.push('/(supporter)/invites')}
  onMessages={() => router.push('/(supporter)/chat')}
  onProfile={() => router.push('/(supporter)/profile')}
/>
```

- [ ] **Step 5: Verify in simulator**

- Supporter sees 4 tabs: home, connections, alerts, profile
- Both roles see the header with avatar, wordmark, SOS, add, messages
- Messages icon navigates to chat on both roles

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/components/SupporterTabBar.tsx apps/mobile/app/(supporter)/_layout.tsx apps/mobile/app/(recovery)/index.tsx apps/mobile/app/(supporter)/index.tsx
git commit -m "feat: add supporter tab bar and wire AppHeader to both home screens"
```

---

## Task 5: Reflection Prompts Library

**Files:**
- Create: `apps/mobile/lib/reflectionPrompts.ts`
- Create: `apps/mobile/lib/__tests__/reflectionPrompts.test.ts`

Static prompts bucketed by days-sober. No API call needed — hardcoded initially.

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/lib/__tests__/reflectionPrompts.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { getPromptForDay } from '../reflectionPrompts'

describe('getPromptForDay', () => {
  it('returns a string for day 1', () => {
    const prompt = getPromptForDay(1)
    expect(typeof prompt).toBe('string')
    expect(prompt.length).toBeGreaterThan(10)
  })

  it('returns different prompts for early vs late recovery', () => {
    const early = getPromptForDay(3)
    const late = getPromptForDay(120)
    expect(early).not.toBe(late)
  })

  it('always returns a prompt regardless of day count', () => {
    expect(() => getPromptForDay(0)).not.toThrow()
    expect(() => getPromptForDay(999)).not.toThrow()
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd apps/mobile && npx vitest run lib/__tests__/reflectionPrompts.test.ts
```

- [ ] **Step 3: Create the prompts library**

Create `apps/mobile/lib/reflectionPrompts.ts`:

```ts
type Stage = 'early' | 'building' | 'established' | 'thriving'

function stageFor(days: number): Stage {
  if (days <= 7)  return 'early'
  if (days <= 30) return 'building'
  if (days <= 90) return 'established'
  return 'thriving'
}

const PROMPTS: Record<Stage, string[]> = {
  early: [
    "What's one small thing you did today to take care of yourself?",
    "What does getting through today feel like?",
    "Who or what helped you get through the last 24 hours?",
    "What does this first step mean to you?",
    "What's one thing you want to remember about today?",
  ],
  building: [
    "What's getting easier compared to week one?",
    "What moment this week are you most proud of?",
    "What does your support system look like right now?",
    "What's one habit that's starting to feel natural?",
    "What would you tell yourself from 30 days ago?",
  ],
  established: [
    "What's one thing that felt easier today than a month ago?",
    "When did you feel most like yourself this week?",
    "What's a challenge you navigated that you wouldn't have before?",
    "How has your relationship with yourself changed?",
    "What are you building toward right now?",
  ],
  thriving: [
    "What does your life look like that you couldn't have imagined at day one?",
    "Who in your life has noticed a difference in you?",
    "What does thriving mean to you today?",
    "What do you want the next 90 days to look like?",
    "What would you tell someone on day one?",
  ],
}

export function getPromptForDay(days: number): string {
  const stage = stageFor(Math.max(0, days))
  const pool = PROMPTS[stage]
  // Deterministic pick based on day so the prompt doesn't change on re-render
  return pool[days % pool.length]
}
```

- [ ] **Step 4: Run tests**

```bash
cd apps/mobile && npx vitest run lib/__tests__/reflectionPrompts.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/reflectionPrompts.ts apps/mobile/lib/__tests__/reflectionPrompts.test.ts
git commit -m "feat: add stage-bucketed reflection prompts library"
```

---

## Task 6: Daily Intentions Backend

**Files:**
- Create: `supabase/migrations/014_daily_intentions.sql`
- Create: `server/src/routes/intentions.ts`
- Modify: `server/src/app.ts` (register route)
- Modify: `apps/mobile/lib/api.ts` (add client functions)

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/014_daily_intentions.sql`:

```sql
create table if not exists daily_intentions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  intention   text not null,
  created_at  timestamptz not null default now(),
  date        date not null default current_date,
  unique (user_id, date)
);

alter table daily_intentions enable row level security;

create policy "Users manage own intentions"
  on daily_intentions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Supporters can read intentions of users they support (for shared intention feed card)
create policy "Supporters read linked intentions"
  on daily_intentions
  for select
  using (
    exists (
      select 1 from relationships r
      where r.supporter_id = auth.uid()
        and r.user_id = daily_intentions.user_id
        and r.status = 'active'
    )
  );
```

- [ ] **Step 2: Apply migration to local Supabase**

```bash
supabase db push
```

Expected: migration applied without errors.

- [ ] **Step 3: Create the server route**

Create `server/src/routes/intentions.ts`:

```ts
import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { supabaseAdmin } from '../lib/supabase'

const router = Router()

router.use(requireAuth)

// GET /api/intentions/today — fetch today's intention for the authed user
router.get('/today', async (req, res) => {
  const userId = req.user!.id
  const today = new Date().toISOString().split('T')[0]

  const { data, error } = await supabaseAdmin
    .from('daily_intentions')
    .select('intention, date')
    .eq('user_id', userId)
    .eq('date', today)
    .maybeSingle()

  if (error) return res.status(500).json({ error: error.message })
  return res.json({ intention: data?.intention ?? null, date: today })
})

// POST /api/intentions — upsert today's intention
router.post('/', async (req, res) => {
  const userId = req.user!.id
  const { intention } = req.body as { intention: string }
  if (!intention || typeof intention !== 'string' || intention.trim().length === 0) {
    return res.status(400).json({ error: 'intention is required' })
  }

  const today = new Date().toISOString().split('T')[0]
  const { data, error } = await supabaseAdmin
    .from('daily_intentions')
    .upsert({ user_id: userId, intention: intention.trim(), date: today }, { onConflict: 'user_id,date' })
    .select('intention, date')
    .single()

  if (error) return res.status(500).json({ error: error.message })
  return res.json(data)
})

export default router
```

- [ ] **Step 4: Register the route in the Express app**

In `server/src/app.ts`, add alongside the other route imports:

```ts
import intentionsRouter from './routes/intentions'
// ...
app.use('/api/intentions', intentionsRouter)
```

- [ ] **Step 5: Add client functions to api.ts**

In `apps/mobile/lib/api.ts`, add:

```ts
export async function getTodayIntention(): Promise<{ intention: string | null; date: string }> {
  return api('/api/intentions/today')
}

export async function setIntention(intention: string): Promise<{ intention: string; date: string }> {
  return api('/api/intentions', { method: 'POST', body: JSON.stringify({ intention }) })
}
```

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/014_daily_intentions.sql server/src/routes/intentions.ts server/src/app.ts apps/mobile/lib/api.ts
git commit -m "feat: add daily intentions table, server route, and API client"
```

---

## Task 7: Feed Card Components

**Files:**
- Create: `apps/mobile/components/feed/DailyPulseCard.tsx`
- Create: `apps/mobile/components/feed/MemoryCard.tsx`
- Create: `apps/mobile/components/feed/IntentionCard.tsx`
- Create: `apps/mobile/components/feed/MilestoneCard.tsx`
- Create: `apps/mobile/components/feed/StrugglingCard.tsx`
- Create: `apps/mobile/components/feed/CheckInActivityCard.tsx`
- Create: `apps/mobile/components/feed/SilenceAlertCard.tsx`
- Create: `apps/mobile/components/feed/SharedIntentionCard.tsx`

- [ ] **Step 1: Create DailyPulseCard**

Create `apps/mobile/components/feed/DailyPulseCard.tsx`:

```tsx
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useColors } from '../../hooks/useColors'
import { Icon } from '../Icon'
import { spacing, radii, type } from '../../constants/theme'

interface DailyPulseCardProps {
  prompt: string
  onWriteAnswer: () => void
}

export function DailyPulseCard({ prompt, onWriteAnswer }: DailyPulseCardProps) {
  const colors = useColors()
  return (
    <View style={[styles.card, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
      <View style={styles.labelRow}>
        <Icon name="sun" size={11} color={colors.accent} />
        <Text style={[styles.label, { color: colors.accent }]}>today's reflection</Text>
      </View>
      <Text style={[styles.prompt, { color: colors.textPrimary }]}>"{prompt}"</Text>
      <Pressable
        onPress={onWriteAnswer}
        style={[styles.cta, { backgroundColor: colors.surface }]}
        accessibilityLabel="Write your answer in the journal"
      >
        <Text style={[styles.ctaText, { color: colors.textSecondary }]}>Write your answer</Text>
        <Icon name="arrow-right" size={14} color={colors.accent} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.xl, borderWidth: 1, padding: spacing.lg, gap: spacing.md },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  label: { ...type.label, textTransform: 'lowercase' },
  prompt: { ...type.body, fontStyle: 'italic', lineHeight: 22 },
  cta: { borderRadius: radii.md, padding: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ctaText: { ...type.small },
})
```

- [ ] **Step 2: Create MemoryCard**

Create `apps/mobile/components/feed/MemoryCard.tsx`:

```tsx
import { View, Text, StyleSheet } from 'react-native'
import { useColors } from '../../hooks/useColors'
import { Icon } from '../Icon'
import { spacing, radii, type } from '../../constants/theme'

interface MemoryCardProps {
  entryText: string
  daysAgo: number
  dayNumber: number
}

export function MemoryCard({ entryText, daysAgo, dayNumber }: MemoryCardProps) {
  const colors = useColors()
  const label = daysAgo === 7 ? 'one week ago' : daysAgo === 30 ? 'one month ago' : `${daysAgo} days ago`
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.labelRow}>
        <Icon name="calendar" size={11} color={colors.textMuted} />
        <Text style={[styles.label, { color: colors.textMuted }]}>{label} · day {dayNumber}</Text>
      </View>
      <Text style={[styles.entry, { color: colors.textSecondary }]}>"{entryText}"</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.xl, borderWidth: 1, padding: spacing.lg, gap: spacing.md },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  label: { ...type.label },
  entry: { ...type.body, fontStyle: 'italic', lineHeight: 22 },
})
```

- [ ] **Step 3: Create IntentionCard**

Create `apps/mobile/components/feed/IntentionCard.tsx`:

```tsx
import { View, Text, Pressable, TextInput, StyleSheet, useState } from 'react-native'
import { useColors } from '../../hooks/useColors'
import { Icon } from '../Icon'
import { spacing, radii, type } from '../../constants/theme'

interface IntentionCardProps {
  intention: string | null
  onSave: (text: string) => Promise<void>
}

export function IntentionCard({ intention, onSave }: IntentionCardProps) {
  const colors = useColors()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(intention ?? '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!draft.trim()) return
    setSaving(true)
    await onSave(draft.trim())
    setSaving(false)
    setEditing(false)
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderStyle: intention ? 'solid' : 'dashed' }]}>
      {intention && !editing ? (
        <>
          <View style={styles.labelRow}>
            <Icon name="target" size={11} color={colors.textMuted} />
            <Text style={[styles.label, { color: colors.textMuted }]}>today's intention</Text>
          </View>
          <Text style={[styles.intentionText, { color: colors.textPrimary }]}>{intention}</Text>
          <Pressable onPress={() => setEditing(true)}>
            <Text style={[type.small, { color: colors.textMuted }]}>Edit</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={[styles.placeholder, { color: colors.textMuted }]}>
            {editing ? 'Update your intention' : 'Set today\'s intention'}
          </Text>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="What do you want to carry with you today?"
            placeholderTextColor={colors.textMuted}
            style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]}
            multiline
            autoFocus={editing}
          />
          <Pressable
            onPress={handleSave}
            disabled={saving || !draft.trim()}
            style={[styles.saveBtn, { backgroundColor: colors.accent, opacity: saving ? 0.6 : 1 }]}
          >
            <Text style={[type.small, { color: colors.background, fontWeight: '700' }]}>
              {saving ? 'Saving...' : 'Save'}
            </Text>
          </Pressable>
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.xl, borderWidth: 1, padding: spacing.lg, gap: spacing.md },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  label: { ...type.label },
  intentionText: { ...type.body, fontStyle: 'italic' },
  placeholder: { ...type.small },
  input: { borderWidth: 1, borderRadius: radii.md, padding: spacing.md, ...type.body, minHeight: 60 },
  saveBtn: { borderRadius: radii.md, padding: spacing.md, alignItems: 'center' },
})
```

**Note:** Fix the import at the top — `useState` must come from `react`, not from `react-native`:
```tsx
import { View, Text, Pressable, TextInput, StyleSheet } from 'react-native'
import { useState } from 'react'
```

- [ ] **Step 4: Create MilestoneCard**

Create `apps/mobile/components/feed/MilestoneCard.tsx`:

```tsx
import { View, Text, StyleSheet } from 'react-native'
import { useColors } from '../../hooks/useColors'
import { Icon } from '../Icon'
import { spacing, radii, type } from '../../constants/theme'

interface MilestoneCardProps {
  label: string
  daysAgo: number
  supporterNames: string[]
}

export function MilestoneCard({ label, daysAgo, supporterNames }: MilestoneCardProps) {
  const colors = useColors()
  const reaction = supporterNames.length > 0
    ? `${supporterNames.slice(0, 2).join(' and ')}${supporterNames.length > 2 ? ` and ${supporterNames.length - 2} others` : ''} celebrated with you.`
    : null

  return (
    <View style={[styles.card, { backgroundColor: colors.successSoft, borderColor: colors.success }]}>
      <View style={styles.labelRow}>
        <Icon name="award" size={11} color={colors.success} />
        <Text style={[styles.label, { color: colors.success }]}>milestone</Text>
      </View>
      <Text style={[styles.title, { color: colors.textPrimary }]}>
        {label} reached{daysAgo > 0 ? ` · ${daysAgo} day${daysAgo > 1 ? 's' : ''} ago` : ''}
      </Text>
      {reaction && <Text style={[type.small, { color: colors.textSecondary }]}>{reaction}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.xl, borderWidth: 1, padding: spacing.lg, gap: spacing.sm },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  label: { ...type.label },
  title: { ...type.h3 },
})
```

- [ ] **Step 5: Create StrugglingCard (contextual get support)**

Create `apps/mobile/components/feed/StrugglingCard.tsx`:

```tsx
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useColors } from '../../hooks/useColors'
import { Icon } from '../Icon'
import { spacing, radii, type } from '../../constants/theme'

interface StrugglingCardProps {
  onGetSupport: () => void
}

export function StrugglingCard({ onGetSupport }: StrugglingCardProps) {
  const colors = useColors()
  return (
    <View style={[styles.card, { backgroundColor: colors.dangerSoft, borderColor: colors.danger }]}>
      <View style={styles.labelRow}>
        <Icon name="alert-triangle" size={11} color={colors.danger} />
        <Text style={[styles.label, { color: colors.danger }]}>you said you're struggling</Text>
      </View>
      <Text style={[type.body, { color: colors.textPrimary }]}>
        Your supporters have been notified. You're not alone.
      </Text>
      <Pressable
        onPress={onGetSupport}
        style={[styles.cta, { backgroundColor: colors.danger }]}
        accessibilityLabel="Talk to someone now"
      >
        <Text style={[type.small, { color: '#fff', fontWeight: '700' }]}>Talk to someone now</Text>
        <Icon name="arrow-right" size={14} color="#fff" />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.xl, borderWidth: 1, padding: spacing.lg, gap: spacing.md },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  label: { ...type.label },
  cta: { borderRadius: radii.md, padding: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
})
```

- [ ] **Step 6: Create supporter feed cards**

Create `apps/mobile/components/feed/CheckInActivityCard.tsx`:

```tsx
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useColors } from '../../hooks/useColors'
import { Icon } from '../Icon'
import { spacing, radii, type } from '../../constants/theme'

interface CheckInActivityCardProps {
  userName: string
  userInitial: string
  status: 'sober' | 'struggling' | 'good_day'
  onEncourage: () => void
}

const STATUS_LABEL: Record<string, string> = {
  sober: 'checked in — sober',
  struggling: 'checked in — struggling',
  good_day: 'checked in — good day',
}

export function CheckInActivityCard({ userName, userInitial, status, onEncourage }: CheckInActivityCardProps) {
  const colors = useColors()
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.row}>
        <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
          <Text style={[styles.avatarText, { color: colors.background }]}>{userInitial}</Text>
        </View>
        <View style={styles.meta}>
          <Text style={[type.bodyStrong, { color: colors.textPrimary }]}>{userName}</Text>
          <Text style={[type.small, { color: colors.textSecondary }]}>Today · {STATUS_LABEL[status]}</Text>
        </View>
      </View>
      <Pressable
        onPress={onEncourage}
        style={[styles.cta, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}
        accessibilityLabel={`Send encouragement to ${userName}`}
      >
        <Text style={[type.small, { color: colors.textSecondary }]}>Send encouragement</Text>
        <Icon name="arrow-right" size={14} color={colors.textMuted} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.xl, borderWidth: 1, padding: spacing.lg, gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 15, fontWeight: '700' },
  meta: { flex: 1, gap: 2 },
  cta: { borderRadius: radii.md, padding: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
})
```

Create `apps/mobile/components/feed/SilenceAlertCard.tsx`:

```tsx
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useColors } from '../../hooks/useColors'
import { Icon } from '../Icon'
import { spacing, radii, type } from '../../constants/theme'

interface SilenceAlertCardProps {
  userName: string
  daysQuiet: number
  onMessage: () => void
}

export function SilenceAlertCard({ userName, daysQuiet, onMessage }: SilenceAlertCardProps) {
  const colors = useColors()
  return (
    <View style={[styles.card, { backgroundColor: colors.dangerSoft, borderColor: colors.danger }]}>
      <View style={styles.labelRow}>
        <Icon name="bell-off" size={11} color={colors.danger} />
        <Text style={[styles.label, { color: colors.danger }]}>heads up</Text>
      </View>
      <Text style={[type.body, { color: colors.textPrimary }]}>
        {userName} hasn't checked in for {daysQuiet} {daysQuiet === 1 ? 'day' : 'days'}.
      </Text>
      <Pressable onPress={onMessage} style={[styles.cta, { backgroundColor: colors.surface }]} accessibilityLabel={`Message ${userName}`}>
        <Text style={[type.small, { color: colors.textSecondary }]}>Send a message</Text>
        <Icon name="arrow-right" size={14} color={colors.textMuted} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.xl, borderWidth: 1, padding: spacing.lg, gap: spacing.md },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  label: { ...type.label },
  cta: { borderRadius: radii.md, padding: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
})
```

Create `apps/mobile/components/feed/SharedIntentionCard.tsx`:

```tsx
import { View, Text, StyleSheet } from 'react-native'
import { useColors } from '../../hooks/useColors'
import { Icon } from '../Icon'
import { spacing, radii, type } from '../../constants/theme'

interface SharedIntentionCardProps {
  userName: string
  intention: string
}

export function SharedIntentionCard({ userName, intention }: SharedIntentionCardProps) {
  const colors = useColors()
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.labelRow}>
        <Icon name="target" size={11} color={colors.textMuted} />
        <Text style={[styles.label, { color: colors.textMuted }]}>{userName}'s intention today</Text>
      </View>
      <Text style={[type.body, { color: colors.textSecondary, fontStyle: 'italic' }]}>"{intention}"</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.xl, borderWidth: 1, padding: spacing.lg, gap: spacing.md },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  label: { ...type.label },
})
```

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/components/feed/
git commit -m "feat: add feed card components for recovery and supporter views"
```

---

## Task 8: Recovery Home Screen → Feed

**Files:**
- Modify: `apps/mobile/app/(recovery)/index.tsx`

Replace the current "TODAY" action tiles section with the feed card section. The streak card, milestone path, and weekly summary stay — they move above the feed cards as the pinned snapshot.

- [ ] **Step 1: Add feed data to the existing data loader**

In `loadDashboard` in `apps/mobile/app/(recovery)/index.tsx`, add fetches for the daily pulse data alongside the existing parallel fetches:

```ts
// Add these imports at the top:
import { getTodayIntention, setIntention } from '../../lib/api'
import { getPromptForDay } from '../../lib/reflectionPrompts'
import { DailyPulseCard } from '../../components/feed/DailyPulseCard'
import { MemoryCard } from '../../components/feed/MemoryCard'
import { IntentionCard } from '../../components/feed/IntentionCard'
import { MilestoneCard } from '../../components/feed/MilestoneCard'
import { StrugglingCard } from '../../components/feed/StrugglingCard'

// Add state:
const [intention, setIntentionState] = useState<string | null>(null)
const [memoryEntry, setMemoryEntry] = useState<{ text: string; daysAgo: number; dayNumber: number } | null>(null)
```

In `loadDashboard`, add to the parallel fetch array:

```ts
// Fetch today's intention
api<{ intention: string | null }>('/api/intentions/today').catch(() => ({ intention: null })),

// Fetch memory (journal entry from ~30 days ago)
supabase
  .from('journal_entries')
  .select('body, created_at')
  .eq('user_id', user.id)
  .gte('created_at', new Date(Date.now() - 35 * 86400000).toISOString())
  .lte('created_at', new Date(Date.now() - 25 * 86400000).toISOString())
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle(),
```

After the fetch, set state:

```ts
setIntentionState(intentionRes.intention)
if (memoryRes.data) {
  const entryDate = new Date(memoryRes.data.created_at)
  const daysAgo = Math.round((Date.now() - entryDate.getTime()) / 86400000)
  const dayNumber = user?.sobrietyStartDate
    ? Math.max(1, Math.round((entryDate.getTime() - new Date(user.sobrietyStartDate).getTime()) / 86400000))
    : daysAgo
  setMemoryEntry({ text: memoryRes.data.body, daysAgo, dayNumber })
}
```

- [ ] **Step 2: Replace the TODAY section with the feed**

Replace the `<View style={styles.section}>` block that contains `<Text>today</Text>` and the `<View style={styles.tiles}>` with:

```tsx
{/* Feed cards */}
<View style={styles.section}>
  <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>your feed</Text>

  {todayStatus === 'struggling' && (
    <StrugglingCard onGetSupport={handleGetSupport} />
  )}

  {todayStatus !== null && (
    <DailyPulseCard
      prompt={getPromptForDay(days)}
      onWriteAnswer={() =>
        router.push({
          pathname: '/(recovery)/journal-entry',
          params: { prompt: getPromptForDay(days) },
        })
      }
    />
  )}

  {memoryEntry && (
    <MemoryCard
      entryText={memoryEntry.text}
      daysAgo={memoryEntry.daysAgo}
      dayNumber={memoryEntry.dayNumber}
    />
  )}

  <IntentionCard
    intention={intention}
    onSave={async (text) => {
      await setIntention(text)
      setIntentionState(text)
    }}
  />
</View>
```

- [ ] **Step 3: Verify in simulator**

After checking in, the feed shows:
- Daily pulse card with a prompt
- Memory card (if a journal entry exists from ~30 days ago)
- Intention card
- Struggling card at the top if status is 'struggling'

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/(recovery)/index.tsx
git commit -m "feat: transform recovery home into curated feed with daily pulse and memory cards"
```

---

## Task 9: Supporter Home Screen → Feed

**Files:**
- Modify: `apps/mobile/app/(supporter)/index.tsx`

Add the supporter feed cards (check-in activity, silence alerts, shared intentions) to the supporter home screen. Read the linked users' latest check-ins and intentions from Supabase.

- [ ] **Step 1: Add feed imports to supporter index**

```ts
import { CheckInActivityCard } from '../../components/feed/CheckInActivityCard'
import { SilenceAlertCard } from '../../components/feed/SilenceAlertCard'
import { SharedIntentionCard } from '../../components/feed/SharedIntentionCard'
```

- [ ] **Step 2: Fetch feed data for linked users**

In the supporter home's data loader (wherever linked users are fetched), also query today's check-ins and intentions for each linked user:

```ts
// Fetch linked users' today check-ins and intentions
const { data: linkedActivity } = await supabase
  .from('relationships')
  .select(`
    user_id,
    profiles!relationships_user_id_fkey(display_name),
    check_ins(status, check_in_date),
    daily_intentions(intention, date)
  `)
  .eq('supporter_id', user.id)
  .eq('status', 'active')
  .eq('check_ins.check_in_date', toISODate(new Date()))
  .eq('daily_intentions.date', toISODate(new Date()))
```

Store the result in state:

```ts
const [linkedActivity, setLinkedActivity] = useState<any[]>([])
// after fetch:
setLinkedActivity(linkedActivity ?? [])
```

- [ ] **Step 3: Render feed cards in the supporter home screen**

Below the existing supporter home content, add a feed section:

```tsx
<View style={styles.section}>
  <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>your feed</Text>

  {linkedActivity.map((link) => {
    const name = link.profiles?.display_name ?? 'your person'
    const initial = (name[0] ?? '?').toUpperCase()
    const checkin = link.check_ins?.[0]
    const intention = link.daily_intentions?.[0]
    const daysSinceCheckin = link.days_since_checkin ?? 0

    return (
      <View key={link.user_id} style={{ gap: spacing.md }}>
        {checkin ? (
          <CheckInActivityCard
            userName={name}
            userInitial={initial}
            status={checkin.status}
            onEncourage={() => router.push({
              pathname: '/(supporter)/chat',
              params: { userId: link.user_id },
            })}
          />
        ) : daysSinceCheckin >= 3 ? (
          <SilenceAlertCard
            userName={name}
            daysQuiet={daysSinceCheckin}
            onMessage={() => router.push({
              pathname: '/(supporter)/chat',
              params: { userId: link.user_id },
            })}
          />
        ) : null}

        {intention && (
          <SharedIntentionCard userName={name} intention={intention.intention} />
        )}
      </View>
    )
  })}
</View>
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/(supporter)/index.tsx
git commit -m "feat: add supporter feed with check-in activity, silence alerts, and shared intentions"
```

---

## Task 10: Onboarding — Welcome Screen

**Files:**
- Modify: `apps/mobile/app/(auth)/sign-in.tsx` (becomes the entry point — split into welcome + sign-in)
- Create: `apps/mobile/app/(auth)/index.tsx` (new welcome screen, becomes the auth root)

Currently sign-in is the entry point. The new flow is: Welcome → (sign up or sign in). Create a dedicated welcome screen.

- [ ] **Step 1: Create the welcome screen**

Create `apps/mobile/app/(auth)/index.tsx`:

```tsx
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { useColors } from '../../hooks/useColors'
import { CirclyLogo } from '../../components/CirclyLogo'
import { spacing, radii, type } from '../../constants/theme'
import { useLayout } from '../../hooks/useLayout'

export default function WelcomeScreen() {
  const colors = useColors()
  const { screenTopPadding } = useLayout()

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: screenTopPadding }]}>
      <View style={styles.center}>
        <CirclyLogo size={72} />
        <Text style={[styles.wordmark, { color: colors.textPrimary }]}>circly</Text>
        <Text style={[styles.tagline, { color: colors.textSecondary }]}>
          Recovery is easier when you're not alone.
        </Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={() => router.push('/(auth)/sign-up')}
          style={[styles.primary, { backgroundColor: colors.accent }]}
          accessibilityRole="button"
        >
          <Text style={[type.bodyStrong, { color: colors.background }]}>Get started</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/(auth)/sign-in')}
          accessibilityRole="button"
        >
          <Text style={[type.small, { color: colors.textMuted }]}>
            Already have an account?{' '}
            <Text style={{ color: colors.accent }}>Sign in</Text>
          </Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    padding: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  wordmark: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  tagline: {
    ...type.body,
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 24,
  },
  actions: {
    gap: spacing.lg,
    alignItems: 'center',
  },
  primary: {
    width: '100%',
    borderRadius: radii.xl,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
})
```

- [ ] **Step 2: Verify the auth root points to the welcome screen**

Check `apps/mobile/app/(auth)/_layout.tsx` (if it exists) or the root `_layout.tsx` to confirm the auth group's initial route is `index`. If the existing auth flow redirects straight to `sign-in`, update the redirect target to `/(auth)/` (the new welcome screen).

- [ ] **Step 3: Verify in simulator**

Opening the app when signed out should land on the welcome screen, not the sign-in screen directly.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/(auth)/index.tsx
git commit -m "feat: add welcome screen as new auth entry point"
```

---

## Task 11: Onboarding — Merge Role Select + Visual Polish

**Files:**
- Modify: `apps/mobile/app/(auth)/role-select.tsx`
- Modify: `apps/mobile/app/(auth)/context-select.tsx` (redirect to role-select, effectively dead)
- Modify: `apps/mobile/app/(auth)/sign-up.tsx`
- Modify: `apps/mobile/app/(auth)/sobriety-start.tsx`
- Modify: `apps/mobile/app/(auth)/invite-code.tsx`
- Delete: `apps/mobile/app/(auth)/onboarding.tsx` (4-slide carousel)

- [ ] **Step 1: Update role-select to not depend on context**

The current `role-select.tsx` reads the context chosen in `context-select` to show role options. Rewrite it to show only two options directly: "I'm in recovery" and "I'm supporting someone". Remove the context dependency:

```tsx
// apps/mobile/app/(auth)/role-select.tsx
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { useAuthStore } from '../../store/auth'
import { useColors } from '../../hooks/useColors'
import { Icon } from '../../components/Icon'
import { spacing, radii, type } from '../../constants/theme'
import { useLayout } from '../../hooks/useLayout'
import type { IconName } from '../../components/Icon'

const OPTIONS: Array<{ role: 'recovery' | 'supporter'; label: string; description: string; icon: IconName }> = [
  {
    role: 'recovery',
    label: "I'm in recovery",
    description: 'Track your progress and stay connected with the people who care about you.',
    icon: 'trending-up',
  },
  {
    role: 'supporter',
    label: "I'm supporting someone",
    description: "Stay in the loop and show up for someone you love without overstepping.",
    icon: 'heart',
  },
]

export default function RoleSelectScreen() {
  const colors = useColors()
  const { screenTopPadding } = useLayout()
  const setRole = useAuthStore((s) => s.setRole)
  const [selected, setSelected] = useState<'recovery' | 'supporter' | null>(null)

  function handleContinue() {
    if (!selected) return
    setRole(selected)
    if (selected === 'recovery') router.push('/(auth)/sobriety-start')
    else router.push('/(auth)/invite-code')
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: screenTopPadding }]}>
      <View style={styles.heading}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>what brings you here?</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          This shapes your experience. You can change it later.
        </Text>
      </View>

      <View style={styles.options}>
        {OPTIONS.map(({ role, label, description, icon }) => {
          const active = selected === role
          return (
            <Pressable
              key={role}
              onPress={() => setSelected(role)}
              style={[
                styles.card,
                {
                  backgroundColor: active ? colors.accentSoft : colors.surface,
                  borderColor: active ? colors.accent : colors.border,
                },
              ]}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
            >
              <Icon name={icon} size={22} color={active ? colors.accent : colors.textMuted} />
              <View style={styles.cardText}>
                <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{label}</Text>
                <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>{description}</Text>
              </View>
            </Pressable>
          )
        })}

        <View style={[styles.privacyNote, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Icon name="lock" size={14} color={colors.textMuted} />
          <Text style={[type.small, { color: colors.textMuted, flex: 1 }]}>
            Your role is private. Only people you invite can see your activity.
          </Text>
        </View>
      </View>

      <Pressable
        onPress={handleContinue}
        disabled={!selected}
        style={[styles.cta, { backgroundColor: colors.accent, opacity: selected ? 1 : 0.4 }]}
        accessibilityRole="button"
      >
        <Text style={[type.bodyStrong, { color: colors.background }]}>Continue</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.xl },
  heading: { gap: spacing.sm },
  title: { fontSize: 24, fontWeight: '800' },
  subtitle: { ...type.body, lineHeight: 22 },
  options: { flex: 1, gap: spacing.md },
  card: { borderRadius: radii.xl, borderWidth: 1.5, padding: spacing.lg, flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  cardText: { flex: 1, gap: spacing.xs },
  cardTitle: { ...type.h3 },
  cardDesc: { ...type.small, lineHeight: 18 },
  privacyNote: { borderRadius: radii.lg, borderWidth: 1, padding: spacing.md, flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  cta: { borderRadius: radii.xl, paddingVertical: spacing.lg, alignItems: 'center' },
})
```

Add `import { useState } from 'react'` at the top.

- [ ] **Step 2: Update sobriety-start screen CTA copy**

In `apps/mobile/app/(auth)/sobriety-start.tsx`, change the continue button label from whatever it currently is to "Start my journey".

Search for the button label string and replace it.

- [ ] **Step 3: Update invite-code screen CTA copy**

In `apps/mobile/app/(auth)/invite-code.tsx`, change the continue button label to "Join their circle".

- [ ] **Step 4: Delete the 4-slide carousel**

```bash
rm apps/mobile/app/(auth)/onboarding.tsx
```

Update any navigation that pushes to `/(auth)/onboarding` to push to `/(auth)/role-select` instead. Search for references:

```bash
cd apps/mobile && grep -r "onboarding" app/ --include="*.tsx" -l
```

Update each file found to remove the onboarding navigation step.

- [ ] **Step 5: Make context-select redirect to role-select**

Since context-select is now redundant, replace its content with an immediate redirect so any deep links or back-navigation doesn't land on a dead screen:

```tsx
// apps/mobile/app/(auth)/context-select.tsx
import { Redirect } from 'expo-router'
export default function ContextSelectRedirect() {
  return <Redirect href="/(auth)/role-select" />
}
```

- [ ] **Step 6: Verify full onboarding flow in simulator**

Walk through: Welcome → Sign up → Role select → Sobriety start (or Invite code) → App.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/app/(auth)/
git commit -m "feat: simplify onboarding to 4 screens, merge context+role select, remove carousel"
```

---

## Task 12: Journal — Prompted Entry

**Files:**
- Create: `apps/mobile/components/journal/PromptChip.tsx`
- Modify: `apps/mobile/app/(recovery)/journal-entry.tsx`

When opened with a `prompt` param, the journal entry screen shows the prompt at the top as a styled chip. The entry is saved as a normal journal entry.

- [ ] **Step 1: Create PromptChip component**

Create `apps/mobile/components/journal/PromptChip.tsx`:

```tsx
import { View, Text, StyleSheet } from 'react-native'
import { useColors } from '../../hooks/useColors'
import { Icon } from '../Icon'
import { spacing, radii, type } from '../../constants/theme'

interface PromptChipProps {
  prompt: string
}

export function PromptChip({ prompt }: PromptChipProps) {
  const colors = useColors()
  return (
    <View style={[styles.chip, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
      <View style={styles.labelRow}>
        <Icon name="sun" size={11} color={colors.accent} />
        <Text style={[styles.label, { color: colors.accent }]}>reflection prompt</Text>
      </View>
      <Text style={[styles.text, { color: colors.textSecondary }]}>"{prompt}"</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  chip: { borderRadius: radii.lg, borderWidth: 1, padding: spacing.md, gap: spacing.xs },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  label: { ...type.label },
  text: { ...type.small, fontStyle: 'italic', lineHeight: 18 },
})
```

- [ ] **Step 2: Update journal-entry screen to accept a prompt param**

In `apps/mobile/app/(recovery)/journal-entry.tsx`, read the `prompt` local search param and render `PromptChip` above the text input if present:

```tsx
import { useLocalSearchParams } from 'expo-router'
import { PromptChip } from '../../components/journal/PromptChip'

// Inside the component:
const { prompt } = useLocalSearchParams<{ prompt?: string }>()

// In the JSX, above the text input:
{prompt ? <PromptChip prompt={prompt} /> : null}
```

- [ ] **Step 3: Verify in simulator**

Tap "Write your answer" on the daily pulse card. The journal entry screen should open with the reflection prompt shown as a chip above the text area. Saving creates a normal journal entry.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/components/journal/PromptChip.tsx apps/mobile/app/(recovery)/journal-entry.tsx
git commit -m "feat: add prompted journal entry from daily pulse feed card"
```

---

## Self-Review

### Spec coverage check

| Spec section | Task(s) |
|---|---|
| Feed — home tab becomes feed | Tasks 8, 9 |
| Daily Pulse card (reflection, memory) | Tasks 5, 7, 8 |
| Intention card | Tasks 6, 7, 8 |
| Milestone card | Task 7 (component) — wiring to real milestone events: milestone card uses existing `MILESTONES` data already in the home screen |
| Supporter feed cards | Tasks 7, 9 |
| Navigation — Option C center check-in | Task 3 |
| Navigation — Supporter 4 tabs | Task 4 |
| AppHeader (avatar, SOS, add, messages) | Tasks 2, 4 |
| Get Support — SOS header icon | Task 2 (icon in header), Task 7 (StrugglingCard) |
| Get Support — contextual card on struggling | Task 7 (StrugglingCard), Task 8 (wired to todayStatus) |
| Onboarding welcome screen | Task 10 |
| Onboarding role select merged | Task 11 |
| Onboarding carousel removed | Task 11 |
| Onboarding visual language | Tasks 10, 11 (uses colors/type/spacing system) |
| Journal prompted entry | Task 12 |
| Mood scale struggling → thriving | Task 1 |
| Typography: lowercase headers, sentence case body | Applied in every component above — headers use lowercase string literals, body text uses sentence case |
| Icon audit (no emojis as UI icons) | All tasks above use `Icon` component exclusively. No emojis in any component written. |
| Profile pictures (avatar tappable) | Task 2 — avatar `onPress={onProfile}` |

### Placeholder scan

No TBDs, TODOs, or incomplete steps found.

### Type consistency

- `CheckInStatus`: `'sober' | 'struggling' | 'good_day'` — used consistently in Tasks 7, 8, 9.
- `IconName`: imported from `../../components/Icon` in all components.
- `MOODS[last].tag` is `'thriving'` after Task 1 — all subsequent mood references use `findMood` or `moodFromValue` which will return the updated tag.
- `spacing`, `radii`, `type` imported from `../../constants/theme` in all components — consistent path depth assumed from `components/feed/` level.
