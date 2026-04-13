import { supabase } from './supabase'

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'

export class ApiError extends Error {
  status: number
  body: unknown

  constructor(status: number, body: unknown, message?: string) {
    super(message ?? `API error ${status}`)
    this.status = status
    this.body = body
  }
}

// Cache the access token to avoid calling getSession() on every request.
// Supabase's onAuthStateChange keeps this in sync.
let cachedToken: string | null = null

supabase.auth.onAuthStateChange((_event, session) => {
  cachedToken = session?.access_token ?? null
})

// Seed the cache from the current session (async, but fast).
supabase.auth.getSession().then(({ data }) => {
  cachedToken = data.session?.access_token ?? null
})

/**
 * Wraps fetch with base URL + bearer token injection from the current
 * Supabase session. Parses JSON responses and throws ApiError on non-2xx.
 */
export async function api<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  // Fast path: use cached token. Fallback to getSession() if cache is cold.
  let token = cachedToken
  if (!token) {
    const { data } = await supabase.auth.getSession()
    token = data.session?.access_token ?? null
    cachedToken = token
  }

  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const url = path.startsWith('http')
    ? path
    : `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`

  const res = await fetch(url, { ...init, headers })

  const text = await res.text()
  const body = text ? safeJson(text) : null

  if (!res.ok) {
    throw new ApiError(res.status, body)
  }

  return body as T
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}
