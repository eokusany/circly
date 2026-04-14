import React from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { Sentry } from '../lib/sentry'
import { spacing, type as t } from '../constants/theme'

interface Props {
  children: React.ReactNode
}

interface State {
  hasError: boolean
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
      return (
        <View style={styles.container}>
          <Text style={styles.emoji}>:(</Text>
          <Text style={styles.title}>something went wrong</Text>
          <Text style={styles.body}>
            the app ran into an unexpected error. tap below to try again.
          </Text>
          <Pressable style={styles.button} onPress={this.handleRetry}>
            <Text style={styles.buttonText}>try again</Text>
          </Pressable>
        </View>
      )
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
    backgroundColor: '#FBF9F4',
  },
  emoji: {
    fontSize: 48,
    marginBottom: spacing.lg,
  },
  title: {
    ...t.h1,
    textAlign: 'center',
    color: '#1A1A1A',
    marginBottom: spacing.sm,
  },
  body: {
    ...t.body,
    textAlign: 'center',
    color: '#6B6B6B',
    lineHeight: 22,
    marginBottom: spacing.xl,
    maxWidth: 280,
  },
  button: {
    backgroundColor: '#1A1A1A',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 12,
  },
  buttonText: {
    ...t.bodyStrong,
    color: '#FFFFFF',
  },
})
