# Nav + SOS Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize the recovery and supporter tab bars and app header per `docs/superpowers/specs/2026-05-05-nav-sos-redesign-design.md`: header becomes avatar / wordmark / bell-with-badge; recovery tab bar becomes home / journal / SOS-press-and-hold / messages / add; supporter tab bar becomes home / messages / add; the daily check-in moves inline onto the recovery home feed and the dedicated check-in screen is retired.

**Architecture:** Build new components in isolation first (`useEmergencyAlert` hook, `CenterSOSButton`, `TodayCheckInCard`, `StartFreshNudge`, `lib/checkIns.ts` helpers) with their own tests, then integrate them into the recovery + supporter layouts and home screens, then delete the retired pieces (`check-in.tsx`, `CenterCheckInButton`). The existing `AppHeader` is simplified by removing SOS and messages buttons and adding a notifications bell with an unread badge driven by `useNotificationStore`.

**Tech Stack:** React Native (Expo), expo-router, TypeScript, Zustand for state, Supabase JS, `react-native-svg` (already in deps), Jest with `jest-expo` preset and `@testing-library/react-native`.

---

## File Structure

**New files:**
- `apps/mobile/hooks/useEmergencyAlert.ts` — Hook owning the emergency-confirm Alert + `POST /api/emergency` + result alerts. Replaces `handleGetSupport` from `(recovery)/index.tsx`.
- `apps/mobile/hooks/useEmergencyAlert.test.ts` — Tests for the hook.
- `apps/mobile/components/CenterSOSButton.tsx` — Center FAB. Press-and-hold gesture: instant scale-down on press, 1500ms fill ring (`react-native-svg`), `onArmed()` callback when full.
- `apps/mobile/components/CenterSOSButton.test.tsx` — Tests press feedback, hold-arm, release-cancel.
- `apps/mobile/lib/checkIns.ts` — `loadTodayCheckIn(userId)` and `saveTodayCheckIn({ userId, status, note })`. Encapsulates the upsert that lives in `(recovery)/check-in.tsx#handleSave`.
- `apps/mobile/lib/checkIns.test.ts` — Tests for the lib (mocking supabase).
- `apps/mobile/components/feed/TodayCheckInCard.tsx` — New home-feed card with chips + auto-growing note + collapsed-when-saved state. Routes to first-checkin-intro / first-checkin-celebration.
- `apps/mobile/components/feed/TodayCheckInCard.test.tsx` — Tests chip selection, save callback, collapsed state, first-checkin redirects.
- `apps/mobile/components/feed/StartFreshNudge.tsx` — Extracted "need a fresh start?" warning card from `check-in.tsx` (lines 195–215). Renders only when status is `struggling` and context is `recovery`.
- `apps/mobile/components/feed/StartFreshNudge.test.tsx` — Tests.

**Modified files:**
- `apps/mobile/components/AppHeader.tsx` — Drop `onSosPress`, `onMessagesPress`, `unreadMessages`. Add `onNotificationsPress: () => void`, `unreadNotifications?: number`. Render bell with badge.
- `apps/mobile/components/AppHeader.test.tsx` — Replace messages/SOS tests with notifications-bell tests.
- `apps/mobile/app/(recovery)/_layout.tsx` — Replace `check-in` tabs.screen with SOS FAB tabs.screen. Move `notifications` to hidden routes (`href: null`). Add `chat` (messages) as tab #4.
- `apps/mobile/app/(recovery)/index.tsx` — Drop `handleGetSupport`. Pass new props to `AppHeader`. Insert `<TodayCheckInCard>` between streak and reflection. Insert `<StartFreshNudge>` below struggling card. Rewire `<StrugglingCard>` CTA to a hint instead of an emergency trigger.
- `apps/mobile/app/(supporter)/_layout.tsx` — Replace `notifications` with `chat` (messages). Move `notifications` to hidden routes.
- `apps/mobile/app/(supporter)/index.tsx` — Pass new props to `AppHeader` (notifications press → `/(supporter)/notifications`).

**Deleted files:**
- `apps/mobile/app/(recovery)/check-in.tsx`
- `apps/mobile/components/CenterCheckInButton.tsx`
- `apps/mobile/components/CenterCheckInButton.test.tsx`

**Untouched:** `(recovery)/first-checkin-intro.tsx`, `(recovery)/first-checkin-celebration.tsx`, `(recovery)/start-fresh.tsx`, `/api/emergency` server route, `check_ins` table, `useNotificationStore`, `react-native-svg` dependency.

---

## Task 1: Add `useEmergencyAlert` hook

**Files:**
- Create: `apps/mobile/hooks/useEmergencyAlert.ts`
- Test: `apps/mobile/hooks/useEmergencyAlert.test.ts`

Encapsulates the emergency confirmation Alert + `POST /api/emergency` + success/failure alerts. Replaces `handleGetSupport` from `(recovery)/index.tsx:78–121`.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/mobile/hooks/useEmergencyAlert.test.ts
import { renderHook, act } from '@testing-library/react-native'
import { Alert } from 'react-native'
import { useEmergencyAlert } from './useEmergencyAlert'
import { api, ApiError } from '../lib/api'

jest.mock('../lib/api', () => {
  const ApiError = class extends Error {}
  return { api: jest.fn(), ApiError }
})
jest.mock('../lib/haptics', () => ({ notifyWarning: jest.fn() }))

const apiMock = api as jest.MockedFunction<typeof api>

