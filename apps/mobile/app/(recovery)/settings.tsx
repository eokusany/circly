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
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'settings',
          headerTintColor: colors.textPrimary,
          headerStyle: { backgroundColor: colors.background },
        }}
      />
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={styles.container}
      >
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
              <View
                key={s.relationship_id}
                style={[
                  styles.row,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.rowName, { color: colors.textPrimary }]}>
                  {s.display_name}
                </Text>
              </View>
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

        <Pressable onPress={() => router.back()} style={styles.backLink}>
          <Text style={{ color: colors.textSecondary }}>back</Text>
        </Pressable>
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
    paddingBottom: spacing.xxxl,
    gap: layout.sectionGap,
  },
  section: { gap: spacing.md },
  sectionTitle: { ...type.label },
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
  },
  rowName: { ...type.body, fontWeight: '600' },
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
  backLink: { alignItems: 'center', paddingVertical: spacing.lg },
})
