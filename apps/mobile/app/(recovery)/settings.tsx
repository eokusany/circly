import { useCallback, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Share,
  Pressable,
} from 'react-native'
import { router, useFocusEffect, Stack } from 'expo-router'
import { useColors } from '../../hooks/useColors'
import { useAuthStore } from '../../store/auth'
import { supabase } from '../../lib/supabase'
import { api, ApiError } from '../../lib/api'
import { Button } from '../../components/Button'
import { TextInput } from '../../components/TextInput'
import { Icon } from '../../components/Icon'
import { spacing, radii, type, layout } from '../../constants/theme'

interface Supporter {
  relationship_id: string
  supporter_id: string
  display_name: string
}

interface Invite {
  code: string
  expires_at: string
  hours_left: number
}

interface ServerInvite {
  code: string
  expires_at: string
}

export default function RecoverySettings() {
  const colors = useColors()
  const { user } = useAuthStore()
  const [supporters, setSupporters] = useState<Supporter[]>([])
  const [invite, setInvite] = useState<Invite | null>(null)
  const [generating, setGenerating] = useState(false)
  const [acceptCode, setAcceptCode] = useState('')
  const [accepting, setAccepting] = useState(false)

  const loadSupporters = useCallback(async () => {
    if (!user) return
    const { data, error } = await supabase
      .from('relationships')
      .select('id, supporter_id, users:supporter_id(display_name)')
      .eq('recovery_user_id', user.id)
      .eq('status', 'active')

    if (error || !data) {
      setSupporters([])
      return
    }

    const rows = data as unknown as Array<{
      id: string
      supporter_id: string
      users: { display_name: string } | null
    }>
    setSupporters(
      rows.map((r) => ({
        relationship_id: r.id,
        supporter_id: r.supporter_id,
        display_name: r.users?.display_name ?? 'supporter',
      })),
    )
  }, [user])

  useFocusEffect(
    useCallback(() => {
      loadSupporters()
    }, [loadSupporters]),
  )

  async function handleGenerate() {
    setGenerating(true)
    try {
      const result = await api<ServerInvite>('/api/invites', { method: 'POST' })
      // Snapshot "hours left" at generation time so the card label is stable
      // across re-renders (keeps Date.now() out of the render path).
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

  async function handleAcceptCode() {
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
      Alert.alert('connected', 'a new supporter has joined your circle.')
      loadSupporters()
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
        Alert.alert('could not connect', message)
      } else {
        Alert.alert('could not connect', 'check your connection and try again.')
      }
    }
  }

  async function handleShare(code: string) {
    try {
      await Share.share({
        message: `join my circle on circly with code: ${code}\n(expires in 24 hours)`,
      })
    } catch {
      // user cancelled — nothing to do
    }
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={styles.container}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Icon name="chevron-left" size={20} color={colors.accent} />
            <Text style={[styles.back, { color: colors.accent }]}>back</Text>
          </Pressable>
          <Text style={[styles.title, { color: colors.textPrimary }]}>your circle</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            manage your supporters and invite new ones.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
            your circle
          </Text>
          {supporters.length === 0 ? (
            <View
              style={[
                styles.emptyCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                no one in your circle yet. generate a code below to invite
                someone.
              </Text>
            </View>
          ) : (
            supporters.map((s) => (
              <Pressable
                key={s.relationship_id}
                onPress={() =>
                  router.push({
                    pathname: '/(recovery)/supporter-settings',
                    params: { id: s.relationship_id },
                  })
                }
                style={({ pressed }) => [
                  styles.row,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Text style={[styles.rowName, { color: colors.textPrimary }]}>
                  {s.display_name}
                </Text>
                <Icon name="chevron-right" size={18} color={colors.textMuted} />
              </Pressable>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
            invite someone
          </Text>
          {invite ? (
            <InviteCard
              code={invite.code}
              hoursLeft={invite.hours_left}
              onShare={() => handleShare(invite.code)}
              onRegenerate={handleGenerate}
              regenerating={generating}
            />
          ) : (
            <Button
              label="generate invite code"
              onPress={handleGenerate}
              loading={generating}
            />
          )}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
            have a code?
          </Text>
          <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>
            if a supporter shared a code with you, enter it here to connect.
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
            onPress={handleAcceptCode}
            loading={accepting}
            disabled={acceptCode.trim().length < 6}
          />
        </View>

      </ScrollView>
    </>
  )
}

function InviteCard({
  code,
  hoursLeft,
  onShare,
  onRegenerate,
  regenerating,
}: {
  code: string
  hoursLeft: number
  onShare: () => void
  onRegenerate: () => void
  regenerating: boolean
}) {
  const colors = useColors()

  return (
    <View
      style={[
        styles.inviteCard,
        { backgroundColor: colors.accentSoft, borderColor: colors.accent },
      ]}
    >
      <Text style={[styles.inviteLabel, { color: colors.textMuted }]}>
        your code
      </Text>
      <Text style={[styles.inviteCode, { color: colors.accent }]}>{code}</Text>
      <Text style={[styles.inviteMeta, { color: colors.textSecondary }]}>
        expires in {hoursLeft} hour{hoursLeft === 1 ? '' : 's'}
      </Text>
      <View style={styles.inviteActions}>
        <Button label="share" onPress={onShare} />
        <Button
          label="new code"
          variant="ghost"
          onPress={onRegenerate}
          loading={regenerating}
        />
      </View>
    </View>
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
  backButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs },
  back: { ...type.bodyStrong },
  title: { ...type.h1 },
  subtitle: { ...type.body },
  section: { gap: spacing.md },
  sectionTitle: { ...type.label },
  sectionHint: { ...type.small },
  emptyCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.lg,
  },
  emptyText: { ...type.small },
  row: {
    borderRadius: radii.md,
    borderWidth: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowName: { ...type.body, fontWeight: '600', flex: 1 },
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
  inviteMeta: { ...type.small },
  inviteActions: {
    width: '100%',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
})