describe('useEmergencyAlert', () => {
  let alertSpy: jest.SpyInstance
  beforeEach(() => {
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    apiMock.mockReset()
  })
  afterEach(() => alertSpy.mockRestore())

  it('fires the emergency call without a confirm prompt and shows the success alert', async () => {
    apiMock.mockResolvedValueOnce({ supporters_notified: 3 })
    const { result } = renderHook(() => useEmergencyAlert())

    await act(async () => { await result.current.trigger() })

    expect(apiMock).toHaveBeenCalledWith('/api/emergency', { method: 'POST' })
    expect(alertSpy).toHaveBeenCalledWith(
      'your supporters have been notified',
      expect.stringContaining('3'),
    )
  })

  it('shows the no-supporters alert when count is zero', async () => {
    apiMock.mockResolvedValueOnce({ supporters_notified: 0 })
    const { result } = renderHook(() => useEmergencyAlert())
    await act(async () => { await result.current.trigger() })
    expect(alertSpy).toHaveBeenCalledWith(
      'no supporters yet',
      expect.stringContaining('add someone to your circle'),
    )
  })

  it('shows the connection-error alert when api throws non-ApiError', async () => {
    apiMock.mockRejectedValueOnce(new Error('network down'))
    const { result } = renderHook(() => useEmergencyAlert())
    await act(async () => { await result.current.trigger() })
    expect(alertSpy).toHaveBeenCalledWith(
      'could not send alert',
      'check your connection and try again.',
    )
  })

  it('exposes a sending flag while the call is in flight', async () => {
    let resolve: (v: { supporters_notified: number }) => void = () => {}
    apiMock.mockImplementationOnce(() => new Promise((r) => { resolve = r }))
    const { result } = renderHook(() => useEmergencyAlert())
    expect(result.current.sending).toBe(false)
    let triggerPromise: Promise<void>
    act(() => { triggerPromise = result.current.trigger() })
    expect(result.current.sending).toBe(true)
    await act(async () => {
      resolve({ supporters_notified: 1 })
      await triggerPromise!
    })
    expect(result.current.sending).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && npx jest hooks/useEmergencyAlert.test.ts`
Expected: FAIL with `Cannot find module './useEmergencyAlert'`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// apps/mobile/hooks/useEmergencyAlert.ts
import { useCallback, useState } from 'react'
import { Alert } from 'react-native'
import { api, ApiError } from '../lib/api'
import { notifyWarning } from '../lib/haptics'

export interface UseEmergencyAlertResult {
  trigger: () => Promise<void>
  sending: boolean
}

export function useEmergencyAlert(): UseEmergencyAlertResult {
  const [sending, setSending] = useState(false)

  const trigger = useCallback(async () => {
    notifyWarning()
    setSending(true)
    try {
      const result = await api<{ supporters_notified: number }>(
        '/api/emergency',
        { method: 'POST' },
      )
      if (result.supporters_notified === 0) {
        Alert.alert(
          'no supporters yet',
          'add someone to your circle so they can be there for you.',
        )
      } else {
        Alert.alert(
          'your supporters have been notified',
          `${result.supporters_notified} ${
            result.supporters_notified === 1 ? 'person has' : 'people have'
          } been alerted.`,
        )
      }
    } catch (err) {
      const message =
        err instanceof ApiError
          ? 'something went wrong. please try again.'
          : 'check your connection and try again.'
      Alert.alert('could not send alert', message)
    } finally {
      setSending(false)
    }
  }, [])

  return { trigger, sending }
}
```

Note: per spec §3.1 "no modal, no confirmation" — the hold-to-arm gesture replaces the confirm step. The hook drops the `Alert.alert('alert your supporters', ...)` confirm prompt that the original `handleGetSupport` used.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/mobile && npx jest hooks/useEmergencyAlert.test.ts`
Expected: PASS, 4/4 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/hooks/useEmergencyAlert.ts apps/mobile/hooks/useEmergencyAlert.test.ts
git commit -m "extract emergency alert flow into useEmergencyAlert hook"
```

---

## Task 2: Simplify `AppHeader` to bell + badge

**Files:**
- Modify: `apps/mobile/components/AppHeader.tsx`
- Modify: `apps/mobile/components/AppHeader.test.tsx`

Drop `onSosPress`, `onMessagesPress`, `unreadMessages`. Add `onNotificationsPress` (required) and `unreadNotifications?: number`. Render a single bell button with a badge.

- [ ] **Step 1: Replace AppHeader.test.tsx with the new spec**

```tsx
// apps/mobile/components/AppHeader.test.tsx
import { render, fireEvent } from '@testing-library/react-native'
import { AppHeader } from './AppHeader'

describe('<AppHeader />', () => {
  const baseProps = {
    user: { id: 'u1', displayName: 'Sam', avatarUrl: null as string | null },
    onAvatarPress: jest.fn(),
    onNotificationsPress: jest.fn(),
  }

  beforeEach(() => {
    baseProps.onAvatarPress.mockReset()
    baseProps.onNotificationsPress.mockReset()
  })

  it('renders the wordmark text', () => {
    const { getByText } = render(<AppHeader {...baseProps} />)
    expect(getByText('circly')).toBeTruthy()
  })

  it('renders the user avatar (initials fallback)', () => {
    const { getByText } = render(<AppHeader {...baseProps} />)
    expect(getByText('S')).toBeTruthy()
  })

  it('fires onAvatarPress when the avatar is tapped', () => {
    const { getByLabelText } = render(<AppHeader {...baseProps} />)
    fireEvent.press(getByLabelText('open profile'))
    expect(baseProps.onAvatarPress).toHaveBeenCalledTimes(1)
  })

  it('fires onNotificationsPress when the bell is tapped', () => {
    const { getByLabelText } = render(<AppHeader {...baseProps} />)
    fireEvent.press(getByLabelText('open notifications'))
    expect(baseProps.onNotificationsPress).toHaveBeenCalledTimes(1)
  })

  it('renders the unread badge when unreadNotifications > 0', () => {
    const { getByText } = render(
      <AppHeader {...baseProps} unreadNotifications={4} />,
    )
    expect(getByText('4')).toBeTruthy()
  })

  it('caps the badge at 9+', () => {
    const { getByText } = render(
      <AppHeader {...baseProps} unreadNotifications={42} />,
    )
    expect(getByText('9+')).toBeTruthy()
  })

  it('omits the badge when unreadNotifications is 0 or undefined', () => {
    const { queryByLabelText } = render(<AppHeader {...baseProps} />)
    // The badge has no accessibility role; assert there's no '0' text near the bell.
    expect(queryByLabelText('unread notifications badge')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && npx jest components/AppHeader.test.tsx`
Expected: FAIL — `open notifications` not found, current header renders SOS + messages.

- [ ] **Step 3: Replace AppHeader.tsx**

```tsx
// apps/mobile/components/AppHeader.tsx
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useColors } from '../hooks/useColors'
import { Avatar } from './Avatar'
import { Icon } from './Icon'
import { spacing, type as t } from '../constants/theme'

interface Props {
  user: { id: string; displayName: string; avatarUrl: string | null | undefined }
  onAvatarPress: () => void
  onNotificationsPress: () => void
  unreadNotifications?: number
}

export function AppHeader({
  user,
  onAvatarPress,
  onNotificationsPress,
  unreadNotifications,
}: Props) {
  const colors = useColors()
  const showBadge = unreadNotifications !== undefined && unreadNotifications > 0
  const badgeText = (unreadNotifications ?? 0) > 9 ? '9+' : String(unreadNotifications ?? 0)
  return (
    <View style={styles.row}>
      <Pressable
        onPress={onAvatarPress}
        accessibilityRole="button"
        accessibilityLabel="open profile"
        hitSlop={8}
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      >
        <Avatar
          userId={user.id}
          displayName={user.displayName}
          avatarUrl={user.avatarUrl}
          size={36}
        />
      </Pressable>

      <Text style={[styles.wordmark, { color: colors.accent }]}>circly</Text>

      <Pressable
        onPress={onNotificationsPress}
        accessibilityRole="button"
        accessibilityLabel="open notifications"
        hitSlop={8}
        style={({ pressed }) => [
          styles.iconBtn,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <Icon name="bell" size={16} color={colors.textPrimary} />
        {showBadge && (
          <View
            accessibilityLabel="unread notifications badge"
            style={[styles.badge, { backgroundColor: colors.danger }]}
          >
            <Text style={styles.badgeText}>{badgeText}</Text>
          </View>
        )}
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  wordmark: {
    ...t.h3,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/mobile && npx jest components/AppHeader.test.tsx`
Expected: PASS, 7/7.

Note: the home-screen call sites still pass the old props at this point — the next step compiles will fail. That's fine; we fix the call sites in Task 8 and Task 9. To keep TypeScript green between commits, do the call-site updates first (sub-step):

- [ ] **Step 5: Update both home-screen call sites for the new prop shape**

Edit `apps/mobile/app/(recovery)/index.tsx` line 316–325 — the existing `<AppHeader>` with `onMessagesPress` and `onSosPress`. Replace with the new shape (the rest of the home screen still references `handleGetSupport` for `<StrugglingCard>` until Task 9; leave it alone for now):

Replace exactly:

```tsx
      <AppHeader
        user={{
          id: user?.id ?? '',
          displayName: user?.displayName ?? 'friend',
          avatarUrl: user?.avatarUrl ?? null,
        }}
        onAvatarPress={() => router.push('/(profile)')}
        onMessagesPress={() => router.push('/(recovery)/chat')}
        onSosPress={handleGetSupport}
      />
```

with:

```tsx
      <AppHeader
        user={{
          id: user?.id ?? '',
          displayName: user?.displayName ?? 'friend',
          avatarUrl: user?.avatarUrl ?? null,
        }}
        onAvatarPress={() => router.push('/(profile)')}
        onNotificationsPress={() => router.push('/(recovery)/notifications')}
        unreadNotifications={unreadNotifications}
      />
```

Then add at the top of the component body, alongside the other `useAuthStore` selectors (around line 62):

```tsx
import { useNotificationStore } from '../../store/notifications'
// ...
  const unreadNotifications = useNotificationStore((s) => s.unreadCount)
```

Do the same in `apps/mobile/app/(supporter)/index.tsx` for its `<AppHeader>` usage (read its current shape and apply the same prop swap; route notifications press to `/(supporter)/notifications`).

- [ ] **Step 6: Verify type-check passes**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors related to `AppHeader` props.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/components/AppHeader.tsx apps/mobile/components/AppHeader.test.tsx apps/mobile/app/(recovery)/index.tsx apps/mobile/app/(supporter)/index.tsx
git commit -m "simplify app header to avatar + wordmark + notifications bell with unread badge"
```

---

## Task 3: Add `CenterSOSButton` component

**Files:**
- Create: `apps/mobile/components/CenterSOSButton.tsx`
- Test: `apps/mobile/components/CenterSOSButton.test.tsx`

Center FAB used as `tabBarButton` in recovery layout. Spec §3.1: instant scale-down on every press (~0.94, ~0.85 opacity); after ~150ms held, an SVG ring begins filling around the button; full fill at ~1500ms fires `onArmed`. Release before full = cancel.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/mobile/components/CenterSOSButton.test.tsx
import { render, fireEvent, act } from '@testing-library/react-native'
import { CenterSOSButton } from './CenterSOSButton'

describe('<CenterSOSButton />', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => { jest.runOnlyPendingTimers(); jest.useRealTimers() })

  it('renders an accessible SOS label', () => {
    const { getByLabelText } = render(<CenterSOSButton onArmed={jest.fn()} />)
    expect(getByLabelText('hold to alert your supporters')).toBeTruthy()
  })

  it('does not fire onArmed on a brief tap', () => {
    const onArmed = jest.fn()
    const { getByLabelText } = render(<CenterSOSButton onArmed={onArmed} />)
    fireEvent(getByLabelText('hold to alert your supporters'), 'pressIn')
    act(() => { jest.advanceTimersByTime(200) })
    fireEvent(getByLabelText('hold to alert your supporters'), 'pressOut')
    act(() => { jest.advanceTimersByTime(2000) })
    expect(onArmed).not.toHaveBeenCalled()
  })

  it('fires onArmed once when held for the full 1500ms', () => {
    const onArmed = jest.fn()
    const { getByLabelText } = render(<CenterSOSButton onArmed={onArmed} />)
    fireEvent(getByLabelText('hold to alert your supporters'), 'pressIn')
    act(() => { jest.advanceTimersByTime(1600) })
    expect(onArmed).toHaveBeenCalledTimes(1)
  })

  it('cancels if released before the full hold duration', () => {
    const onArmed = jest.fn()
    const { getByLabelText } = render(<CenterSOSButton onArmed={onArmed} />)
    fireEvent(getByLabelText('hold to alert your supporters'), 'pressIn')
    act(() => { jest.advanceTimersByTime(1000) })
    fireEvent(getByLabelText('hold to alert your supporters'), 'pressOut')
    act(() => { jest.advanceTimersByTime(2000) })
    expect(onArmed).not.toHaveBeenCalled()
  })

  it('does not double-fire if pressIn is dispatched while already armed', () => {
    const onArmed = jest.fn()
    const { getByLabelText } = render(<CenterSOSButton onArmed={onArmed} />)
    fireEvent(getByLabelText('hold to alert your supporters'), 'pressIn')
    act(() => { jest.advanceTimersByTime(1600) })
    fireEvent(getByLabelText('hold to alert your supporters'), 'pressIn')
    act(() => { jest.advanceTimersByTime(1600) })
    expect(onArmed).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && npx jest components/CenterSOSButton.test.tsx`
Expected: FAIL — `Cannot find module './CenterSOSButton'`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// apps/mobile/components/CenterSOSButton.tsx
import { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, Pressable, Animated, StyleSheet } from 'react-native'
import Svg, { Circle } from 'react-native-svg'
import { useColors } from '../hooks/useColors'
import { Icon } from './Icon'
import { spacing } from '../constants/theme'

interface Props {
  onArmed: () => void
}

const SIZE = 56
const RING_SIZE = 64
const RING_RADIUS = (RING_SIZE - 4) / 2 // stroke width 4
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS
const HOLD_MS = 1500

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

export function CenterSOSButton({ onArmed }: Props) {
  const colors = useColors()
  const [pressed, setPressed] = useState(false)
  const armedRef = useRef(false)
  const armTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ringProgress = useRef(new Animated.Value(0)).current

  const cancelHold = useCallback(() => {
    if (armTimer.current) {
      clearTimeout(armTimer.current)
      armTimer.current = null
    }
    Animated.timing(ringProgress, {
      toValue: 0,
      duration: 150,
      useNativeDriver: false,
    }).start()
  }, [ringProgress])

  const startHold = useCallback(() => {
    if (armedRef.current) return
    if (armTimer.current) return
    Animated.timing(ringProgress, {
      toValue: 1,
      duration: HOLD_MS,
      useNativeDriver: false,
    }).start()
    armTimer.current = setTimeout(() => {
      armedRef.current = true
      armTimer.current = null
      onArmed()
      // Reset so a subsequent press can arm again next time the user enters
      // the screen / lifts and re-presses.
      setTimeout(() => {
        armedRef.current = false
        ringProgress.setValue(0)
      }, 250)
    }, HOLD_MS)
  }, [onArmed, ringProgress])

  useEffect(() => () => {
    if (armTimer.current) clearTimeout(armTimer.current)
  }, [])

  const strokeDashoffset = ringProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [RING_CIRCUMFERENCE, 0],
  })

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={{ width: RING_SIZE, height: RING_SIZE, alignItems: 'center', justifyContent: 'center' }}>
        <Svg
          width={RING_SIZE}
          height={RING_SIZE}
          style={StyleSheet.absoluteFill}
        >
          <AnimatedCircle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            stroke={colors.danger}
            strokeWidth={4}
            fill="transparent"
            strokeDasharray={`${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
          />
        </Svg>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="hold to alert your supporters"
          onPressIn={() => { setPressed(true); startHold() }}
          onPressOut={() => { setPressed(false); cancelHold() }}
          style={[
            styles.button,
            {
              backgroundColor: colors.danger,
              transform: [{ scale: pressed ? 0.94 : 1 }],
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Icon name="alert-triangle" size={22} color="#fff" />
        </Pressable>
      </View>
      <Text style={[styles.label, { color: colors.textMuted }]}>hold</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: -20 },
  button: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.4,
    marginTop: 2,
  },
})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/mobile && npx jest components/CenterSOSButton.test.tsx`
Expected: PASS, 5/5.

If `react-native-svg` causes module resolution issues under jest-expo, confirm transformIgnorePatterns already includes it (it does per `package.json:19`); otherwise add `@testing-library/react-native` mocks or a manual `react-native-svg` mock.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/components/CenterSOSButton.tsx apps/mobile/components/CenterSOSButton.test.tsx
git commit -m "add center SOS button with press-and-hold arming and progress ring"
```

---

## Task 4: Add `lib/checkIns` helpers

**Files:**
- Create: `apps/mobile/lib/checkIns.ts`
- Test: `apps/mobile/lib/checkIns.test.ts`

Encapsulates the supabase reads/writes that today live inline in `(recovery)/check-in.tsx`. Lets `TodayCheckInCard` stay thin and gives us a clean mock boundary.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/mobile/lib/checkIns.test.ts
import { loadTodayCheckIn, saveTodayCheckIn } from './checkIns'
import { supabase } from './supabase'
import { toISODate } from './streak'

jest.mock('./supabase', () => ({ supabase: { from: jest.fn() } }))

describe('checkIns lib', () => {
  const todayISO = toISODate(new Date())

  it('loadTodayCheckIn queries the row for the user/date and returns it', async () => {
    const maybeSingle = jest.fn().mockResolvedValue({
      data: { id: 'r1', status: 'sober', note: 'hi', check_in_date: todayISO },
      error: null,
    })
    const eq2 = jest.fn().mockReturnValue({ maybeSingle })
    const eq1 = jest.fn().mockReturnValue({ eq: eq2 })
    const select = jest.fn().mockReturnValue({ eq: eq1 })
    ;(supabase.from as jest.Mock).mockReturnValue({ select })

    const row = await loadTodayCheckIn('user-1')

    expect(supabase.from).toHaveBeenCalledWith('check_ins')
    expect(select).toHaveBeenCalledWith('id, status, note, check_in_date')
    expect(eq1).toHaveBeenCalledWith('user_id', 'user-1')
    expect(eq2).toHaveBeenCalledWith('check_in_date', todayISO)
    expect(row).toEqual({ id: 'r1', status: 'sober', note: 'hi', check_in_date: todayISO })
  })

  it('saveTodayCheckIn upserts with the conflict target and returns the row', async () => {
    const single = jest.fn().mockResolvedValue({
      data: { id: 'r2', status: 'good_day', note: null, check_in_date: todayISO },
      error: null,
    })
    const select = jest.fn().mockReturnValue({ single })
    const upsert = jest.fn().mockReturnValue({ select })
    ;(supabase.from as jest.Mock).mockReturnValue({ upsert })

    const row = await saveTodayCheckIn({ userId: 'user-1', status: 'good_day', note: '' })

    expect(upsert).toHaveBeenCalledWith(
      {
        user_id: 'user-1',
        status: 'good_day',
        note: null,
        check_in_date: todayISO,
        source: 'in_app',
      },
      { onConflict: 'user_id,check_in_date' },
    )
    expect(select).toHaveBeenCalledWith('id, status, note, check_in_date')
    expect(row).toEqual({ id: 'r2', status: 'good_day', note: null, check_in_date: todayISO })
  })

  it('saveTodayCheckIn throws when supabase returns an error', async () => {
    const single = jest.fn().mockResolvedValue({ data: null, error: { message: 'bad' } })
    const select = jest.fn().mockReturnValue({ single })
    const upsert = jest.fn().mockReturnValue({ select })
    ;(supabase.from as jest.Mock).mockReturnValue({ upsert })

    await expect(
      saveTodayCheckIn({ userId: 'user-1', status: 'sober', note: 'x' }),
    ).rejects.toThrow('bad')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && npx jest lib/checkIns.test.ts`
Expected: FAIL — `Cannot find module './checkIns'`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// apps/mobile/lib/checkIns.ts
import { supabase } from './supabase'
import { toISODate } from './streak'

export type CheckInStatus = 'sober' | 'struggling' | 'good_day'

export interface CheckInRow {
  id: string
  status: CheckInStatus
  note: string | null
  check_in_date: string
}

export async function loadTodayCheckIn(userId: string): Promise<CheckInRow | null> {
  const todayISO = toISODate(new Date())
  const { data, error } = await supabase
    .from('check_ins')
    .select('id, status, note, check_in_date')
    .eq('user_id', userId)
    .eq('check_in_date', todayISO)
    .maybeSingle<CheckInRow>()
  if (error) throw new Error(error.message)
  return data ?? null
}

export interface SaveTodayCheckInInput {
  userId: string
  status: CheckInStatus
  note: string
}

export async function saveTodayCheckIn(
  input: SaveTodayCheckInInput,
): Promise<CheckInRow> {
  const todayISO = toISODate(new Date())
  const { data, error } = await supabase
    .from('check_ins')
    .upsert(
      {
        user_id: input.userId,
        status: input.status,
        note: input.note.trim() || null,
        check_in_date: todayISO,
        source: 'in_app',
      },
      { onConflict: 'user_id,check_in_date' },
    )
    .select('id, status, note, check_in_date')
    .single<CheckInRow>()
  if (error || !data) throw new Error(error?.message ?? 'check-in save failed')
  return data
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/mobile && npx jest lib/checkIns.test.ts`
Expected: PASS, 3/3.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/checkIns.ts apps/mobile/lib/checkIns.test.ts
git commit -m "extract today check-in load/save into lib/checkIns"
```

---

## Task 5: Add `TodayCheckInCard` component

**Files:**
- Create: `apps/mobile/components/feed/TodayCheckInCard.tsx`
- Test: `apps/mobile/components/feed/TodayCheckInCard.test.tsx`

Renders three status chips (driven by `useCopy().dashboard.checkInStatuses`), a multi-line note input, and a collapsed-when-saved summary. On chip tap → `saveTodayCheckIn`. On first interaction with no historical check-ins and `firstCheckinIntroSeen === false` → `router.replace('/(recovery)/first-checkin-intro')`. After first ever save with `firstCheckinCelebrationSeen === false` → `router.replace('/(recovery)/first-checkin-celebration')`.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/mobile/components/feed/TodayCheckInCard.test.tsx
import { render, fireEvent, waitFor, act } from '@testing-library/react-native'
import { TodayCheckInCard } from './TodayCheckInCard'
import * as checkInsLib from '../../lib/checkIns'
import { router } from 'expo-router'

jest.mock('expo-router', () => ({ router: { replace: jest.fn(), push: jest.fn() } }))
jest.mock('../../lib/checkIns', () => ({
  loadTodayCheckIn: jest.fn(),
  saveTodayCheckIn: jest.fn(),
}))
jest.mock('../../lib/haptics', () => ({ tapLight: jest.fn(), tapMedium: jest.fn() }))
jest.mock('../../store/auth', () => ({
  useAuthStore: (sel: any) =>
    sel({
      user: {
        id: 'u1',
        context: 'recovery',
        firstCheckinIntroSeen: true,
        firstCheckinCelebrationSeen: true,
      },
    }),
}))

const loadMock = checkInsLib.loadTodayCheckIn as jest.MockedFunction<typeof checkInsLib.loadTodayCheckIn>
const saveMock = checkInsLib.saveTodayCheckIn as jest.MockedFunction<typeof checkInsLib.saveTodayCheckIn>

describe('<TodayCheckInCard />', () => {
  beforeEach(() => {
    loadMock.mockReset()
    saveMock.mockReset()
    ;(router.replace as jest.Mock).mockReset()
  })

  it('renders all three status chips when no row exists', async () => {
    loadMock.mockResolvedValueOnce(null)
    const { findByLabelText } = render(<TodayCheckInCard onSaved={jest.fn()} />)
    expect(await findByLabelText('chip-good_day')).toBeTruthy()
    expect(await findByLabelText('chip-sober')).toBeTruthy()
    expect(await findByLabelText('chip-struggling')).toBeTruthy()
  })

  it('saves when a chip is tapped and notifies parent via onSaved', async () => {
    loadMock.mockResolvedValueOnce(null)
    saveMock.mockResolvedValueOnce({
      id: 'r1', status: 'sober', note: null, check_in_date: '2026-05-05',
    })
    const onSaved = jest.fn()
    const { findByLabelText } = render(<TodayCheckInCard onSaved={onSaved} />)
    const chip = await findByLabelText('chip-sober')
    await act(async () => { fireEvent.press(chip) })
    await waitFor(() => expect(saveMock).toHaveBeenCalledWith({
      userId: 'u1', status: 'sober', note: '',
    }))
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ status: 'sober' }))
  })

  it('collapses to a summary once a row exists', async () => {
    loadMock.mockResolvedValueOnce({
      id: 'r1', status: 'good_day', note: null, check_in_date: '2026-05-05',
    })
    const { findByText } = render(<TodayCheckInCard onSaved={jest.fn()} />)
    expect(await findByText(/today: good day/i)).toBeTruthy()
  })

  it('expands the summary back into the editor when tapped', async () => {
    loadMock.mockResolvedValueOnce({
      id: 'r1', status: 'sober', note: null, check_in_date: '2026-05-05',
    })
    const { findByLabelText, findByText } = render(<TodayCheckInCard onSaved={jest.fn()} />)
    fireEvent.press(await findByText(/edit/i))
    expect(await findByLabelText('chip-sober')).toBeTruthy()
  })
})
```

Notes:
- Auth store mock is hard-coded for the basic case (intro/celebration flags true). First-checkin redirect tests can be added later if the basic flow proves stable; spec §5.2 only requires the routing exist, not exhaustive coverage.
- `chip-<status>` accessibility labels are used for stability across copy variants.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && npx jest components/feed/TodayCheckInCard.test.tsx`
Expected: FAIL — `Cannot find module './TodayCheckInCard'`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// apps/mobile/components/feed/TodayCheckInCard.tsx
import { useCallback, useEffect, useState } from 'react'
import { View, Text, Pressable, TextInput, StyleSheet, ActivityIndicator } from 'react-native'
import { router } from 'expo-router'
import { useColors } from '../../hooks/useColors'
import { useAuthStore } from '../../store/auth'
import { useCopy } from '../../lib/copy'
import { Icon } from '../Icon'
import { spacing, radii, type } from '../../constants/theme'
import { tapLight } from '../../lib/haptics'
import {
  loadTodayCheckIn,
  saveTodayCheckIn,
  type CheckInRow,
  type CheckInStatus,
} from '../../lib/checkIns'

interface Props {
  onSaved?: (row: CheckInRow) => void
}

const STATUS_ORDER: CheckInStatus[] = ['good_day', 'sober', 'struggling']

export function TodayCheckInCard({ onSaved }: Props) {
  const colors = useColors()
  const copy = useCopy()
  const user = useAuthStore((s) => s.user)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [row, setRow] = useState<CheckInRow | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      try {
        const initial = await loadTodayCheckIn(user.id)
        if (cancelled) return
        setRow(initial)
        setNote(initial?.note ?? '')
        setCollapsed(initial !== null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [user])

  const handleChipTap = useCallback(async (status: CheckInStatus) => {
    if (!user) return
    if (!user.firstCheckinIntroSeen && !row) {
      router.replace('/(recovery)/first-checkin-intro')
      return
    }
    tapLight()
    setSaving(true)
    try {
      const wasFirstEver = !row
      const next = await saveTodayCheckIn({ userId: user.id, status, note })
      setRow(next)
      onSaved?.(next)
      if (wasFirstEver && !user.firstCheckinCelebrationSeen) {
        router.replace('/(recovery)/first-checkin-celebration')
      } else {
        setCollapsed(true)
      }
    } finally {
      setSaving(false)
    }
  }, [user, note, row, onSaved])

  const handleNoteBlur = useCallback(async () => {
    if (!user || !row) return
    if ((row.note ?? '') === note) return
    setSaving(true)
    try {
      const next = await saveTodayCheckIn({ userId: user.id, status: row.status, note })
      setRow(next)
      onSaved?.(next)
    } finally {
      setSaving(false)
    }
  }, [user, row, note, onSaved])

  if (loading) {
    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    )
  }

  if (collapsed && row) {
    const label = copy.dashboard.checkInStatuses[row.status]?.label ?? row.status
    return (
      <Pressable
        onPress={() => setCollapsed(false)}
        accessibilityRole="button"
        accessibilityLabel="edit today's check-in"
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            opacity: pressed ? 0.85 : 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          },
        ]}
      >
        <Text style={[type.body, { color: colors.textPrimary }]}>
          today: {label}
        </Text>
        <Text style={[type.small, { color: colors.textMuted }]}>edit</Text>
      </Pressable>
    )
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[type.label, { color: colors.textMuted }]}>today's check-in</Text>
      <Text style={[type.body, { color: colors.textPrimary }]}>{copy.dashboard.checkInPrompt}</Text>
      <View style={styles.chips}>
        {STATUS_ORDER.map((status) => {
          const meta = copy.dashboard.checkInStatuses[status]
          const isSelected = row?.status === status
          return (
            <Pressable
              key={status}
              onPress={() => handleChipTap(status)}
              accessibilityRole="button"
              accessibilityLabel={`chip-${status}`}
              disabled={saving}
              style={[
                styles.chip,
                {
                  backgroundColor: isSelected ? colors.accentSoft : colors.surfaceRaised,
                  borderColor: isSelected ? colors.accent : colors.border,
                },
              ]}
            >
              <Icon name={meta.icon} size={14} color={isSelected ? colors.accent : colors.textSecondary} />
              <Text style={[type.small, { color: isSelected ? colors.accent : colors.textPrimary, fontWeight: '600' }]}>
                {meta.label}
              </Text>
            </Pressable>
          )
        })}
      </View>
      <TextInput
        value={note}
        onChangeText={setNote}
        onBlur={handleNoteBlur}
        placeholder="anything on your mind? (optional)"
        placeholderTextColor={colors.textMuted}
        multiline
        scrollEnabled={false}
        style={[
          styles.note,
          {
            backgroundColor: colors.surfaceRaised,
            borderColor: colors.border,
            color: colors.textPrimary,
          },
        ]}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  chips: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  note: {
    minHeight: 40,
    maxHeight: 96,
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.md,
    fontSize: 14,
    lineHeight: 20,
    textAlignVertical: 'top',
  },
})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/mobile && npx jest components/feed/TodayCheckInCard.test.tsx`
Expected: PASS, 4/4.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/components/feed/TodayCheckInCard.tsx apps/mobile/components/feed/TodayCheckInCard.test.tsx
git commit -m "add today check-in card for inline home feed entry"
```

