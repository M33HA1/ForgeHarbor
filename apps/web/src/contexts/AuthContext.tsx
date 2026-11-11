import React, { createContext, useContext, useState, useEffect } from 'react';
import apiService from '../services/api';

import type { User, LoginResponse, LoginResult } from '../types';
import { errorMessage } from '../types';

interface AuthState {
  user: User | null; loading: boolean; error: string | null; isAuthenticated: boolean;
  login(email: string, password: string): Promise<LoginResult>;
  verifyMFA(challenge: string, code: string): Promise<LoginResponse>;
  signup(email: string, password: string): Promise<User>;
  logout(): Promise<void>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
}
const AuthContext = createContext<AuthState | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: React.PropsWithChildren) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const userData = await apiService.getProfile();
      setUser(userData);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      setError(null);
      const response = await apiService.login(email, password);
      if ('mfa_required' in response) { setUser(null); return response; }
      const userData = await apiService.getProfile();
      setUser(userData);
      return response;
    } catch (err) {
      await apiService.logout().catch(() => {});
      setUser(null);
      setError(errorMessage(err));
      throw err;
    }
  };

  const verifyMFA = async (challenge: string, code: string) => {
    setError(null);
    try {
      const result = await apiService.verifyMFA(challenge, code);
      try { setUser(await apiService.getProfile()); }
      catch (error) { await apiService.logout().catch(() => {}); throw error; }
      return result;
    } catch (error) { setUser(null); setError(errorMessage(error)); throw error; }
  };

  const signup = async (email: string, password: string) => {
    try {
      setError(null);
      return await apiService.signup(email, password);
    } catch (err) {
      setError(errorMessage(err));
      throw err;
    }
  };

  const logout = async () => {
    try {
      await apiService.logout();
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider 
      value={{ 
        user, 
        login, 
        verifyMFA,
        signup, 
        logout, 
        loading, 
        error, 
        setError,
        isAuthenticated: !!user 
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
