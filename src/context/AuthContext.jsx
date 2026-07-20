/* ============================================================
   CONE — Auth Context
   src/context/AuthContext.jsx
   ============================================================ */

import { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import {
  getUsers, saveUsers,
  getCurrentUser, setCurrentUser, clearCurrentUser,
  getPortfolio, savePortfolio,
  getSettings,
  defaultPortfolioState,
} from '../utils/storage.js';
import { useSettings } from './SettingsContext.jsx';
import { STARTING_BALANCE } from '../utils/constants.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const { updateUsername } = useSettings();

  const [user, setUser] = useState(() => {
    const username = getCurrentUser();
    if (!username) return null;
    const users = getUsers();
    return users.find(u => u.username === username) ?? null;
  });

  const isLoggedIn = Boolean(user);

  useEffect(() => {
    if (!user) return;
    const s = getSettings(user.username);
    if (s.theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, [user]);

  const register = useCallback((fullName, username, password) => {
    const users = getUsers();
    const exists = users.some(u => u.username.toLowerCase() === username.toLowerCase());
    if (exists) return { ok: false, error: 'Username already taken.' };

    const newUser = {
      username,
      fullName,
      passwordHash: btoa(password),
      createdAt:    new Date().toISOString(),
    };
    saveUsers([...users, newUser]);

    // Initialize portfolio
    const portfolio = defaultPortfolioState();
    portfolio.wallet.openingBalance = STARTING_BALANCE;
    portfolio.wallet.balance        = STARTING_BALANCE;
    savePortfolio(username, portfolio);

    setCurrentUser(username);
    setUser(newUser);
    updateUsername(username);
    return { ok: true };
  }, [updateUsername]);

  const login = useCallback((username, password) => {
    const users = getUsers();
    const found = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!found) return { ok: false, error: 'Invalid username or password.' };
    if (found.passwordHash !== btoa(password)) return { ok: false, error: 'Invalid username or password.' };

    setCurrentUser(found.username);
    setUser(found);
    updateUsername(found.username);
    return { ok: true };
  }, [updateUsername]);

  const logout = useCallback(() => {
    clearCurrentUser();
    setUser(null);
  }, []);

  const updateProfile = useCallback((updates) => {
    const users = getUsers();
    const idx   = users.findIndex(u => u.username === user.username);
    if (idx === -1) return;
    const updated = { ...users[idx], ...updates };
    users[idx] = updated;
    saveUsers(users);
    setUser(updated);
  }, [user]);

  const value = useMemo(() => ({
    user,
    isLoggedIn,
    register,
    login,
    logout,
    updateProfile,
  }), [user, isLoggedIn, register, login, logout, updateProfile]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
