import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import 'react-native-url-polyfill/auto';

// Read environment variables from multiple sources
// Try process.env first (works if .env is loaded), then fall back to expo config
const supabaseUrl = 
  process.env.EXPO_PUBLIC_SUPABASE_URL || 
  Constants.expoConfig?.extra?.supabaseUrl || 
  '';
  
const supabaseAnonKey = 
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 
  Constants.expoConfig?.extra?.supabaseAnonKey || 
  '';

// Validate environment variables
const hasValidCredentials = 
  supabaseUrl && 
  supabaseAnonKey && 
  !supabaseUrl.includes('your-') && 
  !supabaseAnonKey.includes('your-') &&
  supabaseUrl.startsWith('https://');

if (!hasValidCredentials) {
  console.error(
    `⚠️ Missing Supabase environment variables. 
    Got URL: ${supabaseUrl ? (supabaseUrl.includes('your-') ? '✗ (placeholder)' : supabaseUrl.startsWith('https://') ? '✓' : '✗ (invalid)') : '✗'} 
    Got Key: ${supabaseAnonKey ? (supabaseAnonKey.includes('your-') ? '✗ (placeholder)' : '✓') : '✗'}
    
    Please add your real Supabase credentials to .env file as EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY, then restart the dev server.`
  );
}

// Create and export Supabase client
// Use placeholder values if credentials are missing (prevents crash, but won't work)
export const supabase = createClient(
  hasValidCredentials ? supabaseUrl : 'https://placeholder.supabase.co',
  hasValidCredentials ? supabaseAnonKey : 'placeholder-key',
  {
    auth: {
      autoRefreshToken: hasValidCredentials,
      persistSession: hasValidCredentials,
      detectSessionInUrl: false,
    },
  }
);
