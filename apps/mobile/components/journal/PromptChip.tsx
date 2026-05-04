import { View, Text, StyleSheet } from 'react-native'
import { useColors } from '../../hooks/useColors'
import { Icon } from '../Icon'
import { spacing, radii, type } from '../../constants/theme'

interface PromptChipProps {
  prompt: string
}

export function PromptChip({ prompt }: PromptChipProps) {
  const colors = useColors()
  return (
    <View
      accessible={true}
      accessibilityLabel={`Reflection prompt: ${prompt}`}
      style={[styles.chip, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}
    >
      <View style={styles.labelRow}>
        <Icon name="sun" size={11} color={colors.accent} />
        <Text style={[styles.label, { color: colors.accent }]}>reflection prompt</Text>
      </View>
      <Text style={[styles.text, { color: colors.textSecondary }]}>"{prompt}"</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  chip: { borderRadius: radii.lg, borderWidth: 1, padding: spacing.md, gap: spacing.xs },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  label: { ...type.label },
  text: { ...type.small, fontStyle: 'italic' },
})
