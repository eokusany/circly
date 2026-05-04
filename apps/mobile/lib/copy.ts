// Context-aware copy map.
//
// Circly supports multiple care contexts from a single codebase. The data model
// and component tree stay the same across contexts. Only the user-facing text
// adapts. Every piece of copy that differs between "recovery" and "life" (or
// any future context) lives here.
//
// Rules:
// - Components must not hardcode strings that vary by context. Pull from COPY.
// - Adding a new context = adding a new entry in COPY. No component changes.
// - The two DB roles (recovery, supporter) are shared across all contexts,
//   but each context may relabel them. `roles` lists which ones show up in
//   account-select-style flows and in what display order.

import { useAuthStore } from '../store/auth'
import type { UserRole } from '../store/auth'
import type { IconName } from '../components/Icon'

export type AppContext = 'recovery' | 'life'

export interface RoleCopy {
  label: string
  description: string
  icon: IconName
}

export interface ContextCopy {
  roles: UserRole[]
  roleCopy: Record<UserRole, RoleCopy>

  // Recovery-user-equivalent dashboard labels
  // ("recovery" in DB = "person at the center" in life context)
  dashboard: {
    streakLabel: string // e.g. "sober for" / "connected for"
    checkInStatuses: Record<
      'good_day' | 'sober' | 'struggling',
      { icon: IconName; label: string; description: string }
    >
    checkInPrompt: string // e.g. "how are you today?"
    journalLabel: string
    journalDescription: string
    getSupportLabel: string // always "get support". kept here for symmetry
    getSupportDescription: string
    okayTapPrompt: string
    okayTapDone: string
    silenceNudge: string
    warmPingSent: string
  }

  // Sign-up subtitle
  signUpSubtitle: string
}

// recovery context

const recovery: ContextCopy = {
  roles: ['recovery', 'supporter'],
  roleCopy: {
    recovery: {
      label: 'i need support',
      description:
        'track your journey, check in daily, and stay connected with your support network',
      icon: 'sunrise',
    },
    supporter: {
      label: 'i want to support someone',
      description:
        'show up for someone you love. see their updates and send encouragement.',
      icon: 'users',
    },
  },
  dashboard: {
    streakLabel: 'sober for',
    checkInStatuses: {
      good_day: { icon: 'sun', label: 'good day', description: 'feeling strong and steady' },
      sober: { icon: 'anchor', label: 'sober', description: 'getting through, one moment at a time' },
      struggling: { icon: 'cloud', label: 'struggling', description: "it's a hard one, you showed up" },
    },
    checkInPrompt: 'how are you today?',
    journalLabel: 'journal',
    journalDescription: 'a private space for your thoughts',
    getSupportLabel: 'get support',
    getSupportDescription: 'reach your network instantly',
    okayTapPrompt: "tap to say you're okay",
    okayTapDone: "you're okay. your circle knows.",
    silenceNudge: "it's been {days} days since {name} checked in. maybe reach out?",
    warmPingSent: '{name} will feel your warmth.',
  },
  signUpSubtitle: 'your circle starts here',
}

// life context

const life: ContextCopy = {
  roles: ['recovery', 'supporter'],
  roleCopy: {
    recovery: {
      label: 'the person at the center',
      description:
        'share how you are, write private reflections, and stay close to the people who love you',
      icon: 'heart',
    },
    supporter: {
      label: 'family member',
      description:
        'stay close to someone you love. see how they are and send a little warmth.',
      icon: 'users',
    },
  },
  dashboard: {
    streakLabel: 'connected for',
    checkInStatuses: {
      good_day: { icon: 'sun', label: 'great day', description: 'feeling strong and steady' },
      sober: { icon: 'heart', label: 'feeling well', description: 'present and showing up' },
      struggling: { icon: 'cloud-rain', label: 'need some help', description: "it's a hard one, you showed up" },
    },
    checkInPrompt: 'how are you today?',
    journalLabel: 'reflections',
    journalDescription: 'a private space for your thoughts',
    getSupportLabel: 'get support',
    getSupportDescription: 'reach your people instantly',
    okayTapPrompt: "tap to say you're okay",
    okayTapDone: "you're okay. your people know.",
    silenceNudge: "it's been {days} days since {name} tapped in. maybe call?",
    warmPingSent: '{name} will feel your warmth.',
  },
  signUpSubtitle: 'your circle starts here',
}

// public API

export const COPY: Record<AppContext, ContextCopy> = {
  recovery,
  life,
}

export const DEFAULT_CONTEXT: AppContext = 'recovery'

/**
 * Returns the copy block for the current user's context. Safe to call before
 * the user has picked a context. Falls back to the default so screens that
 * render during onboarding still have labels to show.
 */
export function useCopy(): ContextCopy {
  const ctx = useAuthStore((s) => s.user?.context ?? null)
  return COPY[ctx ?? DEFAULT_CONTEXT]
}
