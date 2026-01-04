import { apiGet } from '@/lib/api';
import { useEffect, useState } from 'react';

interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuth = async () => {
    try {
      const userData = await apiGet<User>('/api/auth/user');
      setUser(userData);
    } catch (error) {
      // If 401 or other error, user is not authenticated
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
    
    // Poll for auth changes (you could also use a refresh interval)
    const interval = setInterval(checkAuth, 5000); // Check every 5 seconds
    
    return () => clearInterval(interval);
  }, []);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    refetch: checkAuth, // Allow manual refresh
  };
}
