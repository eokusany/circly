import * as Haptics from 'expo-haptics'
import { Platform } from 'react-native'

const isNative = Platform.OS === 'ios' || Platform.OS === 'android'

/** Light tap — selections, toggles */
export function tapLight() {
  if (isNative) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
}

/** Medium tap — confirms, check-ins */
export function tapMedium() {
  if (isNative) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
}

/** Success — milestone reached, encouragement sent */
export function notifySuccess() {
  if (isNative) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
}

/** Warning — emergency alert, destructive confirm */
export function notifyWarning() {
  if (isNative) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
}
