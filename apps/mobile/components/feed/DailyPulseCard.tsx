import { View, Text, Pressable, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useColors } from '../../hooks/useColors'
import { Icon } from '../Icon'
import { spacing, radii, type, elevation } from '../../constants/theme'

// Tier 1 surface gradient: warm dark base → slightly darker base
const CARD_GRADIENT = ['#221F1B', '#1A1815'] as const

interface DailyPulseCardProps {
  prompt: string
  onWriteAnswer: () => void
}

export function DailyPulseCard({ prompt, onWriteAnswer }: DailyPulseCardProps) {
  const colors = useColors()
  return (
    <LinearGradient colors={CARD_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.card}>
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
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  card: { ...elevation.card, borderRadius: radii.xl, padding: spacing.lg, gap: spacing.md },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  label: { ...type.label },
  prompt: { ...type.body, fontStyle: 'italic', lineHeight: 23 },
  cta: { borderRadius: radii.md, padding: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ctaText: { ...type.small },
})
