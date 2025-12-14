'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface UserContextType {
  user: User | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
}

const UserContext = createContext<UserContextType>({
  user: null,
  isLoading: true,
  setUser: () => {},
});

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Try to get user from cookie or URL params (passed from gateway)
    const loadUser = async () => {
      try {
        // Check for user data in cookie
        const cookies = document.cookie.split(';');
        const userCookie = cookies.find(c => c.trim().startsWith('dev_user='));

        if (userCookie) {
          const userData = JSON.parse(decodeURIComponent(userCookie.split('=')[1]));
          setUser(userData);
        } else {
          // Check URL params (for initial redirect from dashboard)
          const params = new URLSearchParams(window.location.search);
          const userData = params.get('user');
          if (userData) {
            const parsed = JSON.parse(decodeURIComponent(userData));
            setUser(parsed);
            // Store in cookie for subsequent requests
            document.cookie = `dev_user=${encodeURIComponent(JSON.stringify(parsed))}; path=/; max-age=86400`;
            // Clean URL
            window.history.replaceState({}, '', window.location.pathname);
          }
        }
      } catch (error) {
        console.error('Error loading user:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadUser();
  }, []);

  return (
    <UserContext.Provider value={{ user, isLoading, setUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}

// Role hierarchy check
const roleHierarchy: Record<string, number> = {
  superadmin: 100,
  admin: 90,
  lead: 80,
  engineer: 70,
  developer: 60,
  support: 50,
  viewer: 10,
};

export function useMinRole(minRole: string): boolean {
  const { user } = useUser();
  if (!user) return false;

  const userLevel = roleHierarchy[user.role] || 0;
  const requiredLevel = roleHierarchy[minRole] || 0;

  return userLevel >= requiredLevel;
}
