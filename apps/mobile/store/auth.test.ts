import { useAuthStore, type AppUser } from './auth'

// Mock supabase to avoid real network calls
jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signOut: jest.fn().mockResolvedValue({}),
    },
  },
}))

const mockUser: AppUser = {
  id: 'user-1',
  email: 'test@circly.app',
  displayName: 'Test User',
  role: 'recovery',
  context: 'recovery',
  sobrietyStartDate: '2026-01-01',
}

beforeEach(() => {
  useAuthStore.setState({ user: null, loading: true })
})

describe('auth store', () => {
  it('starts with null user and loading true', () => {
    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.loading).toBe(true)
  })

  it('sets a user', () => {
    useAuthStore.getState().setUser(mockUser)
    expect(useAuthStore.getState().user).toEqual(mockUser)
  })

  it('clears user on setUser(null)', () => {
    useAuthStore.getState().setUser(mockUser)
    useAuthStore.getState().setUser(null)
    expect(useAuthStore.getState().user).toBeNull()
  })

  it('sets loading state', () => {
    useAuthStore.getState().setLoading(false)
    expect(useAuthStore.getState().loading).toBe(false)
  })

  it('signs out and clears user', async () => {
    useAuthStore.getState().setUser(mockUser)
    await useAuthStore.getState().signOut()
    expect(useAuthStore.getState().user).toBeNull()
  })
})
