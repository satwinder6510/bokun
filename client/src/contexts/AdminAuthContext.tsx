import { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface AdminUser {
  id: number;
  email: string;
  fullName: string;
  role: 'super_admin' | 'editor';
  twoFactorEnabled?: boolean;
  lastLoginAt?: string;
}

interface AdminAuthContextType {
  user: AdminUser | null;
  sessionToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  setup2FA: (pendingToken: string) => Promise<Setup2FAResult>;
  verify2FASetup: (pendingToken: string, token: string, secret: string) => Promise<void>;
  verify2FA: (pendingToken: string, token: string) => Promise<void>;
  logout: () => Promise<void>;
  isSuperAdmin: () => boolean;
}

interface LoginResult {
  requiresTwoFactor?: boolean;
  requiresTwoFactorSetup?: boolean;
  pendingToken?: string;
  message?: string;
}

interface Setup2FAResult {
  secret: string;
  qrCode: string;
  email: string;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCurrentUser = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/admin/me', {
        credentials: 'include'
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        setSessionToken('cookie-session');
      } else {
        setSessionToken(null);
        setUser(null);
      }
    } catch (error) {
      console.error('Failed to fetch user:', error);
      setSessionToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  const login = async (email: string, password: string): Promise<LoginResult> => {
    const response = await fetch('/api/auth/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      credentials: 'include'
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }

    return data;
  };

  const setup2FA = async (pendingToken: string): Promise<Setup2FAResult> => {
    const response = await fetch('/api/auth/admin/2fa/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pendingToken }),
      credentials: 'include'
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to setup 2FA');
    }

    return data;
  };

  const verify2FASetup = async (pendingToken: string, token: string, secret: string): Promise<void> => {
    const response = await fetch('/api/auth/admin/2fa/verify-setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pendingToken, token, secret }),
      credentials: 'include'
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to verify 2FA setup');
    }

    setSessionToken('cookie-session');
    setUser(data.user);
  };

  const verify2FA = async (pendingToken: string, token: string): Promise<void> => {
    const response = await fetch('/api/auth/admin/2fa/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pendingToken, token }),
      credentials: 'include'
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to verify 2FA');
    }

    setSessionToken('cookie-session');
    setUser(data.user);
  };

  const logout = async (): Promise<void> => {
    try {
      await fetch('/api/auth/admin/logout', {
        method: 'POST',
        credentials: 'include'
      });
    } catch (error) {
      console.error('Logout error:', error);
    }

    setSessionToken(null);
    setUser(null);
  };

  const isSuperAdmin = (): boolean => {
    return user?.role === 'super_admin';
  };

  return (
    <AdminAuthContext.Provider
      value={{
        user,
        sessionToken,
        isAuthenticated: !!user,
        isLoading,
        login,
        setup2FA,
        verify2FASetup,
        verify2FA,
        logout,
        isSuperAdmin
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (context === undefined) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
}
