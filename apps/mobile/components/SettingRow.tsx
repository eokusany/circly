import { Children, Fragment, isValidElement } from 'react'
import { Pressable, View, Text, StyleSheet } from 'react-native'
import { useColors } from '../hooks/useColors'
import { Icon } from './Icon'
import { spacing, radii, type as t } from '../constants/theme'

interface Props {
  label: string
  value?: string
  onPress?: () => void
  danger?: boolean
  disabled?: boolean
  /** Right-aligned element — used for switches, "coming soon" tags, etc. */
  right?: React.ReactNode
  /** Hide the chevron. Useful when `right` is a toggle or when the row is non-navigational. */
  hideChevron?: boolean
}

/**
 * A single row in a grouped settings list. Matches iOS settings conventions:
 * label on the left, optional value in muted text, chevron on the right.
 * Supports a `right` slot for custom content (e.g. Switch).
 */
export function SettingRow({
  label,
  value,
  onPress,
  danger,
  disabled,
  right,
  hideChevron,
}: Props) {
  const colors = useColors()

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: colors.surface,
          opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
        },
      ]}
    >
      <View style={styles.labelWrap}>
        <Text
          style={[
            styles.label,
            { color: danger ? colors.danger : colors.textPrimary },
          ]}
        >
          {label}
        </Text>
        {value !== undefined && (
          <Text
            style={[styles.value, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            {value}
          </Text>
        )}
      </View>
      {right ? (
        right
      ) : hideChevron || !onPress ? null : (
        <Icon name="chevron-right" size={18} color={colors.textMuted} />
      )}
    </Pressable>
  )
}

/**
 * Wraps a set of SettingRows with a section title and rounds the group as a
 * single card. Children should be SettingRow components (or plain Views with
 * matching padding).
 */
export function SettingSection({
  title,
  children,
}: {
  title?: string
  children: React.ReactNode
}) {
  const colors = useColors()

  // Insert a 1px divider between rows but not after the last one. Filters out
  // falsy children so conditional rows (e.g. the recovery-only reset button)
  // don't cause stray dividers.
  const rows = Children.toArray(children).filter(isValidElement)

  return (
    <View style={styles.section}>
      {title && (
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{title}</Text>
      )}
      <View
        style={[
          styles.sectionCard,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        {rows.map((child, idx) => (
          <Fragment key={idx}>
            {child}
            {idx < rows.length - 1 && (
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
            )}
          </Fragment>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    ...t.label,
    marginLeft: spacing.xs,
  },
  sectionCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    gap: spacing.md,
    minHeight: 56,
  },
  labelWrap: {
    flex: 1,
    gap: spacing.xs,
  },
  label: {
    ...t.body,
    fontWeight: '500',
  },
  value: {
    ...t.small,
  },
  chevron: {
    fontSize: 22,
    fontWeight: '300',
    marginLeft: spacing.sm,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: spacing.lg,
  },
})
