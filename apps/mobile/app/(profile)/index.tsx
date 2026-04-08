import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { router } from 'expo-router'
import { useColors } from '../../hooks/useColors'
import { useAuthStore } from '../../store/auth'
import { spacing, type as t, layout } from '../../constants/theme'
import { SettingRow, SettingSection } from '../../components/SettingRow'
import { COPY, DEFAULT_CONTEXT } from '../../lib/copy'

export default function ProfileScreen() {
  const colors = useColors()
  const { user, signOut } = useAuthStore()

  if (!user) return null

  const contextLabel = COPY[user.context ?? DEFAULT_CONTEXT].contextCard.label
  const isRecoveryCenter = user.role === 'recovery' && user.context === 'recovery'

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.back, { color: colors.accent }]}>← back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.textPrimary }]}>profile</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {user.displayName} · {contextLabel}
        </Text>
      </View>

      <SettingSection title="profile">
        <SettingRow
          label="display name"
          value={user.displayName}
          onPress={() => router.push('/(profile)/edit-name')}
        />
        <SettingRow
          label="context"
          value={contextLabel}
          onPress={() => router.push('/(profile)/switch-context')}
        />
      </SettingSection>

      <SettingSection title="account">
        <SettingRow
          label="change email"
          value={user.email}
          onPress={() => router.push('/(profile)/change-email')}
        />
        <SettingRow
          label="change password"
          onPress={() => router.push('/(profile)/change-password')}
        />
        <SettingRow label="sign out" onPress={signOut} hideChevron />
      </SettingSection>

      {isRecoveryCenter && (
        <SettingSection title="recovery">
          <SettingRow
            label="reset sobriety date"
            value={user.sobrietyStartDate ?? 'not set'}
            onPress={() => router.push('/(profile)/reset-sobriety')}
          />
        </SettingSection>
      )}

      <SettingSection title="notifications">
        <SettingRow
          label="notification preferences"
          onPress={() => router.push('/(profile)/notifications')}
        />
      </SettingSection>

      <SettingSection title="more">
        <SettingRow label="download my data" disabled value="coming soon" hideChevron />
        <SettingRow label="privacy policy" disabled value="coming soon" hideChevron />
        <SettingRow label="terms of service" disabled value="coming soon" hideChevron />
      </SettingSection>

      <SettingSection>
        <SettingRow
          label="delete account"
          danger
          onPress={() => router.push('/(profile)/delete-account')}
        />
      </SettingSection>

      <View style={styles.footer} />
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
  back: { ...t.smallStrong, marginBottom: spacing.xs },
  title: { ...t.h1 },
  subtitle: { ...t.body },
  footer: { height: spacing.xxxl },
})
