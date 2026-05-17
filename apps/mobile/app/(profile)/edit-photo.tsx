import { useState } from 'react'
import { View, Text, StyleSheet, Alert, ScrollView } from 'react-native'
import { router } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { useColors } from '../../hooks/useColors'
import { useAuthStore } from '../../store/auth'
import { Avatar } from '../../components/Avatar'
import { Button } from '../../components/Button'
import { BackButton } from '../../components/BackButton'
import { uploadAvatar } from '../../lib/uploadAvatar'
import { spacing, type as t, layout } from '../../constants/theme'

export default function EditPhotoScreen() {
  const colors = useColors()
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const [previewUri, setPreviewUri] = useState<string | null>(null)
  const [pickedBytes, setPickedBytes] = useState<Uint8Array | null>(null)
  const [busy, setBusy] = useState(false)

  if (!user) return null

  async function pick() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo library access in settings to upload a photo.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    })
    if (result.canceled || !result.assets[0]) return
    const asset = result.assets[0]
    setPreviewUri(asset.uri)
    if (asset.base64) {
      const binary = globalThis.atob(asset.base64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      setPickedBytes(bytes)
    }
  }

  async function save() {
    if (!pickedBytes || !previewUri) return
    setBusy(true)
    try {
      const url = await uploadAvatar(user!.id, previewUri, pickedBytes)
      setUser({ ...user!, avatarUrl: url })
      router.back()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'something went wrong'
      Alert.alert('Could not upload', msg)
    } finally {
      setBusy(false)
    }
  }

  const displayUrl = previewUri ?? user.avatarUrl

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
    >
      <View style={styles.header}>
        <BackButton />
        <Text style={[styles.title, { color: colors.textPrimary }]}>profile photo</Text>
      </View>

      <View style={styles.preview}>
        <Avatar
          userId={user.id}
          displayName={user.displayName}
          avatarUrl={displayUrl}
          size={140}
        />
      </View>

      <Button label="choose photo" variant="ghost" onPress={pick} />
      <Button
        label="save"
        onPress={save}
        loading={busy}
        disabled={!pickedBytes}
      />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: layout.screenPadding,
    paddingTop: layout.screenTopPadding,
    gap: spacing.xl,
  },
  header: { gap: spacing.sm },
  title: { ...t.h1 },
  preview: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
})
