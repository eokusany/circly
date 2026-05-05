import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useColors } from '../../hooks/useColors'
import { Icon } from '../Icon'
import { spacing, radii, type } from '../../constants/theme'

interface StrugglingCardProps {
  onGetSupport: () => void
}

export function StrugglingCard({ onGetSupport }: StrugglingCardProps) {
  const colors = useColors()
  return (
    <View style={[styles.card, { backgroundColor: colors.dangerSoft, borderColor: colors.danger }]}>
      <View style={styles.labelRow}>
        <Icon name="alert-triangle" size={11} color={colors.danger} />
        <Text style={[styles.label, { color: colors.danger }]}>{`you said you're struggling`}</Text>
      </View>
      <Text style={[type.body, { color: colors.textPrimary }]}>
        {`You don't have to face this alone. Reach out, someone is there for you.`}
      </Text>
      <Pressable
        onPress={onGetSupport}
        style={[styles.cta, { backgroundColor: colors.danger }]}
        accessibilityLabel="Talk to someone now"
      >
        <Text style={[type.small, { color: '#fff', fontWeight: '700' }]}>Talk to someone now</Text>
        <Icon name="arrow-right" size={14} color="#fff" />
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
