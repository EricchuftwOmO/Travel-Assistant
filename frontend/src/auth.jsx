import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getToken, setToken, setUnauthorizedHandler, userApi } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(() => Boolean(getToken()));

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  // A saved token is checked with the GraphQL `me` query; an expired one signs the user out.
  useEffect(() => {
    setUnauthorizedHandler(logout);
    if (!getToken()) return;
    userApi
      .me()
      .then((me) => {
        if (me) setUser(me);
        else logout();
      })
      .catch(() => logout())
      .finally(() => setLoading(false));
  }, [logout]);

  const signIn = useCallback(({ token, user: signedIn }) => {
    setToken(token);
    setUser(signedIn);
  }, []);

  // After a profile save, so the header shows the new name.
  const updateUser = useCallback((changes) => setUser((current) => ({ ...current, ...changes })), []);

  const value = useMemo(
    () => ({ user, loading, signIn, logout, updateUser }),
    [user, loading, signIn, logout, updateUser]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
