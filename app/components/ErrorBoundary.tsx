import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<Props, State> {
  state: State = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('App crashed:', error, info);
    // You could log this to a service
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <View style={styles.card}>
            <Text style={styles.title}>Something went wrong</Text>

            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{this.state.error?.toString()}</Text>
            </View>

            <TouchableOpacity
              style={styles.button}
              onPress={() => this.setState({ hasError: false })}
            >
              <Text style={styles.buttonText}>Restart App</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212', // Dark background
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#1E1E1E', // Slightly lighter than background
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 20,
  },
  errorContainer: {
    backgroundColor: '#2A2A2A',
    borderRadius: 8,
    padding: 16,
    width: '100%',
    marginBottom: 24,
  },
  errorText: {
    color: '#E0E0E0',
    fontSize: 14,
    fontFamily: 'monospace',
  },
  button: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#121212',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ErrorBoundary;
