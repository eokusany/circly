import { View, Text, StyleSheet } from 'react-native'
import { useColors } from '../hooks/useColors'
import { Icon, type IconName } from './Icon'
import { Button } from './Button'
import { spacing, radii, type as t } from '../constants/theme'

interface Props {
  icon: IconName
  title: string
  body: string
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({ icon, title, body, actionLabel, onAction }: Props) {
  const colors = useColors()

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.iconCircle, { backgroundColor: colors.accentSoft }]}>
        <Icon name={icon} size={24} color={colors.accent} />
      </View>
      <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
      <Text style={[styles.body, { color: colors.textSecondary }]}>{body}</Text>
      {actionLabel && onAction && (
        <Button label={actionLabel} onPress={onAction} style={styles.action} />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  title: { ...t.h3, textAlign: 'center' },
  body: { ...t.small, textAlign: 'center' },
  action: { marginTop: spacing.md, alignSelf: 'stretch' },
})
