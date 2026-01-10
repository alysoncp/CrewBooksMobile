// Network configuration to prefer IPv4 over IPv6
// This helps ensure API requests use IPv4 addresses when available
// Especially important when switching WiFi networks

/**
 * Helper function to ensure URLs use IPv4 when possible
 * If the URL already contains an IPv4 address, it's returned as-is
 * For hostname-based URLs, using direct IP addresses in config.ts is recommended
 */
export function preferIPv4(url: string): string {
  // If the URL already contains an IPv4 address, return as-is
  const ipv4Regex = /^https?:\/\/(\d{1,3}\.){3}\d{1,3}/;
  if (ipv4Regex.test(url)) {
    return url;
  }

  // For hostname-based URLs, React Native will use system DNS resolution
  // To prefer IPv4, use direct IP addresses in config.ts instead of hostnames
  // Or configure at the OS level (see notes below)
  return url;
}

/**
 * Network timeout configuration
 * Setting a timeout helps with IPv6 fallback - if IPv6 connection hangs,
 * the timeout will trigger and allow IPv4 fallback
 */
export const NETWORK_TIMEOUT = 10000; // 10 seconds

/**
 * Notes on IPv4 preference in React Native/Expo:
 * 
 * 1. Using direct IP addresses (like 192.168.1.73) bypasses DNS and avoids IPv6 issues
 *    - This is the recommended approach for local development
 *    - Update the IP in lib/config.ts when switching WiFi networks
 * 
 * 2. For hostname-based URLs, IPv4 preference is handled at the OS level:
 *    - On Linux/Mac: Edit /etc/gai.conf and add: precedence ::ffff:0:0/96 100
 *    - On Windows: IPv4 preference is typically set in network adapter settings
 * 
 * 3. React Native's fetch API doesn't support direct IPv4/IPv6 selection
 *    - The system's DNS resolution order determines which is used
 *    - Using direct IP addresses is the most reliable workaround
 */
export const PREFER_IPV4 = true;
