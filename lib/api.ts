// API configuration
// In development, this should point to your local backend
// For production, use your production API URL
// 
// IMPORTANT: If testing on a physical device:
// - Replace localhost with your computer's IP address (e.g., http://192.168.1.100:5000)
// - Find your IP: Windows: ipconfig, Mac/Linux: ifconfig
// - Make sure your phone and computer are on the same WiFi network
const API_BASE_URL = 
  process.env.EXPO_PUBLIC_API_URL || 
  'http://localhost:5000'; // Default to localhost for dev

export const API_URL = API_BASE_URL;

// Log the API URL for debugging
if (__DEV__) {
  console.log('API URL:', API_URL);
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const fullUrl = url.startsWith('http') ? url : `${API_URL}${url}`;
  
  if (__DEV__) {
    console.log(`API Request: ${method} ${fullUrl}`, data);
  }
  
  try {
    const res = await fetch(fullUrl, {
      method,
      headers: data ? { 'Content-Type': 'application/json' } : {},
      body: data ? JSON.stringify(data) : undefined,
      credentials: 'include', // Important for session cookies
    });

    await throwIfResNotOk(res);
    return res;
  } catch (error: any) {
    if (error.message?.includes('Network request failed') || error.message?.includes('Failed to fetch')) {
      throw new Error(
        `Cannot connect to backend at ${fullUrl}. ` +
        `If testing on a physical device, make sure:\n` +
        `1. Backend is running\n` +
        `2. You're using your computer's IP address (not localhost)\n` +
        `3. Phone and computer are on the same WiFi network\n` +
        `Set EXPO_PUBLIC_API_URL in .env file (e.g., http://192.168.1.100:5000)`
      );
    }
    throw error;
  }
}

export async function apiGet<T>(url: string): Promise<T> {
  const fullUrl = url.startsWith('http') ? url : `${API_URL}${url}`;
  
  if (__DEV__) {
    console.log(`API GET: ${fullUrl}`);
  }
  
  try {
    const res = await fetch(fullUrl, {
      credentials: 'include',
    });

    if (res.status === 401) {
      throw new Error('Unauthorized');
    }

    await throwIfResNotOk(res);
    return await res.json();
  } catch (error: any) {
    if (error.message?.includes('Network request failed') || error.message?.includes('Failed to fetch')) {
      throw new Error(
        `Cannot connect to backend at ${fullUrl}. ` +
        `If testing on a physical device, use your computer's IP address instead of localhost.`
      );
    }
    throw error;
  }
}

