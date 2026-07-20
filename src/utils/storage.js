/* ============================================================
   CONE — localStorage helpers
   src/utils/storage.js
   ============================================================ */

const PREFIX = 'cone_';

function get(key) {
  try {
    const v = localStorage.getItem(PREFIX + key);
    return v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
}

function set(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch (e) {
    console.warn('Storage write failed:', e);
  }
}

function remove(key) {
  localStorage.removeItem(PREFIX + key);
}

/* ---- Users ---- */
export function getUsers()             { return get('users') || []; }
export function saveUsers(users)       { set('users', users); }
export function getCurrentUser()       { return get('current_user') || sessionStorage.getItem(PREFIX + 'current_user') || null; }
export function setCurrentUser(u, remember = true) {
  if (remember) set('current_user', u);
  else sessionStorage.setItem(PREFIX + 'current_user', u);
}
export function clearCurrentUser() {
  remove('current_user');
  sessionStorage.removeItem(PREFIX + 'current_user');
}

/* ---- Portfolio ---- */
export function defaultPortfolioState() {
  return {
    wallet: {
      balance: 100000,
      usedMargin: 0,
      openingBalance: 100000,
      todayPayin: 0,
      todayPayout: 0,
      transactions: [],
    },
    holdings: [],
    positions: [],
    orders: [],
    gttOrders: [],
    sips: [],
    alerts: [],
  };
}

export function getPortfolio(username)        { return get(`portfolio_${username}`) || defaultPortfolioState(); }
export function savePortfolio(username, data) { set(`portfolio_${username}`, data); }

/* ---- Settings ---- */
export function defaultSettings() {
  return {
    apiKey: '',
    apiSecret: '',
    accessToken: '',
    apiProvider: 'mock',
    theme: 'dark',
    chartColorScheme: 'default',
    defaultOrderType: 'MARKET',
    defaultProductType: 'CNC',
    notifications: {
      browser: false,
      priceAlerts: true,
      orderExecution: true,
      misSqOff: true,
      dailySummary: false,
    },
    compactMode: false,
    priceFlash: true,
  };
}

export function getSettings(username)        { return { ...defaultSettings(), ...(get(`settings_${username}`) || {}) }; }
export function saveSettings(username, data) { set(`settings_${username}`, data); }

/* ---- Watchlists ---- */
import { DEFAULT_WATCHLIST_STOCKS } from './constants.js';

export function defaultWatchlists() {
  return [{ name: 'My List 1', stocks: DEFAULT_WATCHLIST_STOCKS }];
}

export function getWatchlists(username)        { return get(`watchlists_${username}`) || defaultWatchlists(); }
export function saveWatchlists(username, data) { set(`watchlists_${username}`, data); }

/* ---- Portfolio History (for chart) ---- */
export function getPortfolioHistory(username) { return get(`portfolio_history_${username}`) || []; }
export function appendPortfolioHistory(username, point) {
  const history = getPortfolioHistory(username);
  history.push(point);
  if (history.length > 10000) history.splice(0, history.length - 10000);
  set(`portfolio_history_${username}`, history);
}

/* ---- Notifications ---- */
export function getNotifications(username) { return get(`notifications_${username}`) || []; }
export function saveNotifications(username, data) { set(`notifications_${username}`, data); }
export function addNotification(username, notif) {
  const list = getNotifications(username);
  list.unshift(notif);
  if (list.length > 200) list.splice(200);
  set(`notifications_${username}`, list);
}

/* ---- Achievements ---- */
export function getAchievements(username)        { return get(`achievements_${username}`) || []; }
export function saveAchievements(username, data) { set(`achievements_${username}`, data); }

/* ---- Sidebar state ---- */
export function getSidebarCollapsed() { return get('sidebar_collapsed') ?? false; }
export function setSidebarCollapsed(v) { set('sidebar_collapsed', v); }

/* ---- Instruments cache ---- */
export function getInstrumentsCache() { return get('instruments_cache'); }
export function setInstrumentsCache(data) { set('instruments_cache', { timestamp: Date.now(), data }); }

/* ---- Nuclear clear ---- */
export function clearAllData() {
  const keys = Object.keys(localStorage).filter(k => k.startsWith(PREFIX));
  keys.forEach(k => localStorage.removeItem(k));
}
