import { create } from 'zustand'
import { supabase } from '../lib/supabase'

export type UserRole = 'recovery' | 'supporter'
export type AppContext = 'recovery' | 'family'

export interface AppUser {
  id: string
  email: string
  displayName: string
  role: UserRole
  context: AppContext | null
  sobrietyStartDate: string | null
}

interface AuthState {
  user: AppUser | null
  pendingRole: UserRole | null
  loading: boolean
  setUser: (user: AppUser | null) => void
  setRole: (role: UserRole) => void
  setLoading: (loading: boolean) => void
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  pendingRole: null,
  loading: true,

  setUser: (user) => set({ user }),
  setRole: (role) => set({ pendingRole: role }),
  setLoading: (loading) => set({ loading }),

  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, pendingRole: null })
  },
}))
