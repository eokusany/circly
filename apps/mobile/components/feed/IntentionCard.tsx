import { useState } from 'react'
import { View, Text, Pressable, TextInput, StyleSheet } from 'react-native'
import { useColors } from '../../hooks/useColors'
import { Icon } from '../Icon'
import { spacing, radii, type } from '../../constants/theme'

interface IntentionCardProps {
  intention: string | null
  onSave: (text: string) => Promise<void>
}

export function IntentionCard({ intention, onSave }: IntentionCardProps) {
  const colors = useColors()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(intention ?? '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!draft.trim()) return
    setSaving(true)
    await onSave(draft.trim())
    setSaving(false)
    setEditing(false)
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderStyle: intention ? 'solid' : 'dashed' }]}>
      {intention && !editing ? (
        <>
          <View style={styles.labelRow}>
            <Icon name="target" size={11} color={colors.textMuted} />
            <Text style={[styles.label, { color: colors.textMuted }]}>today's intention</Text>
          </View>
          <Text style={[styles.intentionText, { color: colors.textPrimary }]}>{intention}</Text>
          <Pressable onPress={() => setEditing(true)}>
            <Text style={[type.small, { color: colors.textMuted }]}>Edit</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={[styles.placeholder, { color: colors.textMuted }]}>
            {editing ? 'Update your intention' : "Set today's intention"}
          </Text>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="What do you want to carry with you today?"
            placeholderTextColor={colors.textMuted}
            style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]}
            multiline
            autoFocus={editing}
          />
          <Pressable
            onPress={handleSave}
            disabled={saving || !draft.trim()}
            style={[styles.saveBtn, { backgroundColor: colors.accent, opacity: saving ? 0.6 : 1 }]}
          >
            <Text style={[type.small, { color: colors.background, fontWeight: '700' }]}>
              {saving ? 'Saving...' : 'Save'}
            </Text>
          </Pressable>
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.xl, borderWidth: 1, padding: spacing.lg, gap: spacing.md },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  label: { ...type.label },
  intentionText: { ...type.body, fontStyle: 'italic' },
  placeholder: { ...type.small },
  input: { borderWidth: 1, borderRadius: radii.md, padding: spacing.md, ...type.body, minHeight: 60 },
  saveBtn: { borderRadius: radii.md, padding: spacing.md, alignItems: 'center' },
})
