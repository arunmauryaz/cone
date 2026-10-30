/* ============================================================
   CONE — Formatting Utilities
   src/utils/formatting.js
   ============================================================ */

/**
 * Format a number as CONE Coin currency
 * @param {number} n
 * @param {boolean} showSign - prepend +/- sign
 * @returns {string} e.g. "C 1,24,350.75"
 */
export function formatCurrency(n, showSign = false) {
  if (n === null || n === undefined || isNaN(n)) return 'C 0.00';
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const sign = showSign ? (n >= 0 ? '+' : '-') : (n < 0 ? '-' : '');
  return `${sign}C\u00a0${formatted}`;
}

/**
 * Format as percentage with sign
 */
export function formatPercent(n, showSign = true) {
  if (n === null || n === undefined || isNaN(n)) return '0.00%';
  const sign = showSign && n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

/**
 * Format plain number with Indian locale
 */
export function formatNumber(n) {
  if (n === null || n === undefined || isNaN(n)) return '0';
  return Number(n).toLocaleString('en-IN');
}

/**
 * Format large numbers as K / L / Cr
 */
export function formatCompact(n) {
  const abs = Math.abs(n);
  if (abs >= 1e7) return `${(n / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `${(n / 1e5).toFixed(2)} L`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(1)} K`;
  return String(n);
}

/**
 * Format ISO timestamp to date string
 */
export function formatDate(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
}

/**
 * Format ISO timestamp to time string HH:MM:SS
 */
export function formatTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString('en-IN', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Asia/Kolkata',
  });
}

/**
 * Format ISO timestamp to date + time string
 */
export function formatDateTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Kolkata',
  });
}

/**
 * Format long date like "Saturday, 12 July 2026"
 */
export function formatLongDate(ts = Date.now()) {
  return new Date(ts).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
}

/**
 * Get time-based greeting
 */
export function getGreeting() {
  const hour = new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Kolkata' });
  const h = parseInt(hour, 10);
  if (h >= 5 && h < 12) return 'Good morning';
  if (h >= 12 && h < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Get relative time (e.g. "2 min ago")
 */
export function formatRelativeTime(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Format duration between two timestamps
 */
export function formatDuration(startTs, endTs = Date.now()) {
  const diff = new Date(endTs) - new Date(startTs);
  const secs  = Math.floor(diff / 1000);
  const mins  = Math.floor(secs / 60);
  const hours = Math.floor(mins / 60);
  const days  = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${mins % 60}m`;
  return `${mins}m ${secs % 60}s`;
}

/**
 * Round to nearest tick size
 */
export function roundToTick(price, tickSize = 0.05) {
  return Math.round(price / tickSize) * tickSize;
}

/**
 * Format price (Space Grotesk font class implied) — short alias
 */
export function fmtPrice(n) {
  if (n === null || n === undefined || isNaN(n)) return '0.00';
  return Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
