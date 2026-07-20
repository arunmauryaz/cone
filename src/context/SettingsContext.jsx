/* ============================================================
   CONE — Settings Context
   src/context/SettingsContext.jsx
   ============================================================ */

import { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { getSettings, saveSettings, getCurrentUser } from '../utils/storage.js';
import { fetchUserProfile } from '../api/upstox.js';

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [username, setUsername] = useState(() => getCurrentUser());
  const [settings, setSettingsState] = useState(() => getSettings(username));
  const [connectionStatus, setConnectionStatus] = useState('unchecked'); // 'unchecked' | 'connected' | 'failed' | 'simulated'

  // Reload settings whenever username changes
  useEffect(() => {
    const u = getCurrentUser();
    setUsername(u);
    setSettingsState(getSettings(u));
  }, []);

  const isApiConnected = useMemo(() =>
    Boolean(settings.accessToken && connectionStatus === 'connected'),
    [settings.accessToken, connectionStatus]
  );

  const updateUsername = useCallback((u) => {
    setUsername(u);
    setSettingsState(getSettings(u));
  }, []);

  const saveSettingsUpdate = useCallback((updates) => {
    const merged = { ...settings, ...updates };
    setSettingsState(merged);
    if (username) saveSettings(username, merged);
  }, [settings, username]);

  const testConnection = useCallback(async () => {
    if (!settings.accessToken) {
      setConnectionStatus('simulated');
      return { ok: false, message: 'No access token provided.' };
    }
    try {
      setConnectionStatus('checking');
      const profile = await fetchUserProfile(settings.accessToken);
      setConnectionStatus('connected');
      return { ok: true, profile };
    } catch (e) {
      setConnectionStatus('failed');
      const status = e?.response?.status ?? 'unknown';
      return { ok: false, message: `HTTP ${status}: ${e?.response?.data?.message ?? e.message}` };
    }
  }, [settings.accessToken]);

  const value = useMemo(() => ({
    settings,
    saveSettings: saveSettingsUpdate,
    isApiConnected,
    connectionStatus,
    testConnection,
    updateUsername,
  }), [settings, saveSettingsUpdate, isApiConnected, connectionStatus, testConnection, updateUsername]);

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider');
  return ctx;
}
