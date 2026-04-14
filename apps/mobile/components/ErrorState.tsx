import { View, Text, StyleSheet } from 'react-native'
import { useColors } from '../hooks/useColors'
import { Icon } from './Icon'
import { Button } from './Button'
import { spacing, radii, type as t } from '../constants/theme'

interface Props {
  message?: string
  onRetry?: () => void
}

export function ErrorState({
  message = 'something went wrong. check your connection and try again.',
  onRetry,
}: Props) {
  const colors = useColors()

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.iconCircle, { backgroundColor: colors.dangerSoft }]}>
        <Icon name="wifi-off" size={24} color={colors.danger} />
      </View>
      <Text style={[styles.title, { color: colors.textPrimary }]}>
        couldn&apos;t load
      </Text>
      <Text style={[styles.body, { color: colors.textSecondary }]}>
        {message}
      </Text>
      {onRetry && (
        <Button label="try again" onPress={onRetry} style={styles.action} />
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
