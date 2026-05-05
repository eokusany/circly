import { uploadAvatar, avatarObjectPath } from './uploadAvatar'

const mockUpload = jest.fn()
const mockGetPublicUrl = jest.fn()
const mockUpdate = jest.fn()
const mockEq = jest.fn()

jest.mock('./supabase', () => ({
  supabase: {
    storage: {
      from: () => ({
        upload: (...args: unknown[]) => mockUpload(...args),
        getPublicUrl: (...args: unknown[]) => mockGetPublicUrl(...args),
      }),
    },
    from: () => ({
      update: (...args: unknown[]) => mockUpdate(...args),
      eq: (...args: unknown[]) => mockEq(...args),
    }),
  },
}))

beforeEach(() => {
  mockUpload.mockReset()
  mockGetPublicUrl.mockReset()
  mockUpdate.mockReset()
  mockEq.mockReset()
  mockUpdate.mockReturnValue({ eq: (col: string, val: string) => { mockEq(col, val); return Promise.resolve({ error: null }) } })
  mockUpload.mockResolvedValue({ data: { path: 'u1/avatar.jpg' }, error: null })
  mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://cdn/u1/avatar.jpg' } })
})

describe('avatarObjectPath', () => {
  it('returns userId/avatar.jpg', () => {
    expect(avatarObjectPath('u1')).toBe('u1/avatar.jpg')
  })
})

describe('uploadAvatar', () => {
  it('uploads bytes to the avatars bucket with upsert and writes the public url', async () => {
    const result = await uploadAvatar('u1', 'file:///tmp/p.jpg', new Uint8Array([1, 2, 3]))

    expect(mockUpload).toHaveBeenCalledWith(
      'u1/avatar.jpg',
      expect.any(Uint8Array),
      expect.objectContaining({ upsert: true, contentType: 'image/jpeg' }),
    )
    expect(mockGetPublicUrl).toHaveBeenCalledWith('u1/avatar.jpg')
    expect(mockEq).toHaveBeenCalledWith('id', 'u1')
    expect(result).toBe('https://cdn/u1/avatar.jpg')
  })

  it('throws when storage upload errors', async () => {
    mockUpload.mockResolvedValue({ data: null, error: { message: 'denied' } })
    await expect(
      uploadAvatar('u1', 'file:///tmp/p.jpg', new Uint8Array([1])),
    ).rejects.toThrow('denied')
  })

  it('throws when users update errors', async () => {
    mockUpdate.mockReturnValue({
      eq: () => Promise.resolve({ error: { message: 'rls denied' } }),
    })
    await expect(
      uploadAvatar('u1', 'file:///tmp/p.jpg', new Uint8Array([1])),
    ).rejects.toThrow('rls denied')
  })
})
