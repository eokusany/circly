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

/**
 * Wraps fetch with base URL + bearer token injection from the current
 * Supabase session. Parses JSON responses and throws ApiError on non-2xx.
 */
export async function api<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token

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
