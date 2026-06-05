import axios from 'axios';
import { createContext, useContext, useEffect, useState } from 'react';

const AuthContext = createContext(null);

const api = axios.create({
  baseURL: '/api',
});

// Interceptor: attach JWT token to every request automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('cloudvault_token');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount: check localStorage for token and verify with /api/auth/me
  useEffect(() => {
    const restoreSession = async () => {
      const token = localStorage.getItem('cloudvault_token');
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const { data } = await api.get('/auth/me');
        setUser(data);
      } catch {
        // Token expired or invalid — clear it
        localStorage.removeItem('cloudvault_token');
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    restoreSession();
  }, []);

  const register = async (name, email, password) => {
    const { data } = await api.post('/auth/register', { name, email, password });
    localStorage.setItem('cloudvault_token', data.token);
    setUser({ 
      _id: data._id, 
      name: data.name, 
      email: data.email, 
      role: data.role || 'user',
      storageUsed: data.storageUsed || 0,
      storageLimit: data.storageLimit || 100 * 1024 * 1024
    });
    return data;
  };

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    if (data.twoFactorRequired) {
      return data;
    }
    localStorage.setItem('cloudvault_token', data.token);
    setUser({ 
      _id: data._id, 
      name: data.name, 
      email: data.email, 
      role: data.role || 'user',
      storageUsed: data.storageUsed || 0,
      storageLimit: data.storageLimit || 100 * 1024 * 1024
    });
    return data;
  };

  const verify2FA = async (email, code) => {
    const { data } = await api.post('/auth/verify-2fa', { email, code });
    localStorage.setItem('cloudvault_token', data.token);
    setUser({ 
      _id: data._id, 
      name: data.name, 
      email: data.email, 
      role: data.role,
      storageUsed: data.storageUsed || 0,
      storageLimit: data.storageLimit || 100 * 1024 * 1024
    });
    return data;
  };

  const logout = () => {
    localStorage.removeItem('cloudvault_token');
    setUser(null);
  };

  const refreshUserContext = async () => {
    try {
      const { data } = await api.get('/auth/me');
      setUser(data);
    } catch (err) {
      console.error('Failed to refresh user context', err);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, verify2FA, logout, refreshUserContext, api }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};

export { api };
