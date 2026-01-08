import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { TaxYearProvider } from '@/contexts/TaxYearContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/hooks/useAuth';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(tabs)';
    const isPublicPage = segments[0] === 'login';
    const currentRoute = segments[0] as string;
    const isSettingsPage = currentRoute === 'vehicles' || currentRoute === 'expense-settings' || currentRoute === 'about' || currentRoute === 'modal';

    if (!isAuthenticated && (inAuthGroup || isSettingsPage)) {
      // Redirect to login if not authenticated and trying to access protected pages
      router.replace('/login');
    } else if (isAuthenticated && isPublicPage) {
      // Redirect to tabs if authenticated and on login page
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isLoading, segments]);

  return (
    <SafeAreaProvider>
      <TaxYearProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack>
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
            <Stack.Screen name="vehicles" options={{ headerShown: false, presentation: 'card' }} />
            <Stack.Screen name="expense-settings" options={{ headerShown: false, presentation: 'card' }} />
            <Stack.Screen name="about" options={{ headerShown: false, presentation: 'card' }} />
          </Stack>
          <StatusBar style="auto" />
        </ThemeProvider>
      </TaxYearProvider>
    </SafeAreaProvider>
  );
}
