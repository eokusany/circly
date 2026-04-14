import React from 'react'
import { View, Text, StyleSheet, Pressable, useColorScheme } from 'react-native'
import { Sentry } from '../lib/sentry'
import { spacing, type as t } from '../constants/theme'

interface Props {
  children: React.ReactNode
}

interface State {
  hasError: boolean
}

function ErrorFallback({ onRetry }: { onRetry: () => void }) {
  const scheme = useColorScheme()
  const dark = scheme === 'dark'
  const bg = dark ? '#1A1A1A' : '#FBF9F4'
  const textPrimary = dark ? '#F5F5F5' : '#1A1A1A'
  const textSecondary = dark ? '#A0A0A0' : '#6B6B6B'
  const btnBg = dark ? '#F5F5F5' : '#1A1A1A'
  const btnText = dark ? '#1A1A1A' : '#FFFFFF'

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <Text style={[styles.emoji, { color: textPrimary }]}>:(</Text>
      <Text style={[styles.title, { color: textPrimary }]}>something went wrong</Text>
      <Text style={[styles.body, { color: textSecondary }]}>
        the app ran into an unexpected error. tap below to try again.
      </Text>
      <Pressable style={[styles.button, { backgroundColor: btnBg }]} onPress={onRetry}>
        <Text style={[styles.buttonText, { color: btnText }]}>try again</Text>
      </Pressable>
    </View>
  )
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    Sentry.captureException(error, {
      extra: { componentStack: info.componentStack },
    })
  }

  handleRetry = () => {
    this.setState({ hasError: false })
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback onRetry={this.handleRetry} />
    }

    return this.props.children
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emoji: {
    fontSize: 48,
    marginBottom: spacing.lg,
  },
  title: {
    ...t.h1,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  body: {
    ...t.body,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
    maxWidth: 280,
  },
  button: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 12,
  },
  buttonText: {
    ...t.bodyStrong,
  },
})
