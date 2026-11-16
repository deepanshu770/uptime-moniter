import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  id: string;
  email: string;
  display_name: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (data: any) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      // 1. Check for token in URL query parameter (for automated tests, deep links, SSO callbacks)
      const params = new URLSearchParams(window.location.search);
      const urlToken = params.get('token');
      if (urlToken) {
        try {
          const res = await fetch('/v1/auth/me', {
            headers: { Authorization: `Bearer ${urlToken}` }
          });
          if (res.ok) {
            const profile = await res.json();
            setUser(profile);
            setAccessToken(urlToken);
            localStorage.setItem('user', JSON.stringify(profile));
            localStorage.setItem('access_token', urlToken);
            setIsLoading(false);
            return;
          }
        } catch (e) {
          console.error('URL token verification failed:', e);
        }
      }

      // 2. Check for stored tokens on load
      const storedUser = localStorage.getItem('user');
      const storedToken = localStorage.getItem('access_token');
      
      if (storedUser && storedToken) {
        try {
          setUser(JSON.parse(storedUser));
          setAccessToken(storedToken);
        } catch {
          localStorage.removeItem('user');
          localStorage.removeItem('access_token');
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = async (credentials: any) => {
    const response = await fetch('/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText || 'Login failed' }));
      if (error.details && Array.isArray(error.details)) {
        throw new Error(`${error.message}: ${error.details.map((d: any) => d.message).join(', ')}`);
      }
      throw new Error(error.message || 'Login failed');
    }

    const data = await response.json();
    setUser(data.user);
    setAccessToken(data.access_token);
    
    localStorage.setItem('user', JSON.stringify(data.user));
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('refresh_token', data.refresh_token);
  };

  const register = async (credentials: any) => {
    const response = await fetch('/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText || 'Registration failed' }));
      if (error.details && Array.isArray(error.details)) {
        throw new Error(`${error.message}: ${error.details.map((d: any) => d.message).join(', ')}`);
      }
      throw new Error(error.message || 'Registration failed');
    }

    const data = await response.json();
    setUser(data.user);
    setAccessToken(data.access_token);
    
    localStorage.setItem('user', JSON.stringify(data.user));
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('refresh_token', data.refresh_token);
  };

  const logout = async () => {
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        await fetch('/v1/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
      }
    } catch (e) {
      console.error('Logout error', e);
    } finally {
      setUser(null);
      setAccessToken(null);
      localStorage.removeItem('user');
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
