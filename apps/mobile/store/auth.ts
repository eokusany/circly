import { create } from 'zustand'
import { supabase } from '../lib/supabase'

export type UserRole = 'recovery' | 'supporter' | 'sponsor'

export interface AppUser {
  id: string
  email: string
  displayName: string
  role: UserRole
}

interface AuthState {
  user: AppUser | null
  loading: boolean
  setUser: (user: AppUser | null) => void
  setLoading: (loading: boolean) => void
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,

  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),

  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null })
  },
}))
