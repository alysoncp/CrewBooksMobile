// API configuration
// In development, this should point to your local backend
// For production, use your production API URL
// 
// IMPORTANT: If testing on a physical device:
// - Replace localhost with your computer's IP address (e.g., http://192.168.1.100:5000)
// - Find your IP: Windows: ipconfig, Mac/Linux: ifconfig
// - Make sure your phone and computer are on the same WiFi network
// - Set EXPO_PUBLIC_API_URL in .env file (e.g., EXPO_PUBLIC_API_URL=http://192.168.1.100:5000)
//
// Current detected IP: 192.168.1.73
// Update this default if your IP changes or use EXPO_PUBLIC_API_URL environment variable

const API_BASE_URL = 
  process.env.EXPO_PUBLIC_API_URL || 
  'http://192.168.1.73:5000'; // Default to your local IP for physical device testing

export const API_URL = API_BASE_URL;

// Log the API URL for debugging
if (__DEV__) {
  console.log('API URL:', API_URL);
}
