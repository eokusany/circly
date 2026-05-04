import { View, Text, StyleSheet } from 'react-native'
import { useColors } from '../../hooks/useColors'
import { Icon } from '../Icon'
import { spacing, radii, type } from '../../constants/theme'

interface SharedIntentionCardProps {
  userName: string
  intention: string
}

export function SharedIntentionCard({ userName, intention }: SharedIntentionCardProps) {
  const colors = useColors()
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.labelRow}>
        <Icon name="target" size={11} color={colors.textMuted} />
        <Text style={[styles.label, { color: colors.textMuted }]}>{userName}'s intention today</Text>
      </View>
      <Text style={[type.body, { color: colors.textSecondary, fontStyle: 'italic' }]}>"{intention}"</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.xl, borderWidth: 1, padding: spacing.lg, gap: spacing.md },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  label: { ...type.label },
})
