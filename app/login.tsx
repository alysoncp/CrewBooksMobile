import { useAuth } from '@/hooks/useAuth';
import { API_URL, apiRequest } from '@/lib/api';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function Login() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { refetch } = useAuth();
  const insets = useSafeAreaInsets();

  const testConnection = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/user`, {
        credentials: 'include',
      });
      Alert.alert(
        'Connection Test',
        `Status: ${response.status}\nBackend is ${response.status !== 0 ? 'reachable' : 'not reachable'}`
      );
    } catch (error: any) {
      Alert.alert('Connection Test Failed', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiRequest('POST', '/api/login', {
        email: email.trim(),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Login failed');
      }

      const data = await response.json();
      
      // Refresh auth state
      await refetch();
      
      Alert.alert('Success', data.message || 'Logged in successfully!');
      // Navigation will happen automatically via auth state change in _layout.tsx
    } catch (error: any) {
      console.error('Login error:', error);
      Alert.alert(
        'Connection Error', 
        error.message || 'Login failed. Check console for details.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={[styles.content, { paddingTop: insets.top + 32 }]}>
        <Text style={styles.title}>Crew Books</Text>
        <Text style={styles.subtitle}>
          Sign in to your account
        </Text>
        <Text style={styles.devNote}>
          Enter any email to get started (development mode)
        </Text>
        {__DEV__ && (
          <Text style={styles.apiUrlNote}>
            API: {API_URL}
          </Text>
        )}

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#999"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            editable={!isLoading}
          />

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Sign In</Text>
            )}
          </TouchableOpacity>

          {__DEV__ && (
            <TouchableOpacity
              style={[styles.button, styles.testButton]}
              onPress={testConnection}
              disabled={isLoading}
            >
              <Text style={styles.buttonText}>Test Connection</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  devNote: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  apiUrlNote: {
    fontSize: 10,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
    fontFamily: 'monospace',
  },
  form: {
    width: '100%',
  },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  testButton: {
    backgroundColor: '#10b981',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
