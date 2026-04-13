import { Stack } from 'expo-router'
import { NotificationList } from '../../components/NotificationList'

export default function NotificationsScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <NotificationList
        emptyBody={"updates from the people you support\nwill show up here."}
      />
    </>
  )
}
