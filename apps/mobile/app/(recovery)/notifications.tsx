import { Stack } from 'expo-router'
import { NotificationList } from '../../components/NotificationList'

export default function NotificationsScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <NotificationList
        emptyBody={"warm pings, encouragements, and alerts\nfrom your circle will show up here."}
      />
    </>
  )
}
