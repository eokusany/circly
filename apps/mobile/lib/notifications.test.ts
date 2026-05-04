jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
)

const mockSchedule = jest.fn().mockResolvedValue(undefined)
const mockCancel = jest.fn().mockResolvedValue(undefined)
const mockSetCategory = jest.fn().mockResolvedValue(undefined)
const mockGetPerms = jest.fn().mockResolvedValue({ status: 'granted' })
const mockReqPerms = jest.fn().mockResolvedValue({ status: 'granted' })

jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: (...args: unknown[]) => mockSchedule(...args),
  cancelScheduledNotificationAsync: (...args: unknown[]) => mockCancel(...args),
  setNotificationCategoryAsync: (...args: unknown[]) => mockSetCategory(...args),
  getPermissionsAsync: () => mockGetPerms(),
  requestPermissionsAsync: () => mockReqPerms(),
  SchedulableTriggerInputTypes: { DAILY: 'daily' },
}))

import { scheduleOkayReminder, registerDailyCheckinCategory } from './notifications'
import { NOTIFICATION_CATEGORY_ID } from './notificationActions'

describe('scheduleOkayReminder', () => {
  beforeEach(() => {
    mockSchedule.mockClear()
    mockCancel.mockClear()
  })

  it('schedules with the new prompt body and the daily-checkin category', async () => {
    await scheduleOkayReminder(9, 0)
    expect(mockSchedule).toHaveBeenCalledTimes(1)
    const arg = mockSchedule.mock.calls[0][0]
    expect(arg.identifier).toBe('okay-tap-daily')
    expect(arg.content.body).toBe("how's today going? tap below to check in.")
    expect(arg.content.categoryIdentifier).toBe(NOTIFICATION_CATEGORY_ID)
    expect(arg.trigger).toEqual({ type: 'daily', hour: 9, minute: 0 })
  })

  it('cancels any prior schedule first', async () => {
    await scheduleOkayReminder(9, 0)
    expect(mockCancel).toHaveBeenCalledWith('okay-tap-daily')
  })
})

describe('registerDailyCheckinCategory', () => {
  beforeEach(() => {
    mockSetCategory.mockClear()
  })

  it('registers three actions in the expected order with non-foregrounding options', async () => {
    await registerDailyCheckinCategory()
    expect(mockSetCategory).toHaveBeenCalledTimes(1)
    const [categoryId, actions] = mockSetCategory.mock.calls[0]
    expect(categoryId).toBe('daily-checkin')
    expect(actions).toEqual([
      {
        identifier: 'mood-good',
        buttonTitle: 'good',
        options: { opensAppToForeground: false },
      },
      {
        identifier: 'mood-okay',
        buttonTitle: 'okay',
        options: { opensAppToForeground: false },
      },
      {
        identifier: 'mood-struggling',
        buttonTitle: 'struggling',
        options: { opensAppToForeground: false, isDestructive: true },
      },
    ])
  })
})
