/* ============================================================
   CONE — Constants & Static Data
   src/utils/constants.js
   ============================================================ */

export const STARTING_BALANCE = 100000;
export const MAX_BALANCE = 1000000;
export const APP_NAME = 'CONE';
export const APP_TAGLINE = 'Trade Real Markets. Risk Nothing.';
export const APP_VERSION = '1.0.0';

/* ============================================================
   SECTOR COLORS
   ============================================================ */
export const SECTOR_COLORS = {
  IT:           '#6366f1',
  Banking:      '#3b82f6',
  Energy:       '#f97316',
  Infra:        '#84cc16',
  Power:        '#eab308',
  FMCG:         '#ec4899',
  Auto:         '#14b8a6',
  Finance:      '#8b5cf6',
  Pharma:       '#06b6d4',
  Consumer:     '#f59e0b',
  Healthcare:   '#10b981',
  Defence:      '#64748b',
  PSU:          '#a78bfa',
  Mining:       '#78716c',
  Cement:       '#94a3b8',
  Chemical:     '#34d399',
  Telecom:      '#fb7185',
  Travel:       '#fbbf24',
  Conglomerate: '#c084fc',
  Ports:        '#67e8f9',
  Index:        '#8888aa',
};

/* ============================================================
   FAKE LEADERBOARD TRADERS
   ============================================================ */
export const FAKE_TRADERS = [
  { username: 'BullMaster_Ravi',   seed: 42,  avatar: '#6366f1' },
  { username: 'NiftyNinja99',       seed: 7,   avatar: '#10b981' },
  { username: 'StonkQueen_Priya',  seed: 13,  avatar: '#f97316' },
  { username: 'AlgoAlok',           seed: 99,  avatar: '#3b82f6' },
  { username: 'DivyaTrader',        seed: 55,  avatar: '#ec4899' },
  { username: 'IndexHero_Raj',     seed: 23,  avatar: '#8b5cf6' },
  { username: 'ZeroLoss_Meena',    seed: 31,  avatar: '#06b6d4' },
  { username: 'F0_Fiend',          seed: 18,  avatar: '#f59e0b' },
  { username: 'PaperPro_Aakash',   seed: 64,  avatar: '#14b8a6' },
  { username: 'ChartMaster_V',     seed: 77,  avatar: '#a78bfa' },
  { username: 'GreenPortfolio',    seed: 11,  avatar: '#34d399' },
  { username: 'Sensex_Siddharth', seed: 88,  avatar: '#fb7185' },
  { username: 'RiskFreeRoshan',   seed: 44,  avatar: '#fbbf24' },
  { username: 'TechTrader_Neha',  seed: 33,  avatar: '#67e8f9' },
  { username: 'MarketMogul_K',    seed: 56,  avatar: '#c084fc' },
  { username: 'CandleKing_P',     seed: 72,  avatar: '#84cc16' },
  { username: 'NIFTY_Narayan',    seed: 19,  avatar: '#eab308' },
  { username: 'SwingTrader_S',    seed: 85,  avatar: '#64748b' },
  { username: 'LongHold_Lakshmi', seed: 37,  avatar: '#78716c' },
];

/* ============================================================
   ACHIEVEMENTS
   ============================================================ */
export const ACHIEVEMENTS = {
  first_trade:   { id: 'first_trade',   name: 'First Trade',     icon: '🎯', description: 'Place your first order' },
  bull_run:      { id: 'bull_run',      name: 'Bull Run',        icon: '📈', description: 'Portfolio up 10%+' },
  diamond_hands: { id: 'diamond_hands', name: 'Diamond Hands',   icon: '💎', description: 'Hold a stock for 30+ days' },
  top_trader:    { id: 'top_trader',    name: 'Top Trader',      icon: '🏆', description: 'Reach #1 on leaderboard' },
  speed_demon:   { id: 'speed_demon',   name: 'Speed Demon',     icon: '⚡', description: '10 orders in a single day' },
  strategist:    { id: 'strategist',    name: 'Strategist',      icon: '🧠', description: '5 different stocks in holdings' },
  millionaire:   { id: 'millionaire',   name: 'Millionaire',     icon: '💰', description: 'Portfolio reaches C 2,00,000' },
};

/* ============================================================
   DEFAULT WATCHLIST
   ============================================================ */
export const DEFAULT_WATCHLIST_STOCKS = [
  'NSE_EQ|RELIANCE',
  'NSE_EQ|TCS',
  'NSE_EQ|INFY',
  'NSE_EQ|HDFC',
  'NSE_EQ|SBIN',
  'NSE_EQ|MARUTI',
  'NSE_EQ|ZOMATO',
  'NSE_EQ|BAJFINANCE',
];

/* ============================================================
   MARKET HOURS (IST)
   ============================================================ */
export const MARKET_OPEN_HOUR    = 9;
export const MARKET_OPEN_MINUTE  = 15;
export const MARKET_CLOSE_HOUR   = 15;
export const MARKET_CLOSE_MINUTE = 30;
export const MIS_SQUAREOFF_HOUR   = 15;
export const MIS_SQUAREOFF_MINUTE = 20;

/* ============================================================
   SEEDED RANDOM (for consistent fake trader values)
   ============================================================ */
export function seededRandom(seed) {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

export function traderPortfolioValue(seed, daysOffset = 0) {
  const r = seededRandom(seed + daysOffset * 7);
  return Math.round(STARTING_BALANCE * (0.85 + r * 0.65));
}
