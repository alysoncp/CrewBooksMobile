import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Alert, Platform, StyleSheet, TouchableOpacity } from 'react-native';

import { HelloWave } from '@/components/hello-wave';
import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { Link } from 'expo-router';

export default function HomeScreen() {
  const { user, isAuthenticated, refetch } = useAuth();
  const [supabaseStatus, setSupabaseStatus] = useState<string>('Testing...');

  useEffect(() => {
    // Test Supabase connection by getting the current session
    const testSupabase = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          setSupabaseStatus(`Error: ${error.message}`);
        } else if (session) {
          setSupabaseStatus('✅ Supabase Connected! (Logged in)');
        } else {
          setSupabaseStatus('✅ Supabase Connected! (Not logged in)');
        }
      } catch (err) {
        setSupabaseStatus(`❌ Connection failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    };

    testSupabase();
  }, []);

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiRequest('GET', '/api/logout');
              // Refresh auth state - will redirect to login automatically
              await refetch();
            } catch (error) {
              console.error('Logout error:', error);
              // Even if logout fails, try to refresh auth state
              await refetch();
            }
          },
        },
      ]
    );
  };

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#A1CEDC', dark: '#1D3D47' }}
      headerImage={
        <Image
          source={require('@/assets/images/partial-react-logo.png')}
          style={styles.reactLogo}
        />
      }>
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">
          {isAuthenticated ? `Welcome, ${user?.email?.split('@')[0]}!` : 'Welcome!'}
        </ThemedText>
        <HelloWave />
      </ThemedView>

      {/* Supabase Test Section */}
      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">Supabase Test</ThemedText>
        <ThemedText>{supabaseStatus}</ThemedText>
        {isAuthenticated && user && (
          <>
            <ThemedText>User: {user.email}</ThemedText>
            {user.firstName && <ThemedText>Name: {user.firstName} {user.lastName}</ThemedText>}
            <TouchableOpacity onPress={handleSignOut} style={styles.signOutButton}>
              <ThemedText style={styles.signOutText}>Sign Out</ThemedText>
            </TouchableOpacity>
          </>
        )}
      </ThemedView>

      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">Step 1: Try it</ThemedText>
        <ThemedText>
          Edit <ThemedText type="defaultSemiBold">app/(tabs)/index.tsx</ThemedText> to see changes. 
          A whole bunch of changes! Hey pretty cool.
          Press{' '}
          <ThemedText type="defaultSemiBold">
            {Platform.select({
              ios: 'cmd + d',
              android: 'cmd + m',
              web: 'F12',
            })}
          </ThemedText>{' '}
          to open developer tools.
        </ThemedText>
      </ThemedView>
      <ThemedView style={styles.stepContainer}>
        <Link href="/modal">
          <Link.Trigger>
            <ThemedText type="subtitle">Step 2: Explore</ThemedText>
          </Link.Trigger>
          <Link.Preview />
          <Link.Menu>
            <Link.MenuAction title="Action" icon="cube" onPress={() => alert('Action pressed')} />
            <Link.MenuAction
              title="Share"
              icon="square.and.arrow.up"
              onPress={() => alert('Share pressed')}
            />
            <Link.Menu title="More" icon="ellipsis">
              <Link.MenuAction
                title="Delete"
                icon="trash"
                destructive
                onPress={() => alert('Delete pressed')}
              />
            </Link.Menu>
          </Link.Menu>
        </Link>

        <ThemedText>
          {`Tap the Explore tab to learn more about what's included in this starter app.`}
        </ThemedText>
      </ThemedView>
      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">Step 3: Get a fresh start</ThemedText>
        <ThemedText>
          {`When you're ready, run `}
          <ThemedText type="defaultSemiBold">npm run reset-project</ThemedText> to get a fresh{' '}
          <ThemedText type="defaultSemiBold">app</ThemedText> directory. This will move the current{' '}
          <ThemedText type="defaultSemiBold">app</ThemedText> to{' '}
          <ThemedText type="defaultSemiBold">app-example</ThemedText>.
        </ThemedText>
      </ThemedView>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepContainer: {
    gap: 8,
    marginBottom: 8,
  },
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: 'absolute',
  },
  signOutButton: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#ef4444',
    borderRadius: 8,
    alignItems: 'center',
  },
  signOutText: {
    color: '#fff',
    fontWeight: '600',
  },
});