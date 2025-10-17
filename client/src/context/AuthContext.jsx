import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import * as authApi from '../api/auth.js';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { user: currentUser } = await authApi.getCurrentUser();
      setUser(currentUser ?? null);
      return currentUser ?? null;
    } catch (err) {
      setUser(null);
      setError(err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (credentials) => {
    const { user: authenticatedUser } = await authApi.login(credentials);
    setError(null);
    setUser(authenticatedUser);
    return authenticatedUser;
  }, []);

  const registerUser = useCallback(async (payload) => {
    const { user: registeredUser } = await authApi.register(payload);
    setError(null);
    setUser(registeredUser);
    return registeredUser;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setError(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, error, login, registerUser, logout, refresh }),
    [user, loading, error, login, registerUser, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  return useContext(AuthContext);
};
