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
