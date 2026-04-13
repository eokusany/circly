import { useState } from 'react'
import { TextInput as RNTextInput, View, Text, StyleSheet } from 'react-native'
import { useColors } from '../hooks/useColors'
import { radii, spacing, type as t } from '../constants/theme'

interface Props {
  label?: string
  value: string
  onChangeText: (text: string) => void
  placeholder?: string
  secureTextEntry?: boolean
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters'
  keyboardType?: 'default' | 'email-address' | 'number-pad'
  autoCorrect?: boolean
  maxLength?: number
  /** Error message shown below the input in red. */
  error?: string
  /** Multiline text area mode. */
  multiline?: boolean
  numberOfLines?: number
}

export function TextInput({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  autoCapitalize = 'none',
  keyboardType = 'default',
  autoCorrect = false,
  maxLength,
  error,
  multiline,
  numberOfLines,
}: Props) {
  const colors = useColors()
  const [focused, setFocused] = useState(false)

  const borderColor = error
    ? colors.danger
    : focused
      ? colors.accent
      : colors.border

  return (
    <View style={styles.container}>
      {label ? (
        <Text style={[styles.label, { color: error ? colors.danger : colors.textMuted }]}>
          {label}
        </Text>
      ) : null}
      <RNTextInput
        style={[
          styles.input,
          {
            backgroundColor: colors.surface,
            borderColor,
            color: colors.textPrimary,
          },
          multiline && { height: undefined, minHeight: 54, paddingVertical: spacing.md, textAlignVertical: 'top' },
        ]}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        autoCorrect={autoCorrect}
        maxLength={maxLength}
        multiline={multiline}
        numberOfLines={numberOfLines}
        accessibilityLabel={label}
      />
      {error ? (
        <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  label: { ...t.label },
  input: {
    height: 54,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    fontSize: 16,
  },
  error: { ...t.small, marginTop: -spacing.xs },
})
