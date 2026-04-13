// Context-aware copy map.
//
// Circly supports multiple care contexts from a single codebase. The data model
// and component tree stay the same across contexts — only the user-facing text
// adapts. Every piece of copy that differs between "recovery" and "family" (or
// any future context) lives here.
//
// Rules:
// - Components must not hardcode strings that vary by context. Pull from COPY.
// - Adding a new context = adding a new entry in COPY. No component changes.
// - The two DB roles (recovery, supporter) are shared across all contexts,
//   but each context may relabel them. `roles` lists which ones show up in
//   role-select and in what display order.

import { useAuthStore } from '../store/auth'
import type { UserRole } from '../store/auth'
import type { IconName } from '../components/Icon'

export type AppContext = 'recovery' | 'family'

export interface RoleCopy {
  label: string
  description: string
  icon: IconName
}

export interface ContextCopy {
  // Context card on context-select screen
  contextCard: {
    label: string
    description: string
    icon: IconName
  }

  // Role select header + role cards
  roleSelect: {
    title: string
    subtitle: string
  }
  roles: UserRole[]
  roleCopy: Record<UserRole, RoleCopy>

  // Recovery-user-equivalent dashboard labels
  // ("recovery" in DB = "person at the center" in family context)
  dashboard: {
    streakLabel: string // e.g. "sober for" / "connected for"
    checkInStatuses: Record<
      'good_day' | 'sober' | 'struggling',
      { icon: IconName; label: string }
    >
    checkInPrompt: string // e.g. "how are you today?"
    journalLabel: string
    journalDescription: string
    getSupportLabel: string // always "get support" — kept here for symmetry
    getSupportDescription: string
    okayTapPrompt: string
    okayTapDone: string
    silenceNudge: string
    warmPingSent: string
  }

  // Sign-up subtitle
  signUpSubtitle: string
}

// ── recovery context ─────────────────────────────────────────────────────

const recovery: ContextCopy = {
  contextCard: {
    label: 'recovery journey',
    description:
      'track your sobriety, check in daily, and stay connected with your support network',
    icon: 'sunrise',
  },
  roleSelect: {
    title: 'who are you here as?',
    subtitle: 'this shapes your experience. you can only choose once.',
  },
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
      good_day: { icon: 'sun', label: 'good day' },
      sober: { icon: 'anchor', label: 'sober' },
      struggling: { icon: 'cloud', label: 'struggling' },
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

// ── family context ───────────────────────────────────────────────────────

const family: ContextCopy = {
  contextCard: {
    label: 'staying close',
    description:
      'stay connected with someone you love. check in, share moments, be present.',
    icon: 'heart',
  },
  roleSelect: {
    title: 'who are you here as?',
    subtitle: 'this shapes your experience. you can only choose once.',
  },
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
      good_day: { icon: 'sun', label: 'great day' },
      sober: { icon: 'heart', label: 'feeling well' },
      struggling: { icon: 'cloud-rain', label: 'need some help' },
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

// ── public API ───────────────────────────────────────────────────────────

export const COPY: Record<AppContext, ContextCopy> = {
  recovery,
  family,
}

export const DEFAULT_CONTEXT: AppContext = 'recovery'

/**
 * Returns the copy block for the current user's context. Safe to call before
 * the user has picked a context — falls back to the default so screens that
 * render during onboarding still have labels to show.
 */
export function useCopy(): ContextCopy {
  const ctx = useAuthStore((s) => s.user?.context ?? null)
  return COPY[ctx ?? DEFAULT_CONTEXT]
}