---

## Task 6: Add `StartFreshNudge` home-feed component

**Files:**
- Create: `apps/mobile/components/feed/StartFreshNudge.tsx`
- Test: `apps/mobile/components/feed/StartFreshNudge.test.tsx`

Lifts the warning card from `(recovery)/check-in.tsx:195–215` to live on the home feed. Renders only when the parent decides to render it (parent gates on `status === 'struggling' && context === 'recovery'`). Pressing the button pushes to `/(recovery)/start-fresh`.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/mobile/components/feed/StartFreshNudge.test.tsx
import { render, fireEvent } from '@testing-library/react-native'
import { StartFreshNudge } from './StartFreshNudge'
import { router } from 'expo-router'

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }))

describe('<StartFreshNudge />', () => {
  beforeEach(() => (router.push as jest.Mock).mockReset())

  it('renders the prompt and pushes to start-fresh on press', () => {
    const { getByText, getByLabelText } = render(<StartFreshNudge />)
    expect(getByText(/need a fresh start/i)).toBeTruthy()
    fireEvent.press(getByLabelText('start fresh'))
    expect(router.push).toHaveBeenCalledWith('/(recovery)/start-fresh')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && npx jest components/feed/StartFreshNudge.test.tsx`
Expected: FAIL — `Cannot find module './StartFreshNudge'`.

- [ ] **Step 3: Write implementation**

```tsx
// apps/mobile/components/feed/StartFreshNudge.tsx
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { useColors } from '../../hooks/useColors'
import { spacing, radii, type } from '../../constants/theme'

export function StartFreshNudge() {
  const colors = useColors()
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.warningSoft, borderColor: colors.warning },
      ]}
    >
      <Text style={[type.h3, { color: colors.textPrimary }]}>
        need a fresh start?
      </Text>
      <Text style={[type.small, { color: colors.textSecondary }]}>
        if today wasn&apos;t a clean day, you can reset your start date. it&apos;s not a failure, it&apos;s honesty.
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="start fresh"
        onPress={() => router.push('/(recovery)/start-fresh')}
        style={({ pressed }) => [
          styles.btn,
          { backgroundColor: colors.warning, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Text style={styles.btnText}>{'\u21bb'} start fresh</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.lg, borderWidth: 1, padding: spacing.lg, gap: spacing.sm },
  btn: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    marginTop: spacing.xs,
  },
  btnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/mobile && npx jest components/feed/StartFreshNudge.test.tsx`
Expected: PASS, 1/1.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/components/feed/StartFreshNudge.tsx apps/mobile/components/feed/StartFreshNudge.test.tsx
git commit -m "lift start-fresh warning card to a home-feed nudge component"
```

---

## Task 7: Update recovery `_layout.tsx` (SOS FAB + messages tab + hide notifications)

**Files:**
- Modify: `apps/mobile/app/(recovery)/_layout.tsx`

Replace `check-in` tabs.screen with an SOS-button entry; replace `notifications` tab with hidden route; expose `chat` as a primary tab (#4); reorder tabs to home / journal / SOS / messages / add per spec §3.

- [ ] **Step 1: Edit imports and body**

Replace the entire body of `apps/mobile/app/(recovery)/_layout.tsx` with:

```tsx
import { useEffect } from 'react'
import { Tabs } from 'expo-router'
import { useColors } from '../../hooks/useColors'
import { Icon } from '../../components/Icon'
import { CenterSOSButton } from '../../components/CenterSOSButton'
import { useAuthStore } from '../../store/auth'
import { supabase } from '../../lib/supabase'
import { scheduleOkayReminder, cancelOkayReminder, parseTime } from '../../lib/notifications'
import { usePushToken } from '../../hooks/usePushToken'
import { useRealtimeNotifications } from '../../hooks/useRealtimeNotifications'
import { useEmergencyAlert } from '../../hooks/useEmergencyAlert'

export default function RecoveryLayout() {
  const colors = useColors()
  const user = useAuthStore((s) => s.user)
  usePushToken(user?.id)
  useRealtimeNotifications(user?.id)
  const { trigger: triggerEmergency } = useEmergencyAlert()

  useEffect(() => {
    if (!user) return
    let cancelled = false
    async function setupReminder() {
      const { data } = await supabase
        .from('silence_settings')
        .select('okay_tap_enabled, okay_tap_time, snooze_until')
        .eq('user_id', user!.id)
        .maybeSingle()
      if (cancelled) return
      const settings = data as {
        okay_tap_enabled: boolean
        okay_tap_time: string
        snooze_until: string | null
      } | null
      const snoozed = settings?.snooze_until && settings.snooze_until >= new Date().toISOString().split('T')[0]
      if (!settings?.okay_tap_enabled || snoozed) {
        await cancelOkayReminder()
        return
      }
      const { hour, minute } = parseTime(settings?.okay_tap_time ?? '09:00')
      await scheduleOkayReminder(hour, minute)
    }
    setupReminder()
    return () => { cancelled = true }
  }, [user])

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingBottom: 8,
          height: 64,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          letterSpacing: 0.2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'home',
          tabBarIcon: ({ color, size }) => <Icon name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="journal"
        options={{
          title: 'journal',
          tabBarIcon: ({ color, size }) => <Icon name="book-open" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="sos"
        options={{
          title: '',
          tabBarButton: () => <CenterSOSButton onArmed={triggerEmergency} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'messages',
          tabBarIcon: ({ color, size }) => <Icon name="message-circle" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'add',
          tabBarIcon: ({ color, size }) => <Icon name="user-plus" size={size} color={color} />,
        }}
      />
      {/* Hidden routes — still navigable but not in the tab bar. */}
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
      <Tabs.Screen name="journal-entry" options={{ href: null }} />
      <Tabs.Screen name="supporter-settings" options={{ href: null }} />
      <Tabs.Screen name="silence-settings" options={{ href: null }} />
      <Tabs.Screen name="start-fresh" options={{ href: null }} />
      <Tabs.Screen name="first-checkin-intro" options={{ href: null }} />
      <Tabs.Screen name="first-checkin-celebration" options={{ href: null }} />
    </Tabs>
  )
}
```

Notes on the `sos` tab:
- expo-router v3 requires a route name that maps to a real file. We need a placeholder `app/(recovery)/sos.tsx` that renders nothing — the `tabBarButton` overrides the press behavior so the route's component is never visible. Add it in the next step.
- The `check-in` route file is removed in Task 10.

- [ ] **Step 2: Add the placeholder `sos` route**

Create `apps/mobile/app/(recovery)/sos.tsx`:

```tsx
// Placeholder route. The tabBarButton in (recovery)/_layout.tsx intercepts
// presses on this slot to drive the press-and-hold SOS gesture, so this
// component should never actually render in normal navigation.
export default function SosPlaceholder() {
  return null
}
```

- [ ] **Step 3: Type-check**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/(recovery)/_layout.tsx apps/mobile/app/(recovery)/sos.tsx
git commit -m "rebuild recovery tab bar around SOS press-and-hold and messages"
```

---

## Task 8: Update supporter `_layout.tsx` (3 even tabs)

**Files:**
- Modify: `apps/mobile/app/(supporter)/_layout.tsx`

Replace `notifications` tab with `chat` (messages) per spec §4. Move `notifications` to hidden routes.

- [ ] **Step 1: Replace the layout body**

Replace the body of `apps/mobile/app/(supporter)/_layout.tsx` with:

```tsx
import { Tabs } from 'expo-router'
import { useColors } from '../../hooks/useColors'
import { Icon } from '../../components/Icon'
import { useAuthStore } from '../../store/auth'
import { usePushToken } from '../../hooks/usePushToken'
import { useRealtimeNotifications } from '../../hooks/useRealtimeNotifications'

export default function SupporterLayout() {
  const colors = useColors()
  const user = useAuthStore((s) => s.user)
  usePushToken(user?.id)
  useRealtimeNotifications(user?.id)

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingBottom: 8,
          height: 64,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          letterSpacing: 0.2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'home',
          tabBarIcon: ({ color, size }) => <Icon name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'messages',
          tabBarIcon: ({ color, size }) => <Icon name="message-circle" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="invite"
        options={{
          title: 'add',
          tabBarIcon: ({ color, size }) => <Icon name="user-plus" size={size} color={color} />,
        }}
      />
      {/* Hidden routes */}
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
      <Tabs.Screen name="first-run-connected" options={{ href: null }} />
      <Tabs.Screen name="first-run-cold" options={{ href: null }} />
    </Tabs>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/(supporter)/_layout.tsx
git commit -m "rebuild supporter tab bar with messages as a primary tab"
```

---

## Task 9: Update recovery home (`(recovery)/index.tsx`) feed wiring

**Files:**
- Modify: `apps/mobile/app/(recovery)/index.tsx`

Pull in `TodayCheckInCard` and `StartFreshNudge`. Drop `handleGetSupport` (the SOS FAB owns the emergency call now via `useEmergencyAlert`). Rewire `<StrugglingCard>` CTA to a hint pointing at the SOS FAB rather than firing the emergency call. Replace the `hasAnyCheckIns === false` empty-state CTA with the `TodayCheckInCard` (the card itself handles the no-history case via the first-checkin redirect).

- [ ] **Step 1: Remove `handleGetSupport` and `sendingEmergency` state**

In `apps/mobile/app/(recovery)/index.tsx`:

Delete lines 69 (`const [sendingEmergency, setSendingEmergency] = useState(false)`) and lines 78–121 (`async function handleGetSupport() { ... }`). Also remove the now-unused imports: `Alert` from `'react-native'` (only if no other call site remains — keep `Alert` if `handleSaveIntention` still uses it; in current code line 222 uses `Alert.alert`, so keep `Alert`) and `notifyWarning`, `api`, `ApiError` if they have no other usage in this file. Verify with a quick grep before deleting:

```bash
cd apps/mobile && grep -nE "notifyWarning|ApiError|\\bapi\\(" app/\(recovery\)/index.tsx
```

If the only remaining matches are inside the deleted region, drop those imports.

- [ ] **Step 2: Rewire StrugglingCard CTA (handler + label)**

`<StrugglingCard>` currently calls `handleGetSupport` and its CTA text is "Talk to someone now". Per spec §5.1 the button must surface a hint pointing at the SOS FAB instead, since SOS is now the single emergency entry point.

In the home screen, find:

```tsx
{todayStatus === 'struggling' && (
  <StrugglingCard onGetSupport={handleGetSupport} />
)}
```

Replace with:

```tsx
{todayStatus === 'struggling' && (
  <StrugglingCard onGetSupport={() => Alert.alert(
    'when you’re ready',
    'press and hold the SOS button at the bottom of the screen to alert your supporters.',
  )} />
)}
```

Then update `apps/mobile/components/feed/StrugglingCard.tsx` so the CTA text and accessibility label match the new behavior. Find the Pressable at lines 21–28:

```tsx
<Pressable
  onPress={onGetSupport}
  style={[styles.cta, { backgroundColor: colors.danger }]}
  accessibilityLabel="Talk to someone now"
>
  <Text style={[type.small, { color: '#fff', fontWeight: '700' }]}>Talk to someone now</Text>
  <Icon name="arrow-right" size={14} color="#fff" />
</Pressable>
```

Replace with:

```tsx
<Pressable
  onPress={onGetSupport}
  style={[styles.cta, { backgroundColor: colors.danger }]}
  accessibilityLabel="how to alert supporters"
>
  <Text style={[type.small, { color: '#fff', fontWeight: '700' }]}>hold the SOS button when you’re ready</Text>
  <Icon name="arrow-right" size={14} color="#fff" />
</Pressable>
```

- [ ] **Step 3: Insert `TodayCheckInCard` and `StartFreshNudge` into the feed**

Add imports near the other feed-card imports (around line 30):

```tsx
import { TodayCheckInCard } from '../../components/feed/TodayCheckInCard'
import { StartFreshNudge } from '../../components/feed/StartFreshNudge'
```

In the rendered tree (currently lines 327–425), the empty-state branch (`hasAnyCheckIns === false`) and the populated branch are split. Collapse them: always render the populated layout, with `TodayCheckInCard` between `StreakCard` and the daily-pulse / memory card. Drop the day-one card entirely — the `TodayCheckInCard` handles "no history" by redirecting to first-checkin-intro on first chip tap.

Replace the JSX from `{hasAnyCheckIns === false ? (` (~line 327) through the closing `)}` of the populated branch (~line 425) with:

```tsx
      {/* §2.4 — pinned streak snapshot */}
      <StreakCard
        days={days}
        next={next}
        streakLabel={copy.dashboard.streakLabel}
        showResetChip={user?.context === 'recovery'}
      />

      {/* spec §5.1 — today's check-in inline */}
      <TodayCheckInCard onSaved={(row) => setTodayStatus(row.status)} />

      {/* §4.2 — struggling card sits below the check-in */}
      {todayStatus === 'struggling' && (
        <StrugglingCard onGetSupport={() => Alert.alert(
          'when you’re ready',
          'press and hold the SOS button at the bottom of the screen to alert your supporters.',
        )} />
      )}

      {/* spec §5.1 — start-fresh nudge moves out of the check-in screen */}
      {todayStatus === 'struggling' && user?.context === 'recovery' && (
        <StartFreshNudge />
      )}

      {/* §2.2 — milestone celebration (persistent until next) */}
      {user?.context === 'recovery' && substanceHighest > 0 && (
        <MilestoneFeedCard
          badge={
            MILESTONES_SUBSTANCE_LABEL[substanceHighest] ??
            `${substanceHighest} days`
          }
          body={`${MILESTONES_SUBSTANCE_LABEL[substanceHighest] ?? `${substanceHighest} days`} clean. quiet wins matter.`}
        />
      )}
      {user?.context === 'life' && lifeHighest > 0 && (
        <MilestoneFeedCard
          badge={`${lifeHighest} check-ins`}
          body={`${lifeHighest} check-ins. showing up matters.`}
        />
      )}

      {/* §2.2 — daily pulse: reflection or memory */}
      {showMemory && oldEntry ? (
        <MemoryCard
          entryText={oldEntry.body}
          daysAgo={oldEntryDaysAgo}
          dayNumber={Math.max(days - oldEntryDaysAgo, 1)}
        />
      ) : (
        <DailyPulseCard
          prompt={reflectionPrompt}
          onWriteAnswer={() =>
            router.push({
              pathname: '/(recovery)/journal-entry',
              params: { prompt: reflectionPrompt },
            })
          }
        />
      )}

      {/* §2.2 — intention slot, daily */}
      <IntentionCard intention={intention} onSave={handleSaveIntention} />

      {/* invite supporter nudge while user has zero connections */}
      {connectionCount === 0 && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="invite someone who is in your corner"
          onPress={() => router.push('/(recovery)/settings')}
          style={({ pressed }) => [
            styles.inviteCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text style={[styles.inviteText, { color: colors.textPrimary }]}>
            {`invite someone who's in your corner →`}
          </Text>
        </Pressable>
      )}
```

Then delete the now-unused styles `dayOneCard`, `dayOneTitle`, `dayOneBtn`, `dayOneBtnText` from the StyleSheet.

`hasAnyCheckIns` state is still useful for downstream (analytics-style) decisions — but if no other reference remains after this edit, drop the state and its `setHasAnyCheckIns` call too. Check with:

```bash
cd apps/mobile && grep -nE "hasAnyCheckIns|setHasAnyCheckIns" app/\(recovery\)/index.tsx
```

If the only remaining references are the declarations + the `loadDashboard` setter call, drop them and the related supabase count query.

- [ ] **Step 4: Run home-screen smoke test**

This screen has no jest test today; verify type-check and that the file still parses:

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app/(recovery)/index.tsx
git commit -m "wire today check-in card and start-fresh nudge into recovery home feed"
```

---

## Task 10: Delete retired files

**Files:**
- Delete: `apps/mobile/app/(recovery)/check-in.tsx`
- Delete: `apps/mobile/components/CenterCheckInButton.tsx`
- Delete: `apps/mobile/components/CenterCheckInButton.test.tsx`

The recovery layout no longer references `check-in` or `CenterCheckInButton`. Confirm with a grep before deleting.

- [ ] **Step 1: Confirm no remaining references**

```bash
cd apps/mobile && grep -rn "CenterCheckInButton\|/(recovery)/check-in" --include="*.ts" --include="*.tsx" .
```

Expected: zero matches outside the files we're deleting. If a reference appears (e.g. a deep link), update it to `/(recovery)` (the home, since the inline card has replaced the dedicated screen) before proceeding.

- [ ] **Step 2: Delete the files**

```bash
rm apps/mobile/app/\(recovery\)/check-in.tsx \
   apps/mobile/components/CenterCheckInButton.tsx \
   apps/mobile/components/CenterCheckInButton.test.tsx
```

- [ ] **Step 3: Type-check + run full mobile test suite**

Run: `cd apps/mobile && npx tsc --noEmit && npx jest`
Expected: type-check clean, all tests green.

- [ ] **Step 4: Commit**

```bash
git add -A apps/mobile/app/\(recovery\)/check-in.tsx apps/mobile/components/CenterCheckInButton.tsx apps/mobile/components/CenterCheckInButton.test.tsx
git commit -m "retire dedicated check-in screen and center check-in button"
```

(Note: `git add -A` on a deleted path stages the deletion. If the shell's path expansion gets in the way, `git rm <path>` works too.)

---

## Task 11: Manual verification + open PR

**Files:** none (verification only)

- [ ] **Step 1: Boot the app**

Run: `cd apps/mobile && npx expo start --clear`
Open on iOS simulator (or device).

- [ ] **Step 2: Walk the recovery happy path**

- [ ] Header shows avatar / circly / bell only. Tap avatar → profile. Tap bell → notifications screen.
- [ ] Tab bar shows: home / journal / SOS-FAB-with-hold-caption / messages / add. Five slots, evenly distributed; SOS slot is the raised, dangerous-red circle.
- [ ] Tap SOS briefly: scale-down + dim, no fire. No alert shown.
- [ ] Hold SOS for 1.5s: ring fills, on full-fill the success/no-supporters/error alert from `useEmergencyAlert` shows. (Use a test account whose supporter count you can predict.)
- [ ] Release SOS at ~1s: ring resets, no fire.
- [ ] Home feed: `TodayCheckInCard` sits between streak and reflection. Tap a chip → row saves and the card collapses to "today: <label> · edit".
- [ ] Tap "edit" on the collapsed card → editor returns; chips and note still work.
- [ ] Pick `struggling` → `StrugglingCard` appears below check-in card; `StartFreshNudge` appears below that.
- [ ] StrugglingCard CTA shows the "press and hold the SOS button" alert (no longer fires emergency).
- [ ] Notifications badge: trigger an unread notification (e.g. server-side or by clearing local read state); bell badge appears with the count.

- [ ] **Step 3: Walk the supporter happy path**

- [ ] Header: avatar / circly / bell.
- [ ] Tab bar shows three even tabs: home / messages / add.
- [ ] Bell taps push to supporter notifications screen.

- [ ] **Step 4: First-time user path**

Use a test account with zero check-ins and `firstCheckinIntroSeen = false`:

- [ ] Open recovery home; tap any chip on the check-in card.
- [ ] Expect: redirect to `first-checkin-intro`. Complete the flow.
- [ ] Return to home, tap a chip again to save the first ever row.
- [ ] Expect: redirect to `first-checkin-celebration`. Complete the flow.
- [ ] Return to home → card now shows the collapsed summary.

- [ ] **Step 5: Run all tests one more time**

Run: `cd apps/mobile && npx jest`
Expected: all green.

- [ ] **Step 6: Open the PR**

```bash
git push -u origin feat/nav-sos-redesign
gh pr create --title "rebuild header + tab bar around SOS press-and-hold and inline check-in" --body "$(cat <<'EOF'
## Summary
- Simplifies app header to avatar / wordmark / notifications bell with unread badge
- Replaces recovery center FAB from check-in to a press-and-hold SOS button (instant scale-down + 1500ms ring fill)
- Adds a TodayCheckInCard inline on the recovery home feed and retires the dedicated check-in screen
- Reorders supporter tabs to home / messages / add (notifications moves to header bell)

Per spec: docs/superpowers/specs/2026-05-05-nav-sos-redesign-design.md

## Test plan
- [ ] Tap and hold SOS — ring fills, alert fires
- [ ] Tap SOS briefly — visual feedback, no fire
- [ ] Release SOS mid-hold — cancels
- [ ] Inline check-in saves on chip tap, collapses, and re-expands
- [ ] First-time user redirects to intro then celebration
- [ ] Notifications bell badge reflects unread count
- [ ] Supporter tabs render 3 even slots
EOF
)"
```

---

## Self-Review Notes (filled in during planning)

- Spec §2 (header): Task 2 covers it. Header becomes avatar / wordmark / bell. Badge driven by `useNotificationStore.unreadCount`.
- Spec §3 (recovery tab bar): Task 7 covers it; messages added as tab 4, notifications hidden, SOS replaces check-in slot.
- Spec §3.1 (SOS FAB behavior): Task 3 implements instant scale-down, 1500ms hold-to-fill ring, release-cancel, full-fill triggers `onArmed`. Layout wires `onArmed` to `useEmergencyAlert#trigger` (Task 1, Task 7).
- Spec §3.2 (visibility on every recovery screen): satisfied by tab-bar placement.
- Spec §4 (supporter tab bar): Task 8 covers it.
- Spec §5 (home feed): Task 9 reorders cards: streak, TodayCheckInCard, struggling card (CTA rewired to SOS hint), StartFreshNudge, milestone, daily pulse, intention, invite nudge.
- Spec §5.1 (TodayCheckInCard): Task 5. Three chips, optional note, collapsed-when-saved.
- Spec §5.2 (retire check-in screen, keep first-checkin intro/celebration): Task 5 routes to intro/celebration; Task 10 deletes the screen.
- Spec §6 (no DB migrations, no API changes): plan touches no migrations or server code.
- Spec §7 (out of scope): plan does not touch conversation list, notifications screen design, supporter encouragement, or onboarding beyond the routing tweak in §5.2.
