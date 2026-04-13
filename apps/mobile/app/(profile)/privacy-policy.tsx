import { ScrollView, Text, View, StyleSheet } from 'react-native'
import { Stack } from 'expo-router'
import { useColors } from '../../hooks/useColors'
import { BackButton } from '../../components/BackButton'
import { spacing, type as t, layout } from '../../constants/theme'

export default function PrivacyPolicyScreen() {
  const colors = useColors()

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={styles.container}
      >
        <BackButton />
        <Text style={[styles.title, { color: colors.textPrimary }]}>privacy policy</Text>
        <Text style={[styles.updated, { color: colors.textMuted }]}>last updated: april 2026</Text>

        <Section title="what circly is" colors={colors}>
          circly is a mobile app that helps people stay connected to the people who support them. it is not a medical device, therapy tool, or emergency service.
        </Section>

        <Section title="what we collect" colors={colors}>
          {`when you create an account, we collect your email address, display name, and the role you choose (user or supporter).

when you use the app, we store:
• check-in statuses and dates
• journal entries (always private, never shared with supporters)
• "i'm okay" tap timestamps
• messages you send in conversations
• notification preferences and silence detection settings

we do not collect location data, contacts, photos, or browsing history.`}
        </Section>

        <Section title="how we use your data" colors={colors}>
          {`your data is used to:
• show your supporters the updates you have chosen to share
• detect silence and send nudges to your supporters
• deliver notifications (warm pings, encouragements, alerts)
• calculate your streak and milestones

we do not sell your data. we do not use your data for advertising. we do not share your data with third parties except as needed to run the service (hosting, push notifications).`}
        </Section>

        <Section title="what supporters can see" colors={colors}>
          {`supporters can only see what you have explicitly allowed:
• check-in statuses (if you have granted permission)
• milestones (if you have granted permission)
• messages in conversations you participate in

supporters can never see:
• your journal entries
• your "i'm okay" tap history
• your silence detection settings
• anything you have not shared`}
        </Section>

        <Section title="journal privacy" colors={colors}>
          journal entries are always private. they are stored encrypted at rest and are never visible to supporters, even if all other permissions are granted. journal data is protected by biometric authentication on your device.
        </Section>

        <Section title="data storage and security" colors={colors}>
          {`your data is stored in a secure database with row-level security policies. this means the database itself enforces that users can only access their own data and data they have been given permission to see.

all data is transmitted over HTTPS. authentication tokens are stored securely on your device.`}
        </Section>

        <Section title="account deletion" colors={colors}>
          you can delete your account at any time from the profile screen. when you delete your account, all of your data is permanently removed, including check-ins, journal entries, messages, and relationships. this action cannot be undone.
        </Section>

        <Section title="children" colors={colors}>
          circly is not intended for use by anyone under the age of 13. we do not knowingly collect personal information from children.
        </Section>

        <Section title="changes to this policy" colors={colors}>
          if we make significant changes to this policy, we will notify you through the app. continued use of circly after changes constitutes acceptance of the updated policy.
        </Section>

        <Section title="contact" colors={colors}>
          if you have questions about this privacy policy or your data, contact us at support@circly.app.
        </Section>

        <View style={styles.footer} />
      </ScrollView>
    </>
  )
}

function Section({
  title,
  children,
  colors,
}: {
  title: string
  children: string
  colors: ReturnType<typeof useColors>
}) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{title}</Text>
      <Text style={[styles.body, { color: colors.textSecondary }]}>{children}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: layout.screenPadding,
    paddingTop: layout.screenTopPadding,
    gap: spacing.lg,
  },
  title: { ...t.h1 },
  updated: { ...t.small },
  section: { gap: spacing.sm },
  sectionTitle: { ...t.h3 },
  body: { ...t.body, lineHeight: 24 },
  footer: { height: spacing.xxxl },
})
