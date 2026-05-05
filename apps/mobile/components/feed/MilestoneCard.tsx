import { View, Text, StyleSheet } from 'react-native'
import { useColors } from '../../hooks/useColors'
import { Icon } from '../Icon'
import { spacing, radii, type } from '../../constants/theme'

interface MilestoneCardProps {
  label: string
  daysAgo: number
  supporterNames: string[]
}

export function MilestoneCard({ label, daysAgo, supporterNames }: MilestoneCardProps) {
  const colors = useColors()
  const reaction = supporterNames.length > 0
    ? `${supporterNames.slice(0, 2).join(' and ')}${supporterNames.length > 2 ? ` and ${supporterNames.length - 2} others` : ''} celebrated with you.`
    : null

  return (
    <View style={[styles.card, { backgroundColor: colors.successSoft, borderColor: colors.success }]}>
      <View style={styles.labelRow}>
        <Icon name="award" size={11} color={colors.success} />
        <Text style={[styles.label, { color: colors.success }]}>milestone</Text>
      </View>
      <Text style={[styles.title, { color: colors.textPrimary }]}>
        {label} reached{daysAgo > 0 ? ` · ${daysAgo} day${daysAgo > 1 ? 's' : ''} ago` : ''}
      </Text>
      {reaction && <Text style={[type.small, { color: colors.textSecondary }]}>{reaction}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.xl, borderWidth: 1, padding: spacing.lg, gap: spacing.sm },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  label: { ...type.label },
  title: { ...type.h3 },
})
