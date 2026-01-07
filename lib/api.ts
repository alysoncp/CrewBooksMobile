import { API_URL } from './config';

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

export async function uploadReceiptImage(uri: string): Promise<any> {
  const fullUrl = `${API_URL}/api/receipts/upload`;
  
  if (__DEV__) {
    console.log(`Uploading receipt image: ${fullUrl}`);
  }
  
  try {
    // Create FormData for multipart/form-data upload
    const formData = new FormData();
    
    // Extract filename from URI or use a default
    const filename = uri.split('/').pop() || 'receipt.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : 'image/jpeg';
    
    // Backend expects 'files' field (array) and scanWithOCR flag
    // @ts-ignore - FormData append types are complex in React Native
    formData.append('files', {
      uri,
      name: filename,
      type,
    } as any);
    
    // Request OCR processing
    formData.append('scanWithOCR', 'true');
    // Optional: add notes field if needed
    // formData.append('notes', '');

    const res = await fetch(fullUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      body: formData,
      credentials: 'include',
    });

    if (res.status === 401) {
      throw new Error('Unauthorized');
    }

    await throwIfResNotOk(res);
    const result = await res.json();
    
    // Backend returns an array of receipt records
    // If OCR completed, the first item should have expenseData
    if (Array.isArray(result) && result.length > 0) {
      return result[0]; // Return the first receipt (we only upload one at a time)
    }
    
    return result;
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

