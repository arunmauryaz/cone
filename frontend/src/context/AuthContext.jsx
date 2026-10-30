/* CONE — Auth Context. The Rust backend owns identity and authentication. */
import { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { apiGet, apiPost, apiPut, apiError } from '../api/client.js';
import { readSession, writeSession } from '../api/session.js';
import { setCurrentUser, clearCurrentUser } from '../utils/storage.js';
import { useSettings } from './SettingsContext.jsx';
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const { updateUsername } = useSettings();
  const [user, setUser] = useState(() => readSession()?.user || null);
  const [authLoading, setAuthLoading] = useState(Boolean(readSession()?.token));
  const clear = useCallback(() => { writeSession(null); clearCurrentUser(); setUser(null); updateUsername(null); }, [updateUsername]);
  useEffect(() => {
    const expired = () => clear();
    window.addEventListener('cone-session-expired', expired);
    let active = true;
    if (readSession()?.token) {
      apiGet('/api/auth/me').then(profile => {
        if (!active) return;
        writeSession({ token:readSession()?.token, user:profile });
        setUser(profile); setCurrentUser(profile.username); updateUsername(profile.username);
      }).catch(error => { if (active && error.response?.status === 401) clear(); })
        .finally(() => { if (active) setAuthLoading(false); });
    }
    return () => { active = false; window.removeEventListener('cone-session-expired', expired); };
  }, [clear, updateUsername]);
  const authenticate = useCallback(async (path, body) => {
    try {
      const result = await apiPost(path, body);
      writeSession({ token:result.token, user:result.user });
      setCurrentUser(result.user.username); updateUsername(result.user.username); setUser(result.user);
      return { ok:true };
    } catch (error) { return { ok:false, error:apiError(error) }; }
  }, [updateUsername]);
  const login = useCallback((username,password) => authenticate('/api/auth/login',{username,password}), [authenticate]);
  const register = useCallback((fullName,username,password) => authenticate('/api/auth/register',{fullName,username,password}), [authenticate]);
  const logout = useCallback(async () => { try { await apiPost('/api/auth/logout'); } catch { /* Local sign-out still completes when offline. */ } finally { clear(); } }, [clear]);
  const updateProfile = useCallback(async updates => {
    try { const result = await apiPut('/api/auth/profile',updates); writeSession({ token:result.token || readSession()?.token, user:result.user }); setCurrentUser(result.user.username); updateUsername(result.user.username); setUser(result.user); return { ok:true }; }
    catch (error) { return { ok:false, error:apiError(error) }; }
  }, [updateUsername]);
  const value = useMemo(() => ({ user, authLoading, isLoggedIn:Boolean(user), register, login, logout, updateProfile }), [user,authLoading,register,login,logout,updateProfile]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() { const context=useContext(AuthContext); if (!context) throw new Error('AuthProvider missing'); return context; }
