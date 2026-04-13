import { ScrollView, Text, View, StyleSheet } from 'react-native'
import { Stack } from 'expo-router'
import { useColors } from '../../hooks/useColors'
import { BackButton } from '../../components/BackButton'
import { spacing, type as t, layout } from '../../constants/theme'

export default function TermsScreen() {
  const colors = useColors()

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={styles.container}
      >
        <BackButton />
        <Text style={[styles.title, { color: colors.textPrimary }]}>terms of service</Text>
        <Text style={[styles.updated, { color: colors.textMuted }]}>last updated: april 2026</Text>

        <Section title="acceptance" colors={colors}>
          by creating an account or using circly, you agree to these terms. if you do not agree, do not use the app.
        </Section>

        <Section title="what circly is" colors={colors}>
          {`circly is a connection tool that helps people stay in touch with their support network. it provides check-ins, messaging, and gentle notifications.

circly is not:
• a medical device or clinical tool
• a substitute for professional medical, mental health, or emergency care
• a crisis hotline or emergency service

if you are in immediate danger or experiencing a medical emergency, call your local emergency services.`}
        </Section>

        <Section title="your account" colors={colors}>
          {`you are responsible for keeping your account credentials secure. you must provide accurate information when creating your account.

you may only create one account. accounts are personal and may not be shared or transferred.`}
        </Section>

        <Section title="acceptable use" colors={colors}>
          {`you agree not to:
• use circly to harass, threaten, or harm others
• send abusive, hateful, or inappropriate messages
• impersonate another person
• attempt to access another user's data
• use automated tools to access the service
• interfere with the operation of the service`}
        </Section>

        <Section title="user content" colors={colors}>
          {`you retain ownership of the content you create in circly (check-ins, journal entries, messages). by using the service, you grant us a limited license to store and transmit your content as needed to provide the service.

we do not claim ownership of your content. we do not use your content for advertising or sell it to third parties.`}
        </Section>

        <Section title="privacy and data" colors={colors}>
          your use of circly is also governed by our privacy policy. please review it to understand how we collect, use, and protect your information.
        </Section>

        <Section title="the silent support engine" colors={colors}>
          {`circly's silence detection feature monitors your activity to determine if you have stopped checking in. if you go quiet beyond your configured threshold, your supporters may receive a notification.

this feature is not a safety monitoring system. it is a connection tool. circly cannot guarantee that any notification will be received, read, or acted upon. do not rely on circly as your sole means of reaching someone in a crisis.`}
        </Section>

        <Section title="availability" colors={colors}>
          we strive to keep circly available and reliable, but we do not guarantee uninterrupted service. the app may be temporarily unavailable due to maintenance, updates, or circumstances beyond our control.
        </Section>

        <Section title="termination" colors={colors}>
          you may delete your account at any time. we may suspend or terminate your account if you violate these terms. upon termination, your data will be deleted in accordance with our privacy policy.
        </Section>

        <Section title="limitation of liability" colors={colors}>
          {`circly is provided "as is" without warranties of any kind. to the maximum extent permitted by law, we are not liable for any damages arising from your use of the service.

specifically, we are not responsible for:
• actions taken or not taken by your supporters
• missed or delayed notifications
• decisions made based on information in the app
• any harm resulting from reliance on the service`}
        </Section>

        <Section title="changes to these terms" colors={colors}>
          we may update these terms from time to time. if we make significant changes, we will notify you through the app. continued use after changes constitutes acceptance.
        </Section>

        <Section title="contact" colors={colors}>
          if you have questions about these terms, contact us at support@circly.app.
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
