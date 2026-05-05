import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useColors } from '../../hooks/useColors'
import { Icon } from '../Icon'
import { spacing, radii, type } from '../../constants/theme'

interface DailyPulseCardProps {
  prompt: string
  onWriteAnswer: () => void
}

export function DailyPulseCard({ prompt, onWriteAnswer }: DailyPulseCardProps) {
  const colors = useColors()
  return (
    <View style={[styles.card, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
      <View style={styles.labelRow}>
        <Icon name="sun" size={11} color={colors.accent} />
        <Text style={[styles.label, { color: colors.accent }]}>{`today's reflection`}</Text>
      </View>
      <Text style={[styles.prompt, { color: colors.textPrimary }]}>{`"${prompt}"`}</Text>
      <Pressable
        onPress={onWriteAnswer}
        style={[styles.cta, { backgroundColor: colors.surface }]}
        accessibilityLabel="Write your answer in the journal"
      >
        <Text style={[styles.ctaText, { color: colors.textSecondary }]}>Write your answer</Text>
        <Icon name="arrow-right" size={14} color={colors.accent} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.xl, borderWidth: 1, padding: spacing.lg, gap: spacing.md },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  label: { ...type.label, textTransform: 'lowercase' },
  prompt: { ...type.body, fontStyle: 'italic', lineHeight: 22 },
  cta: { borderRadius: radii.md, padding: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ctaText: { ...type.small },
})
