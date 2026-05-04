import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useColors } from '../../hooks/useColors'
import { Icon } from '../Icon'
import { spacing, radii, type } from '../../constants/theme'

interface SilenceAlertCardProps {
  userName: string
  daysQuiet: number
  onMessage: () => void
}

export function SilenceAlertCard({ userName, daysQuiet, onMessage }: SilenceAlertCardProps) {
  const colors = useColors()
  return (
    <View style={[styles.card, { backgroundColor: colors.dangerSoft, borderColor: colors.danger }]}>
      <View style={styles.labelRow}>
        <Icon name="bell-off" size={11} color={colors.danger} />
        <Text style={[styles.label, { color: colors.danger }]}>heads up</Text>
      </View>
      <Text style={[type.body, { color: colors.textPrimary }]}>
        {userName} hasn't checked in for {daysQuiet} {daysQuiet === 1 ? 'day' : 'days'}.
      </Text>
      <Pressable
        onPress={onMessage}
        style={[styles.cta, { backgroundColor: colors.dangerSoft }]}
        accessibilityLabel={`Message ${userName}`}
      >
        <Text style={[type.small, { color: colors.textSecondary }]}>Send a message</Text>
        <Icon name="arrow-right" size={14} color={colors.textMuted} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.xl, borderWidth: 1, padding: spacing.lg, gap: spacing.md },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  label: { ...type.label },
  cta: { borderRadius: radii.md, padding: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
})
