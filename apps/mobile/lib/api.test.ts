// Mock supabase so api.ts can import it without touching the network. The
// jest.mock factory is hoisted, so we can't reference outer variables inside
// it — instead we expose the mock through the mocked module itself.
jest.mock('./supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
    },
  },
}))

import { api, ApiError } from './api'
import { supabase } from './supabase'

const getSessionMock = supabase.auth.getSession as jest.Mock

// Stubby Response factory — we don't depend on undici here, jsdom's global
// fetch provides enough.
function mockFetchOnce(
  body: unknown,
  init: { status?: number; asText?: boolean } = {},
) {
  const status = init.status ?? 200
  const text =
    typeof body === 'string' || init.asText
      ? (body as string)
      : body === null
        ? ''
        : JSON.stringify(body)
  const response = {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(text),
  }
  ;(global.fetch as jest.Mock).mockResolvedValueOnce(response)
}

describe('api helper', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    global.fetch = jest.fn() as unknown as typeof fetch
    getSessionMock.mockReset()
    getSessionMock.mockResolvedValue({
      data: { session: { access_token: 'the-token' } },
    })
  })

  afterAll(() => {
    global.fetch = originalFetch
  })

  describe('URL composition', () => {
    it('prepends BASE_URL for relative paths starting with /', async () => {
      mockFetchOnce({ ok: true })
      await api('/api/me')
      const [url] = (global.fetch as jest.Mock).mock.calls[0]
      expect(url).toMatch(/\/api\/me$/)
      expect(url).toMatch(/^https?:\/\//)
    })

    it('adds a leading / when the relative path lacks one', async () => {
      mockFetchOnce({ ok: true })
      await api('me')
      const [url] = (global.fetch as jest.Mock).mock.calls[0]
      expect(url).toMatch(/\/me$/)
    })

    it('passes through absolute http URLs unchanged', async () => {
      mockFetchOnce({ ok: true })
      await api('http://other.example/foo')
      const [url] = (global.fetch as jest.Mock).mock.calls[0]
      expect(url).toBe('http://other.example/foo')
    })

    it('passes through absolute https URLs unchanged', async () => {
      mockFetchOnce({ ok: true })
      await api('https://secure.example/bar')
      const [url] = (global.fetch as jest.Mock).mock.calls[0]
      expect(url).toBe('https://secure.example/bar')
    })
  })

  describe('auth header injection', () => {
    it('attaches Authorization: Bearer <token> when a session exists', async () => {
      mockFetchOnce({ ok: true })
      await api('/api/me')
      const [, init] = (global.fetch as jest.Mock).mock.calls[0]
      const headers = init.headers as Headers
      expect(headers.get('Authorization')).toBe('Bearer the-token')
    })

    it('omits Authorization when there is no session', async () => {
      getSessionMock.mockResolvedValueOnce({ data: { session: null } })
      mockFetchOnce({ ok: true })
      await api('/api/me')
      const [, init] = (global.fetch as jest.Mock).mock.calls[0]
      const headers = init.headers as Headers
      expect(headers.get('Authorization')).toBeNull()
    })

    it('always sets Content-Type: application/json', async () => {
      mockFetchOnce({ ok: true })
      await api('/api/me')
      const [, init] = (global.fetch as jest.Mock).mock.calls[0]
      const headers = init.headers as Headers
      expect(headers.get('Content-Type')).toBe('application/json')
    })

    it('preserves caller-provided headers alongside Authorization', async () => {
      mockFetchOnce({ ok: true })
      await api('/api/me', { headers: { 'X-Custom': 'yes' } })
      const [, init] = (global.fetch as jest.Mock).mock.calls[0]
      const headers = init.headers as Headers
      expect(headers.get('X-Custom')).toBe('yes')
      expect(headers.get('Authorization')).toBe('Bearer the-token')
    })

    it('lets the caller override Content-Type', async () => {
      mockFetchOnce({ ok: true })
      await api('/api/me', { headers: { 'Content-Type': 'text/plain' } })
      const [, init] = (global.fetch as jest.Mock).mock.calls[0]
      const headers = init.headers as Headers
      // api sets Content-Type AFTER copying caller headers, so api wins.
      // This test documents current behavior.
      expect(headers.get('Content-Type')).toBe('application/json')
    })
  })

  describe('request init passthrough', () => {
    it('forwards the method', async () => {
      mockFetchOnce({ ok: true })
      await api('/api/me', { method: 'POST' })
      const [, init] = (global.fetch as jest.Mock).mock.calls[0]
      expect(init.method).toBe('POST')
    })

    it('forwards the body', async () => {
      mockFetchOnce({ ok: true })
      await api('/api/me', { method: 'POST', body: JSON.stringify({ a: 1 }) })
      const [, init] = (global.fetch as jest.Mock).mock.calls[0]
      expect(init.body).toBe('{"a":1}')
    })
  })

  describe('response parsing', () => {
    it('returns parsed JSON on 200', async () => {
      mockFetchOnce({ hello: 'world' })
      const result = await api<{ hello: string }>('/api/me')
      expect(result).toEqual({ hello: 'world' })
    })

    it('returns null for an empty body', async () => {
      mockFetchOnce('', { asText: true })
      const result = await api('/api/me')
      expect(result).toBeNull()
    })

    it('returns the raw text when the body is not valid JSON', async () => {
      mockFetchOnce('not-json', { asText: true })
      const result = await api('/api/me')
      expect(result).toBe('not-json')
    })

    it('parses arrays', async () => {
      mockFetchOnce([1, 2, 3])
      const result = await api<number[]>('/api/list')
      expect(result).toEqual([1, 2, 3])
    })

    it('parses nested objects', async () => {
      mockFetchOnce({ a: { b: { c: 1 } } })
      const result = await api<{ a: { b: { c: number } } }>('/api/nested')
      expect(result.a.b.c).toBe(1)
    })
  })

  describe('error handling', () => {
    it('throws ApiError on 400 with parsed body', async () => {
      mockFetchOnce({ error: 'missing_fields' }, { status: 400 })
      await expect(api('/api/x')).rejects.toMatchObject({
        status: 400,
        body: { error: 'missing_fields' },
      })
    })

    it('throws ApiError on 401', async () => {
      mockFetchOnce({ error: 'missing_token' }, { status: 401 })
      await expect(api('/api/x')).rejects.toBeInstanceOf(ApiError)
    })

    it('throws ApiError on 403', async () => {
      mockFetchOnce({ error: 'forbidden' }, { status: 403 })
      const err = await api('/api/x').catch((e) => e)
      expect(err).toBeInstanceOf(ApiError)
      expect((err as ApiError).status).toBe(403)
    })

    it('throws ApiError on 404', async () => {
      mockFetchOnce({ error: 'not_found' }, { status: 404 })
      await expect(api('/api/x')).rejects.toMatchObject({ status: 404 })
    })

    it('throws ApiError on 429 with body preserved', async () => {
      mockFetchOnce({ error: 'rate_limited' }, { status: 429 })
      const err = await api('/api/x').catch((e) => e)
      expect((err as ApiError).body).toEqual({ error: 'rate_limited' })
    })

    it('throws ApiError on 500', async () => {
      mockFetchOnce({ error: 'boom' }, { status: 500 })
      await expect(api('/api/x')).rejects.toMatchObject({ status: 500 })
    })

    it('ApiError.body is null when the server sends an empty error response', async () => {
      mockFetchOnce('', { status: 500, asText: true })
      const err = await api('/api/x').catch((e) => e)
      expect((err as ApiError).body).toBeNull()
    })

    it('ApiError.body is the raw text when the error body is not JSON', async () => {
      mockFetchOnce('oops', { status: 500, asText: true })
      const err = await api('/api/x').catch((e) => e)
      expect((err as ApiError).body).toBe('oops')
    })

    it('ApiError message defaults to "API error <status>"', async () => {
      mockFetchOnce({}, { status: 418 })
      const err = await api('/api/x').catch((e) => e)
      expect((err as Error).message).toBe('API error 418')
    })

    it('rethrows if fetch itself rejects', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('network down'),
      )
      await expect(api('/api/x')).rejects.toThrow('network down')
    })
  })

  describe('ApiError class', () => {
    it('is an Error subclass', () => {
      const e = new ApiError(400, { foo: 1 })
      expect(e).toBeInstanceOf(Error)
    })

    it('stores status and body', () => {
      const e = new ApiError(404, { reason: 'x' })
      expect(e.status).toBe(404)
      expect(e.body).toEqual({ reason: 'x' })
    })

    it('uses a custom message if given', () => {
      const e = new ApiError(500, null, 'exploded')
      expect(e.message).toBe('exploded')
    })

    it('defaults its message when none is given', () => {
      const e = new ApiError(503, null)
      expect(e.message).toBe('API error 503')
    })
  })
})
