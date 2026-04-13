import { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Share,
  Pressable,
} from 'react-native'
import { router, Stack } from 'expo-router'
import { useColors } from '../../hooks/useColors'
import { api, ApiError } from '../../lib/api'
import { Button } from '../../components/Button'
import { TextInput } from '../../components/TextInput'
import { BackButton } from '../../components/BackButton'
import { spacing, radii, type, layout } from '../../constants/theme'

interface ServerInvite {
  code: string
  expires_at: string
}

interface Invite {
  code: string
  expires_at: string
  hours_left: number
}

export default function SupporterInvite() {
  const colors = useColors()
  const [invite, setInvite] = useState<Invite | null>(null)
  const [generating, setGenerating] = useState(false)
  const [acceptCode, setAcceptCode] = useState('')
  const [accepting, setAccepting] = useState(false)
  const [copied, setCopied] = useState(false)

  async function handleGenerate() {
    setGenerating(true)
    try {
      const result = await api<ServerInvite>('/api/invites/supporter', { method: 'POST' })
      const hoursLeft = Math.max(
        1,
        Math.round(
          (new Date(result.expires_at).getTime() - Date.now()) /
            (60 * 60 * 1000),
        ),
      )
      setInvite({ ...result, hours_left: hoursLeft })
    } catch (err) {
      const message =
        err instanceof ApiError
          ? 'something went wrong. please try again.'
          : 'check your connection and try again.'
      Alert.alert('could not generate code', message)
    } finally {
      setGenerating(false)
    }
  }

  async function handleShare(code: string) {
    try {
      await Share.share({
        message: `join my circle on circly with code: ${code}\n(expires in 24 hours)`,
      })
    } catch {
      // user cancelled
    }
  }

  async function handleAccept() {
    const trimmed = acceptCode.trim().toUpperCase()
    if (trimmed.length !== 6) {
      Alert.alert('invalid code', 'invite codes are 6 characters.')
      return
    }

    setAccepting(true)
    try {
      await api('/api/invites/accept', {
        method: 'POST',
        body: JSON.stringify({ code: trimmed }),
      })
      setAccepting(false)
      setAcceptCode('')
      Alert.alert('connected', 'you are now linked. pull down to refresh your home screen.')
      router.back()
    } catch (err) {
      setAccepting(false)
      if (err instanceof ApiError) {
        const errorCode =
          typeof err.body === 'object' && err.body !== null && 'error' in err.body
            ? (err.body as { error: string }).error
            : null
        const message =
          errorCode === 'invalid_or_used_code'
            ? "that code doesn't exist or has already been used."
            : errorCode === 'self_invite'
              ? "you can't use your own invite code."
              : errorCode === 'already_linked'
                ? "you're already connected to this person."
                : 'something went wrong. please try again.'
        Alert.alert('could not join', message)
      } else {
        Alert.alert('could not join', 'check your connection and try again.')
      }
    }
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <BackButton />
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            grow your circle
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            invite someone you want to support, or enter a code they shared with you.
          </Text>
        </View>

        {/* Generate a code to share */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
            invite someone
          </Text>
          <Text style={[styles.sectionBody, { color: colors.textSecondary }]}>
            generate a code and share it with the person you want to support.
            they will enter it in their app to connect with you.
          </Text>
          {invite ? (
            <View
              style={[
                styles.inviteCard,
                { backgroundColor: colors.accentSoft, borderColor: colors.accent },
              ]}
            >
              <Text style={[styles.inviteLabel, { color: colors.textMuted }]}>
                your code
              </Text>
              <Pressable
                onPress={() => {
                  Share.share({ message: invite.code })
                  setCopied(true)
                  setTimeout(() => setCopied(false), 2000)
                }}
                accessibilityRole="button"
                accessibilityLabel={`Copy invite code ${invite.code}`}
              >
                <Text style={[styles.inviteCode, { color: colors.accent }]}>
                  {invite.code}
                </Text>
              </Pressable>
              {copied && (
                <Text style={[styles.copiedLabel, { color: colors.accent }]}>
                  tap share to copy
                </Text>
              )}
              <Text style={[styles.inviteMeta, { color: colors.textSecondary }]}>
                expires in {invite.hours_left} hour{invite.hours_left === 1 ? '' : 's'}
              </Text>
              <View style={styles.inviteActions}>
                <Button label="share" onPress={() => handleShare(invite.code)} />
                <Button
                  label="new code"
                  variant="ghost"
                  onPress={handleGenerate}
                  loading={generating}
                />
              </View>
            </View>
          ) : (
            <Button
              label="generate invite code"
              onPress={handleGenerate}
              loading={generating}
            />
          )}
        </View>

        {/* Accept a code from a recovery user */}
        <View style={[styles.dividerRow]}>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Text style={[styles.dividerText, { color: colors.textMuted }]}>or</Text>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
            i have a code
          </Text>
          <Text style={[styles.sectionBody, { color: colors.textSecondary }]}>
            if the person you want to support shared a code with you, enter it here.
          </Text>
          <TextInput
            label="code"
            value={acceptCode}
            onChangeText={(v) => setAcceptCode(v.toUpperCase())}
            placeholder="ABC123"
            autoCapitalize="characters"
            maxLength={6}
          />
          <Button
            label="connect"
            onPress={handleAccept}
            loading={accepting}
            disabled={acceptCode.trim().length < 6}
          />
        </View>
      </ScrollView>
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: layout.screenPadding,
    paddingTop: layout.screenTopPadding,
    paddingBottom: spacing.xxxl,
    gap: layout.sectionGap,
  },
  header: { gap: spacing.sm },
  title: { ...type.h1 },
  subtitle: { ...type.body },
  section: { gap: spacing.md },
  sectionTitle: { ...type.label },
  sectionBody: { ...type.small },
  inviteCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  inviteLabel: { ...type.label },
  inviteCode: {
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: 6,
    marginVertical: spacing.sm,
  },
  copiedLabel: { ...type.small, fontWeight: '600' },
  inviteMeta: { ...type.small },
  inviteActions: {
    width: '100%',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  divider: { flex: 1, height: 1 },
  dividerText: { ...type.label },
})
